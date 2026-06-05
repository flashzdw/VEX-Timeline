-- ============================================
-- VEX-Timeline: Fix RLS Infinite Recursion
-- ============================================
-- 问题：timeline_members_select 策略用 EXISTS (SELECT FROM
-- timeline_members ...) 自引用；timelines/records 策略也直接查询
-- timeline_members → RLS 评估时形成无限递归 → PostgREST 返回
-- 500 (42P17 infinite recursion detected in policy)。
--
-- 修复思路：用 SECURITY DEFINER 函数绕过 RLS 来检查成员关系。
-- SECURITY DEFINER 以函数所有者（postgres）权限执行，RLS 不会被
-- 重新触发，从而打破递归。
-- ============================================

-- ------------------------------------------
-- 1. Helper functions (SECURITY DEFINER, bypasses RLS)
-- ------------------------------------------

-- Returns true when the current authenticated user is a member of the given timeline
CREATE OR REPLACE FUNCTION public.is_timeline_member(t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.timeline_members
    WHERE timeline_id = t_id AND user_id = auth.uid()
  );
$$;

-- Returns true when the current authenticated user owns the given timeline
CREATE OR REPLACE FUNCTION public.is_timeline_owner(t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.timelines
    WHERE id = t_id AND owner_id = auth.uid()
  );
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.is_timeline_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_timeline_owner(uuid) TO authenticated, anon;

-- ------------------------------------------
-- 2. Recreate timeline_members policies (no self-reference)
-- ------------------------------------------

DROP POLICY IF EXISTS "timeline_members_select" ON public.timeline_members;
CREATE POLICY "timeline_members_select" ON public.timeline_members
  FOR SELECT USING (
    -- The user is a member of this timeline, OR
    public.is_timeline_member(timeline_id)
    -- The user owns the timeline (owner can see all members)
    OR public.is_timeline_owner(timeline_id)
  );

-- Other timeline_members policies are already fine (they query
-- public.timelines, which we'll fix next, but the recursion only
-- happens on timeline_members itself).

-- ------------------------------------------
-- 3. Recreate timelines policies using helpers
-- ------------------------------------------

DROP POLICY IF EXISTS "timelines_select" ON public.timelines;
CREATE POLICY "timelines_select" ON public.timelines
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_timeline_member(id)
    OR (type = 'team' AND invite_code IS NOT NULL)
  );

-- timelines_insert / update / delete are already fine (no RLS recursion):
--   - insert: WITH CHECK (owner_id = auth.uid()) - no subquery
--   - update: USING (owner_id = auth.uid()) - no subquery
--   - delete: USING (owner_id = auth.uid()) - no subquery

-- ------------------------------------------
-- 4. Recreate records policies using helpers
-- ------------------------------------------

DROP POLICY IF EXISTS "records_select" ON public.records;
CREATE POLICY "records_select" ON public.records
  FOR SELECT USING (
    public.is_timeline_member(timeline_id)
  );

DROP POLICY IF EXISTS "records_insert" ON public.records;
CREATE POLICY "records_insert" ON public.records
  FOR INSERT WITH CHECK (
    public.is_timeline_member(timeline_id)
  );

-- records_update / delete are already fine:
--   - update: USING (user_id = auth.uid()) - no subquery
--   - delete: USING (user_id = auth.uid() OR EXISTS(...timelines...))
--     The timelines subquery won't recurse because timelines policy
--     now uses the helper, not a direct timeline_members query.

-- ------------------------------------------
-- 5. Recreate users policies (already safe, but keep consistent)
-- ------------------------------------------
-- users_select_own / users_insert_own use auth.uid() directly, no recursion.

-- ------------------------------------------
-- 6. Recreate storage.objects policies using helpers
-- ------------------------------------------

-- record_images_delete from migration 002:
--   EXISTS (SELECT 1 FROM public.timelines t WHERE t.owner_id = auth.uid())
-- This is fine now because the timelines_select policy uses helpers.

-- ------------------------------------------
-- 7. Verification query (commented out — uncomment to test)
-- ------------------------------------------
-- SELECT current_user, auth.uid();
-- SELECT public.is_timeline_member('00000000-0000-0000-0000-000000000000'::uuid);
