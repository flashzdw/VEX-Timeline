-- ============================================
-- VEX-Timeline: Add 'parent' identity to first-level permission
-- ============================================
-- 背景：
--   一级权限在原 004 迁移中只有 student / teacher 两种。
--   业务侧（VEX 赛队）需要把"家长"也作为一种身份，
--   - 家长可以注册/补全身份
--   - 家长加入赛队时默认 visitor（由队长手动调整）
--   - 家长"仅填姓"逻辑与老师一致：1 字符
--
-- 影响：
--   1. users.identity CHECK 扩到 {student, teacher, parent}
--   2. complete_profile RPC 重新创建，允许 parent + 家长仅填姓 1 字符
--
-- 兼容性：
--   已有数据不受影响（不会修改任何已有行的 identity）
-- ============================================

-- ------------------------------------------
-- 1. users.identity CHECK 扩展
-- ------------------------------------------
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_identity_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_identity_check
  CHECK (identity IN ('student', 'teacher', 'parent'));

-- ------------------------------------------
-- 2. complete_profile RPC 重建
--    接受 parent 身份；家长与老师共享"仅填姓"逻辑
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_profile(
  p_nickname          text,
  p_real_name         text,
  p_name_only_surname boolean,
  p_identity          text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  -- 身份枚举校验（包含新加的 parent）
  IF p_identity NOT IN ('student', 'teacher', 'parent') THEN
    RAISE EXCEPTION '身份必须是 student / teacher / parent';
  END IF;

  -- 真实姓名非空
  IF length(trim(COALESCE(p_real_name, ''))) = 0 THEN
    RAISE EXCEPTION '真实姓名不能为空';
  END IF;

  -- 老师 / 家长 仅填姓时：1 字符即可
  IF p_identity IN ('teacher', 'parent') AND COALESCE(p_name_only_surname, false) THEN
    IF length(trim(p_real_name)) <> 1 THEN
      RAISE EXCEPTION '仅填姓时，姓名必须是 1 个字符';
    END IF;
  ELSIF p_identity = 'student' AND length(trim(p_real_name)) < 2 THEN
    RAISE EXCEPTION '学生姓名至少 2 个字符';
  ELSIF p_identity IN ('teacher', 'parent') AND length(trim(p_real_name)) < 2 THEN
    RAISE EXCEPTION '姓名至少 2 个字符';
  END IF;

  UPDATE public.users
     SET nickname          = trim(p_nickname),
         real_name         = trim(p_real_name),
         name_only_surname = COALESCE(p_name_only_surname, false),
         identity          = p_identity
   WHERE id = v_uid;
END;
$$;
