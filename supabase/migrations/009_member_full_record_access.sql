-- ============================================
-- VEX-Timeline: 放开 member 对赛队内记录的写权限
-- ============================================
-- 背景：
--   原 005_member_management_rls.sql 把 member 限定为「仅可改/删自己发布的记录」。
--   实际上赛队中的 member 应当可以访问（看到）和维护整个赛队的时间轴，
--   即可以改/删任何人的记录（与 owner/captain/teacher 等权）。
--   visitor 仍然没有任何写权限。
-- ============================================

-- ------------------------------------------
-- 1. records: member 放开 UPDATE 限制
-- ------------------------------------------
DROP POLICY IF EXISTS "records_update_privileged" ON public.records;

CREATE POLICY "records_update_privileged" ON public.records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );

-- ------------------------------------------
-- 2. records: member 放开 DELETE 限制
-- ------------------------------------------
DROP POLICY IF EXISTS "records_delete_privileged" ON public.records;

CREATE POLICY "records_delete_privileged" ON public.records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );
