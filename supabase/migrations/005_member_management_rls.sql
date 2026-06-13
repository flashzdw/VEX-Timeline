-- ============================================
-- VEX-Timeline: Member Management RLS Policies
-- ============================================
-- 背景：
--   原 RLS 策略只允许 timeline owner 调整 / 删除成员，
--   本次扩展为 owner / captain / teacher 均有权限（角色矩阵见 spec.md）。
--   同时收紧 records 表的写权限：
--     - visitor 不可 INSERT / UPDATE / DELETE 任何记录
--     - member 不可 UPDATE / DELETE 他人记录
-- ============================================

-- ------------------------------------------
-- 1. timeline_members_update: 替换原 owner-only 策略
-- ------------------------------------------
DROP POLICY IF EXISTS "timeline_members_update" ON public.timeline_members;
DROP POLICY IF EXISTS "timeline_members_update_privileged" ON public.timeline_members;

CREATE POLICY "timeline_members_update_privileged" ON public.timeline_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members tm
      WHERE tm.timeline_id = timeline_members.timeline_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'captain', 'teacher')
    )
  );

-- ------------------------------------------
-- 2. timeline_members_delete: 替换原 owner-only 策略
-- ------------------------------------------
DROP POLICY IF EXISTS "timeline_members_delete" ON public.timeline_members;
DROP POLICY IF EXISTS "timeline_members_delete_privileged" ON public.timeline_members;

CREATE POLICY "timeline_members_delete_privileged" ON public.timeline_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members tm
      WHERE tm.timeline_id = timeline_members.timeline_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'captain', 'teacher')
    )
  );

-- ------------------------------------------
-- 3. records: visitor 不可 INSERT
--    替换原 records_insert 策略
-- ------------------------------------------
DROP POLICY IF EXISTS "records_insert" ON public.records;

CREATE POLICY "records_insert_non_visitor" ON public.records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );

-- ------------------------------------------
-- 4. records: visitor 不可 UPDATE
--    member 仅可 UPDATE 自己的记录
--    owner / captain / teacher 可 UPDATE 任何记录
-- ------------------------------------------
DROP POLICY IF EXISTS "records_update" ON public.records;

CREATE POLICY "records_update_privileged" ON public.records
  FOR UPDATE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );

-- ------------------------------------------
-- 5. records: visitor 不可 DELETE
--    member 仅可 DELETE 自己的记录
--    owner / captain / teacher 可 DELETE 任何记录
-- ------------------------------------------
DROP POLICY IF EXISTS "records_delete" ON public.records;

CREATE POLICY "records_delete_privileged" ON public.records
  FOR DELETE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );

-- ------------------------------------------
-- 6. timelines_delete: 维持 owner-only
--    仅 owner 可删除整个时间轴（captain / teacher 也不行）
-- ------------------------------------------
-- 原策略 timeline_members_delete 不影响 timelines 表；
-- timelines_delete 策略保持 001 定义：owner_id = auth.uid()
-- 不在本迁移中修改。
