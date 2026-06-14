-- ============================================
-- VEX-Timeline: Auth Trigger Update for Profile Fields
-- ============================================
-- 背景：
--   原 handle_new_auth_user 触发器只从 raw_user_meta_data 读 username，
--   本次扩展为同时读 nickname / real_name / name_only_surname / identity
--   并写入 public.users 对应字段。
--
-- 兼容性：
--   老用户（meta_data 中无新字段）注册时新字段为 NULL，
--   前端会通过 complete_profile RPC 补全。
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_nickname text;
  v_real_name text;
  v_name_only_surname boolean;
  v_identity text;
BEGIN
  v_username         := NEW.raw_user_meta_data->>'username';
  v_nickname         := NEW.raw_user_meta_data->>'nickname';
  v_real_name        := NEW.raw_user_meta_data->>'real_name';
  v_name_only_surname := COALESCE((NEW.raw_user_meta_data->>'name_only_surname')::boolean, false);
  v_identity         := NEW.raw_user_meta_data->>'identity';

  IF v_username IS NOT NULL THEN
    INSERT INTO public.users (id, username, nickname, real_name, name_only_surname, identity)
    VALUES (NEW.id, v_username, v_nickname, v_real_name, v_name_only_surname, v_identity)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 创建个人时间轴（保持原行为）
  INSERT INTO public.timelines (name, type, owner_id)
  VALUES ('个人时间轴', 'personal', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------
-- complete_profile RPC：供老用户补全资料
-- ------------------------------------------
-- 入参：
--   p_nickname         text
--   p_real_name        text
--   p_name_only_surname boolean
--   p_identity         text
-- 行为：
--   1. 校验 identity 必须是 'student' 或 'teacher'
--   2. 校验 real_name 长度
--   3. 校验 identity=student 时 real_name >= 2 字符
--   4. 校验 identity=teacher 且 name_only_surname=true 时 real_name = 1 字符
--   5. 更新 public.users 记录
-- 权限：
--   auth.uid() = id（只能补全自己）
-- ------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_profile(
  p_nickname text,
  p_real_name text,
  p_name_only_surname boolean,
  p_identity text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  -- 校验 identity
  IF p_identity NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION '身份必须是 student 或 teacher';
  END IF;

  -- 校验 real_name
  IF p_real_name IS NULL OR length(trim(p_real_name)) = 0 THEN
    RAISE EXCEPTION '请填写真实姓名';
  END IF;

  -- 学生：必须填完整姓名
  IF p_identity = 'student' AND length(trim(p_real_name)) < 2 THEN
    RAISE EXCEPTION '学生姓名至少 2 个字符';
  END IF;

  -- 老师仅填姓：real_name 必须是 1 个字符
  IF p_identity = 'teacher' AND p_name_only_surname = true AND length(trim(p_real_name)) <> 1 THEN
    RAISE EXCEPTION '老师仅填姓时，姓名必须是 1 个字符';
  END IF;

  -- 老师不勾选仅填姓：real_name >= 2 字符
  IF p_identity = 'teacher' AND p_name_only_surname = false AND length(trim(p_real_name)) < 2 THEN
    RAISE EXCEPTION '老师姓名至少 2 个字符';
  END IF;

  -- 校验 nickname
  IF p_nickname IS NULL OR length(trim(p_nickname)) = 0 THEN
    RAISE EXCEPTION '请填写昵称';
  END IF;

  UPDATE public.users
  SET nickname = trim(p_nickname),
      real_name = trim(p_real_name),
      name_only_surname = COALESCE(p_name_only_surname, false),
      identity = p_identity
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户记录不存在';
  END IF;
END;
$$;

-- 授权：authenticated 用户可调用
GRANT EXECUTE ON FUNCTION public.complete_profile(text, text, boolean, text) TO authenticated;
