-- ============================================
-- VEX-Timeline: User Profile & Role Expansion
-- ============================================
-- 背景：
--   1. 引入用户级身份信息：nickname / real_name / name_only_surname / identity
--      - 注册时强制填充（老师支持仅填姓）
--      - 老用户首次登录新版本时弹窗补全
--   2. 扩展 timeline_members.role 枚举为
--      {owner, captain, teacher, member, visitor}
--      - owner：创建者，拥有全部权限（含删除赛队）
--      - captain：队长，全部权限（不可删赛队）
--      - teacher：老师，全部权限（不可删赛队）
--      - member：队员，可增删改记录，不可管理成员
--      - visitor：访客/家长，仅可查看
--
-- 影响：
--   - users 表扩展 4 个字段
--   - timeline_members.role CHECK 约束扩展
--   - 老数据 owner / member 保持原值（不破坏现有关系）
-- ============================================

-- ------------------------------------------
-- 1. users 表扩展
-- ------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS real_name text,
  ADD COLUMN IF NOT EXISTS name_only_surname boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity text CHECK (identity IN ('student', 'teacher'));

-- ------------------------------------------
-- 2. timeline_members.role CHECK 扩展
-- ------------------------------------------
ALTER TABLE public.timeline_members
  DROP CONSTRAINT IF EXISTS timeline_members_role_check;

ALTER TABLE public.timeline_members
  ADD CONSTRAINT timeline_members_role_check
  CHECK (role IN ('owner', 'captain', 'teacher', 'member', 'visitor'));

-- ------------------------------------------
-- 3. users_select_team_members 策略扩展：
--    允许同一赛队成员查看彼此的 nickname / real_name / name_only_surname / identity
--    （原策略只允许 SELECT username）
--    安全性：仅共享同一 timeline 的成员之间可见，敏感字段均来自 users 表
-- ------------------------------------------
DROP POLICY IF EXISTS "users_select_team_members" ON public.users;

CREATE POLICY "users_select_team_members" ON public.users
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.timeline_members me
      JOIN public.timeline_members them
        ON them.timeline_id = me.timeline_id
      WHERE me.user_id   = auth.uid()
        AND them.user_id = users.id
    )
  );
