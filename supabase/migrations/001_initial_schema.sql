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

-- users: INSERT new user row only for themselves
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

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

-- Auto-create public.users row + personal timeline when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := NEW.raw_user_meta_data->>'username';

  IF v_username IS NOT NULL THEN
    INSERT INTO public.users (id, username)
    VALUES (NEW.id, v_username)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.timelines (name, type, owner_id)
  VALUES ('个人时间轴', 'personal', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

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

DROP TRIGGER IF EXISTS on_timeline_created ON public.timelines;
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

DROP TRIGGER IF EXISTS on_record_update ON public.records;
CREATE TRIGGER on_record_update
  BEFORE UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.handle_record_update();

-- ------------------------------------------
-- 5. Storage Bucket
-- ------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('record-images', 'record-images', true)
ON CONFLICT (id) DO NOTHING;