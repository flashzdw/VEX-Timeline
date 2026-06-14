-- ============================================
-- VEX-Timeline: Backfill nickname from username
-- ============================================
-- 背景：
--   004 迁移给 users 表新增了 nickname 字段，但老用户在该字段上为 NULL。
--   老版本根本没有"昵称"概念，UI 上直接用 username 作为显示名。
--   强弹"完善资料"时如果再让老用户手填 nickname，会显得多余且不友好。
--   直接把 username 回填到 nickname 即可。
--
-- 行为：
--   - 已有 nickname（注册时填过）→ 保留原值
--   - 没有 nickname 但有 username → 回填为 username
--   - username 为 NULL（理论上不应发生）→ 跳过
-- ============================================

UPDATE public.users
   SET nickname = username
 WHERE (nickname IS NULL OR nickname = '')
   AND username IS NOT NULL;
