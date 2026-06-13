-- ============================================
-- VEX-Timeline: Add 'parent' identity to first-level permission
-- ============================================
-- 背景：
--   一级权限在原 004 迁移中只有 student / teacher 两种。
--   业务侧（VEX 赛队）需要把"家长"也作为一种身份：
--   - 家长可以注册/补全身份
--   - 家长加入赛队时默认 visitor（由队长手动调整）
--   - 家长填的是 **孩子的真实姓名**，前端会自动加"家长"后缀展示
--   - 家长不享受"surname-only" 逻辑（因为是孩子的全名，不是姓氏）
--
-- 影响：
--   1. users.identity CHECK 扩到 {student, teacher, parent}
--   2. complete_profile RPC 重新创建：
--      - 老师仍可"仅填姓"
--      - 家长必须 >= 2 字符（孩子全名），忽略 name_only_surname
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
--    - 学生：姓名 >= 2 字符
--    - 老师：可"仅填姓" 1 字符，否则 >= 2 字符
--    - 家长：强制 >= 2 字符（孩子全名），忽略 name_only_surname
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
  v_effective_surname boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  -- 身份枚举校验
  IF p_identity NOT IN ('student', 'teacher', 'parent') THEN
    RAISE EXCEPTION '身份必须是 student / teacher / parent';
  END IF;

  -- 真实姓名非空
  IF length(trim(COALESCE(p_real_name, ''))) = 0 THEN
    RAISE EXCEPTION '真实姓名不能为空';
  END IF;

  -- 家长：强制忽略 surname-only，强制要求 >= 2 字符（孩子全名）
  IF p_identity = 'parent' THEN
    v_effective_surname := false;
  ELSE
    v_effective_surname := COALESCE(p_name_only_surname, false);
  END IF;

  -- 老师 / 家长 仅填姓时：1 字符即可（家长在上面的判断里 v_effective_surname 一定是 false，所以这一段实际只命中老师）
  IF p_identity IN ('teacher', 'parent') AND v_effective_surname THEN
    IF length(trim(p_real_name)) <> 1 THEN
      RAISE EXCEPTION '仅填姓时，姓名必须是 1 个字符';
    END IF;
  ELSIF p_identity = 'student' AND length(trim(p_real_name)) < 2 THEN
    RAISE EXCEPTION '学生姓名至少 2 个字符';
  ELSIF p_identity IN ('teacher', 'parent') AND length(trim(p_real_name)) < 2 THEN
    RAISE EXCEPTION '姓名至少 2 个字符';
  END IF;

  -- 家长：保存时也强制把 name_only_surname 写为 false（避免数据脏）
  UPDATE public.users
     SET nickname          = trim(p_nickname),
         real_name         = trim(p_real_name),
         name_only_surname = CASE WHEN p_identity = 'parent' THEN false ELSE v_effective_surname END,
         identity          = p_identity
   WHERE id = v_uid;
END;
$$;
