-- ============================================
-- VEX-Timeline: 允许赛队成员互相查看 username
-- ============================================
-- 背景：
--   原 users_select_own 策略只允许 auth.uid() = id，
--   导致 timeline_members.users(username) 关系 join 时
--   其他成员的 username 被 RLS 过滤为 null，
--   前端"管理赛队"成员列表全部显示成"未知"。
--
--   本迁移新增一条策略：当目标 user 与当前用户
--   共享至少一个 timeline（owner 或 member）时，
--   允许 SELECT 对方的 username。
--
-- 影响：
--   users 表只有 id / username / created_at 三个字段，
--   不存在敏感数据；范围限制在同一赛队成员之间。
--
-- 性能：
--   (timeline_id, user_id) 已有 UNIQUE 索引（见 001 第 30 行），
--   两次 user_id 过滤都能走索引扫描。
-- ============================================

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
