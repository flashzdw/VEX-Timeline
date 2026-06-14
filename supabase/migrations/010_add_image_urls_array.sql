-- ============================================
-- VEX-Timeline: 多图支持（一条记录 1~N 张图）
-- ============================================
-- Round 42：多图导入 + 图库 + 卡片详情
-- - 保留原 image_url 字段（向下兼容老客户端与老数据）
-- - 新增 image_urls TEXT[] 字段：1..N 张图 URL 数组
-- - 读时: 优先 image_urls；为空/null 时回退 image_url 单图
-- - 写时: 多图存 image_urls；如果只有 1 张也写 image_url = images[0] 兼容老客户端

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.records.image_urls IS '1..N 张图 URL 数组；为空/null 时回退 image_url 单图。Round 42 多图支持。';
