-- ============================================
-- VEX-Timeline: Fix User Profile Auto-Creation
-- ============================================
-- 问题：原触发器只在 raw_user_meta_data 中存在 username 时才创建
-- public.users 行，导致部分用户（Dashboard 创建、旧代码注册、username
-- metadata 缺失）登录时 public.users 缺行 → getCurrentUser() 返回 null →
-- 后续所有依赖 userId 的云端操作崩溃。
--
-- 修复：
--   1. 改写 handle_new_auth_user 触发器，username 缺失时回退到邮箱 @ 前缀
--   2. 添加 username 唯一冲突重试（追加 _N 后缀）
--   3. 回填：为所有 auth.users 中没有 public.users 行的用户补建
-- ============================================

-- ------------------------------------------
-- 1. Rewrite the trigger function
-- ------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_username text;
  v_username text;
  v_attempt int := 0;
  v_max_attempts int := 50;
BEGIN
  -- Prefer username from metadata, fallback to email local-part.
  -- If email is also null, generate a deterministic placeholder from uid.
  v_base_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    CASE
      WHEN NEW.email IS NOT NULL AND NEW.email <> ''
        THEN split_part(NEW.email, '@', 1)
      ELSE 'user_' || substr(NEW.id::text, 1, 8)
    END
  );

  -- Try to insert with unique username (retry with _N suffix on conflict)
  LOOP
    v_username := CASE
      WHEN v_attempt = 0 THEN v_base_username
      ELSE v_base_username || '_' || v_attempt::text
    END;

    BEGIN
      INSERT INTO public.users (id, username)
      VALUES (NEW.id, v_username)
      ON CONFLICT (id) DO NOTHING;
      EXIT; -- success (or row already existed)
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt >= v_max_attempts THEN
        RAISE EXCEPTION 'Could not allocate unique username for user % after % attempts', NEW.id, v_max_attempts;
      END IF;
    END;
  END LOOP;

  -- Always create a personal timeline (skip if one already exists for this owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.timelines
    WHERE owner_id = NEW.id AND type = 'personal'
  ) THEN
    INSERT INTO public.timelines (name, type, owner_id)
    VALUES ('个人时间轴', 'personal', NEW.id);

    -- Also add owner to timeline_members as 'owner' (the
    -- on_timeline_created trigger normally handles this, but be defensive)
    INSERT INTO public.timeline_members (timeline_id, user_id, role)
    SELECT t.id, NEW.id, 'owner'
    FROM public.timelines t
    WHERE t.owner_id = NEW.id AND t.type = 'personal'
      AND NOT EXISTS (
        SELECT 1 FROM public.timeline_members tm
        WHERE tm.timeline_id = t.id AND tm.user_id = NEW.id
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is in place (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------
-- 2. Backfill: create public.users rows for existing auth.users
-- ------------------------------------------

DO $$
DECLARE
  r record;
  v_base_username text;
  v_username text;
  v_attempt int;
  v_inserted boolean;
BEGIN
  FOR r IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE pu.id IS NULL
  LOOP
    v_base_username := COALESCE(
      NULLIF(r.email, ''),
      'user_' || substr(r.id::text, 1, 8)
    );
    -- Strip @ if email got concatenated somehow
    v_base_username := split_part(v_base_username, '@', 1);
    IF v_base_username = '' OR v_base_username IS NULL THEN
      v_base_username := 'user_' || substr(r.id::text, 1, 8);
    END IF;

    v_attempt := 0;
    v_inserted := false;

    WHILE NOT v_inserted AND v_attempt < 50 LOOP
      v_username := CASE
        WHEN v_attempt = 0 THEN v_base_username
        ELSE v_base_username || '_' || v_attempt::text
      END;
      BEGIN
        INSERT INTO public.users (id, username)
        VALUES (r.id, v_username);
        v_inserted := true;
        RAISE NOTICE 'Backfilled public.users row for % (%)', r.email, v_username;
      EXCEPTION WHEN unique_violation THEN
        v_attempt := v_attempt + 1;
      END;
    END LOOP;

    IF NOT v_inserted THEN
      RAISE WARNING 'Could not backfill public.users for % (%)', r.id, r.email;
    END IF;
  END LOOP;
END $$;
