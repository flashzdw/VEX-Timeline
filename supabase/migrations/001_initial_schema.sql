-- ============================================
-- VEX-Timeline: Initial Schema Migration
-- ============================================

-- ------------------------------------------
-- 1. Tables
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('personal', 'team')),
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  invite_code text UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.timeline_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid REFERENCES public.timelines(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (timeline_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid REFERENCES public.timelines(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  date date NOT NULL,
  time text,
  title text NOT NULL,
  content text,
  importance text DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ------------------------------------------
-- 2. Row Level Security
-- ------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- 3. RLS Policies
-- ------------------------------------------

-- users: SELECT for own row only
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- timelines: SELECT for owner or member, or if invite_code matches (for joining)
CREATE POLICY "timelines_select" ON public.timelines
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = timelines.id AND user_id = auth.uid()
    )
    OR invite_code IS NOT NULL
  );

-- timelines: INSERT for owner only
CREATE POLICY "timelines_insert" ON public.timelines
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- timelines: UPDATE for owner only
CREATE POLICY "timelines_update" ON public.timelines
  FOR UPDATE USING (owner_id = auth.uid());

-- timelines: DELETE for owner only
CREATE POLICY "timelines_delete" ON public.timelines
  FOR DELETE USING (owner_id = auth.uid());

-- timeline_members: SELECT for members of same timeline
CREATE POLICY "timeline_members_select" ON public.timeline_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members tm
      WHERE tm.timeline_id = timeline_members.timeline_id AND tm.user_id = auth.uid()
    )
  );

-- timeline_members: INSERT for timeline owner OR self-join via invite code
CREATE POLICY "timeline_members_insert" ON public.timeline_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timelines t
      WHERE t.id = timeline_members.timeline_id AND t.owner_id = auth.uid()
    )
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.timelines t
        WHERE t.id = timeline_members.timeline_id AND t.type = 'team' AND t.invite_code IS NOT NULL
      )
    )
  );

-- timeline_members: UPDATE for timeline owner
CREATE POLICY "timeline_members_update" ON public.timeline_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.timelines t
      WHERE t.id = timeline_members.timeline_id AND t.owner_id = auth.uid()
    )
  );

-- timeline_members: DELETE for timeline owner
CREATE POLICY "timeline_members_delete" ON public.timeline_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.timelines t
      WHERE t.id = timeline_members.timeline_id AND t.owner_id = auth.uid()
    )
  );

-- records: SELECT for members of same timeline
CREATE POLICY "records_select" ON public.records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id AND user_id = auth.uid()
    )
  );

-- records: INSERT for members
CREATE POLICY "records_insert" ON public.records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id AND user_id = auth.uid()
    )
  );

-- records: UPDATE for record creator only
CREATE POLICY "records_update" ON public.records
  FOR UPDATE USING (user_id = auth.uid());

-- records: DELETE for record creator or timeline owner
CREATE POLICY "records_delete" ON public.records
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.timelines t
      WHERE t.id = records.timeline_id AND t.owner_id = auth.uid()
    )
  );

-- ------------------------------------------
-- 4. Triggers
-- ------------------------------------------

-- Auto-create personal timeline when a new user is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.timelines (name, type, owner_id)
  VALUES ('个人时间轴', 'personal', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add owner as member when a new timeline is inserted
CREATE OR REPLACE FUNCTION public.handle_new_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.timeline_members (timeline_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_timeline_created
  AFTER INSERT ON public.timelines
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_timeline();

-- Auto-update updated_at on records
CREATE OR REPLACE FUNCTION public.handle_record_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_record_update
  BEFORE UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_update();

-- ------------------------------------------
-- 5. Storage Bucket
-- ------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('record-images', 'record-images', true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------
-- 6. Extensions
-- ------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

-- ------------------------------------------
-- 7. RPC: register(p_username text)
-- ------------------------------------------

CREATE OR REPLACE FUNCTION public.register(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_user_id uuid;
  v_user record;
  v_token text;
  v_refresh_token text;
  v_jwt_secret text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
    RAISE EXCEPTION 'Username already exists' USING ERRCODE = '23505';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_username || '@vex-timeline.local',
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    now(),
    '{"provider":"username","providers":["username"]}',
    json_build_object('username', p_username),
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO public.users (id, username)
  VALUES (v_user_id, p_username)
  RETURNING * INTO v_user;

  v_jwt_secret := current_setting('app.jwt_secret', true);

  IF v_jwt_secret IS NOT NULL AND v_jwt_secret != '' THEN
    v_token := sign(
      json_build_object(
        'sub', v_user_id::text,
        'role', 'authenticated',
        'aud', 'authenticated',
        'iat', extract(epoch from now())::integer,
        'exp', extract(epoch from now() + interval '1 hour')::integer
      )::jsonb,
      v_jwt_secret
    );
    v_refresh_token := encode(extensions.gen_random_bytes(32), 'hex');
  ELSE
    v_token := '';
    v_refresh_token := '';
  END IF;

  RETURN json_build_object(
    'user', row_to_json(v_user),
    'access_token', v_token,
    'refresh_token', v_refresh_token
  );
END;
$func$;

-- ------------------------------------------
-- 8. RPC: login(p_username text)
-- ------------------------------------------

CREATE OR REPLACE FUNCTION public.login(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
DECLARE
  v_user record;
  v_token text;
  v_refresh_token text;
  v_jwt_secret text;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE username = p_username;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_jwt_secret := current_setting('app.jwt_secret', true);

  IF v_jwt_secret IS NULL OR v_jwt_secret = '' THEN
    RAISE EXCEPTION 'JWT secret not configured. Run: ALTER DATABASE postgres SET app.jwt_secret TO ''your-jwt-secret''';
  END IF;

  v_token := sign(
    json_build_object(
      'sub', v_user.id::text,
      'role', 'authenticated',
      'aud', 'authenticated',
      'iat', extract(epoch from now())::integer,
      'exp', extract(epoch from now() + interval '1 hour')::integer
    )::jsonb,
    v_jwt_secret
  );

  v_refresh_token := encode(extensions.gen_random_bytes(32), 'hex');

  RETURN json_build_object(
    'user', row_to_json(v_user),
    'access_token', v_token,
    'refresh_token', v_refresh_token
  );
END;
$func$;
