# 赛队时间轴权限管理系统 Spec

## Why
当前 VEX-Timeline 的赛队时间轴只有 `owner` / `member` 两种角色，权限粒度过粗：无法区分"仅查看"的访客/家长、"可编辑但不能管成员"的队员、以及"拥有全部管理权限"的老师/队长。同时缺少用户层级的真实姓名与身份信息（学生/老师），无法在赛队成员列表中准确识别人员。需要建立两级权限体系：第一级是用户身份（学生/老师），第二级是赛队内角色（队长/老师/队员/访客/家长），并修正成员管理 UI 与下拉菜单的若干历史问题。

## What Changes
- 新增用户字段：`nickname`（昵称）、`real_name`（真实姓名）、`name_only_surname`（老师仅填姓标志）、`identity`（`student` / `teacher`）
- 在注册与登录流程中强制填充上述字段；老师身份支持"只填姓"模式（`real_name` 仅 1 个字符时视为合法）
- 老用户在新版本首次进入时间轴应用时，强制弹窗补全真实姓名与身份，未补全前不能使用
- 扩展 `timeline_members.role` 枚举：`owner` / `captain` / `teacher` / `member` / `visitor`
  - `owner`：时间轴创建者，拥有全部权限（管理成员、删除时间轴、调整角色、增删改记录）
  - `captain`：队长，拥有全部权限（同 owner，但不可删除时间轴本身）
  - `teacher`：老师，拥有全部权限（同 captain）
  - `member`：队员，可查看/编辑赛队内所有时间轴记录，但**不能**删除/添加成员、不能删除时间轴
  - `visitor`（访客/家长）：仅查看权限，不能增删改任何记录、不能管理成员
- 赛队成员管理 UI：在每个成员行的删除按钮**前**增加角色下拉菜单（`owner` / `captain` / `teacher` / `member` / `visitor`），默认 `member`；删除按钮改为 X 图标（无文字）
- 修正下拉菜单与"管理赛队"按钮的多端行为：
  - 手机端下拉菜单：所有人可见"管理赛队"选项（原：仅 owner 可见），并新增"关闭"选项
  - 个人时间轴内：所有设备端**均不显示**"管理赛队"选项
  - 删除"请切换到赛队"提示弹窗（仅当用户已在某个赛队内时才显示"管理赛队"按钮）
  - "管理赛队"弹窗内容根据当前用户在赛队内的角色动态变化：owner 可看到删除赛队、调整成员角色、移除成员；captain/teacher 可看到调整成员角色、移除成员；member/visitor 仅看到成员列表
- 赛队成员列表的"显示名"统一为真实姓名（若有），否则回退到昵称或用户名
- 调整 Supabase RLS 策略以支持新的角色枚举
- **BREAKING** `timeline_members.role` 字段值集合从 `{owner, member}` 扩展为 `{owner, captain, teacher, member, visitor}`；所有 `role = 'owner'` 的判定逻辑保持兼容
- **BREAKING** 删除按钮从文字"删除"/`移除` 改为 X 图标，依赖旧文字定位的选择器需更新

## Impact
- Affected specs:
  - `add-supabase-auth-cloud-sync`（用户表 schema 扩展；`timeline_members` 角色扩展）
  - `mobile-ui-and-auth-cleanup`（删除按钮变 X；管理赛队按钮的可见性逻辑变化）
  - `homepage-and-i18n`（登录/注册表单新增字段；i18n key 扩展）
  - `vex-timeline`（间接：管理弹窗内容随权限变化）
- Affected code:
  - `supabase/migrations/004_user_profile_and_role_expansion.sql`（**新**）— `users` 表新增字段；`timeline_members.role` 扩展 CHECK 约束
  - `supabase/migrations/005_member_management_rls.sql`（**新**）— owner/captain/teacher 可更新/删除成员；member/visitor 仅 SELECT
  - `src/js/auth.js` — 注册/登录流程增加 nickname / real_name / identity 字段；首次登录检测老用户
  - `src/js/cloud-db.js` — 新增 `updateMemberRole()`、`getMemberRole()`；`getTimelineMembers()` 联表 users 拉取真实姓名/昵称
  - `src/js/app.js` — 渲染成员管理 UI：角色下拉菜单 + X 按钮；个人时间轴隐藏管理赛队；手机下拉新增"关闭"
  - `src/js/i18n.js` — 新增 `auth.*` 字段（昵称/真实姓名/身份/老师仅填姓 等）的 i18n key
  - `index.html` — 登录/注册表单新增 nickname / real_name / identity 字段；老用户强制补全弹窗；成员管理 UI
  - `src/css/styles.css` — 角色下拉菜单与 X 按钮的样式
- 不动：PWA / Service Worker / 首页结构 / 月历 / 时间轴渲染核心

## ADDED Requirements

### Requirement: 用户资料扩展
系统 SHALL 在 `public.users` 表中存储 nickname、real_name、name_only_surname、identity 四个字段。

#### Scenario: 注册时填写完整资料
- **WHEN** 新用户注册
- **THEN** 必须提供 nickname（昵称）、real_name（真实姓名）、identity（`student` 或 `teacher`）；老师可勾选"仅填姓"，此时 real_name 只接受 1 个字符

#### Scenario: 老师仅填姓
- **WHEN** 用户选择 `identity = teacher` 且勾选"仅填姓"
- **THEN** 真实姓名字段接受单字符；保存时 `name_only_surname = true`

#### Scenario: 学生必须填完整姓名
- **WHEN** 用户选择 `identity = student`
- **THEN** 真实姓名至少 2 个字符；不能勾选"仅填姓"

#### Scenario: 老用户强制补全
- **WHEN** 老用户（注册时未填真实姓名/身份）首次登录新版本
- **THEN** 应用启动时检测到 `users.real_name IS NULL OR users.identity IS NULL`，弹出强制补全弹窗；未补全前不显示主时间轴内容
- **THEN** 补全完成或用户主动跳过（仅展示身份选择）后才能继续使用

### Requirement: 赛队角色枚举扩展
系统 SHALL 支持赛队时间轴的五种角色：`owner`、`captain`、`teacher`、`member`、`visitor`。

#### Scenario: 角色默认值
- **WHEN** 用户通过邀请码加入赛队
- **THEN** 默认 `role = 'member'`

#### Scenario: 创建赛队时所有者角色
- **WHEN** 用户创建赛队时间轴
- **THEN** 创建者在 `timeline_members` 中的角色为 `owner`（不可降级为其他角色）

#### Scenario: 角色调整
- **WHEN** 时间轴内具有管理权限的用户（owner / captain / teacher）在成员管理中调整某成员角色
- **THEN** 该成员的角色在 `timeline_members.role` 中更新

### Requirement: 角色权限矩阵
系统 SHALL 按以下矩阵控制赛队时间轴的操作权限：

| 操作 | owner | captain | teacher | member | visitor |
|------|-------|---------|---------|--------|---------|
| 查看时间轴记录 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 添加记录 | ✓ | ✓ | ✓ | ✓ | ✗ |
| 编辑自己的记录 | ✓ | ✓ | ✓ | ✓ | ✗ |
| 编辑他人的记录 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 删除自己的记录 | ✓ | ✓ | ✓ | ✓ | ✗ |
| 删除他人的记录 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 查看成员列表 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 调整成员角色 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 移除成员 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 生成/重置邀请码 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 删除整个时间轴 | ✓ | ✗ | ✗ | ✗ | ✗ |

#### Scenario: visitor 不可添加记录
- **WHEN** visitor 角色用户尝试添加记录
- **THEN** UI 上隐藏"添加记录"按钮；即使绕过 UI 直接调用 API，Supabase RLS 也拒绝 INSERT

#### Scenario: member 不可删除他人记录
- **WHEN** member 角色用户尝试删除他人记录
- **THEN** UI 上隐藏删除按钮；RLS 拒绝 DELETE

#### Scenario: member 不可调整角色
- **WHEN** member 角色用户查看成员列表
- **THEN** 不显示角色下拉菜单与删除按钮

### Requirement: 成员管理 UI
系统 SHALL 在赛队管理弹窗中为每个成员行提供：身份标识（真实姓名/昵称）、角色下拉菜单、X 删除按钮。

#### Scenario: 角色下拉菜单
- **WHEN** owner/captain/teacher 查看成员列表
- **THEN** 每个成员行（owner 行除外）显示一个角色下拉菜单，包含 `captain` / `teacher` / `member` / `visitor` 四个选项
- **THEN** 默认值为 `member`；切换后立即保存到 Supabase

#### Scenario: 角色下拉对 owner 禁用
- **WHEN** 成员列表中显示 owner 行
- **THEN** 该行不显示下拉菜单与 X 按钮（owner 不可被降级或移除）

#### Scenario: 删除按钮改为 X
- **WHEN** 成员行显示删除入口
- **THEN** 使用 X 图标（lucide `x` 或等价 SVG），不显示任何文字；点击后弹出确认对话框

#### Scenario: 显示真实姓名
- **WHEN** 成员列表/管理弹窗中显示成员
- **THEN** 优先显示 `users.real_name`；若 `name_only_surname = true` 则显示为"X 老师/家长"（其中 X 为 real_name）；若 real_name 为空则回退到 nickname，再回退到 username

### Requirement: 下拉菜单与"管理赛队"按钮的多端修正
系统 SHALL 按以下规则统一下拉菜单与管理赛队按钮的可见性：

#### Scenario: 手机端下拉菜单
- **WHEN** 用户在手机端打开头像下拉菜单
- **THEN** 所有用户均看到"管理赛队"选项（原：仅 owner 可见）
- **THEN** 菜单底部新增"关闭"选项，点击关闭下拉菜单

#### Scenario: 桌面端下拉菜单
- **WHEN** 用户在桌面端打开头像下拉菜单
- **THEN** 所有人均看到"管理赛队"选项（与手机端一致；原行为已正确，保留）
- **THEN** "关闭"选项不强制（保留关闭已有逻辑即可）

#### Scenario: 个人时间轴隐藏管理赛队
- **WHEN** 当前选中的是个人时间轴
- **THEN** 所有设备端均**不显示**"管理赛队"选项

#### Scenario: 赛队时间轴显示管理赛队
- **WHEN** 当前选中的是赛队时间轴
- **THEN** 所有用户均显示"管理赛队"按钮；点击后弹窗内容根据当前用户在赛队中的角色动态渲染

#### Scenario: 删除"请切换到赛队"弹窗
- **WHEN** 任何用户在任何位置尝试访问"管理赛队"
- **THEN** 不再出现"请先切换到赛队时间轴"的提示弹窗（因个人时间轴下根本不显示该按钮）

### Requirement: 管理赛队弹窗的内容按角色渲染
系统 SHALL 根据当前用户在赛队中的角色动态渲染"管理赛队"弹窗内容。

#### Scenario: owner 看到的弹窗
- **WHEN** owner 打开管理赛队弹窗
- **THEN** 显示：成员列表（含角色下拉与 X 按钮）、邀请码、重置邀请码按钮、删除赛队按钮

#### Scenario: captain / teacher 看到的弹窗
- **WHEN** captain 或 teacher 打开管理赛队弹窗
- **THEN** 显示：成员列表（含角色下拉与 X 按钮）、邀请码、重置邀请码按钮
- **THEN** **不显示**"删除赛队"按钮

#### Scenario: member 看到的弹窗
- **WHEN** member 打开管理赛队弹窗
- **THEN** 显示：成员列表（只读，不显示下拉/X）、邀请码（只读）
- **THEN** **不显示**角色下拉、X 按钮、删除赛队按钮、重置邀请码按钮

#### Scenario: visitor 看到的弹窗
- **WHEN** visitor 打开管理赛队弹窗
- **THEN** 显示：成员列表（只读）
- **THEN** **不显示**邀请码、下拉、X 按钮、删除赛队按钮

## MODIFIED Requirements

### Requirement: 注册流程
原"仅基于用户名的注册"修改为：注册时必须提供 username + nickname + real_name + identity；老师支持仅填姓。

### Requirement: 登录流程
原"输入用户名登录"修改为：登录时若检测到 `real_name` 或 `identity` 为空，登录成功后在进入主应用前弹出补全弹窗。

### Requirement: 赛队成员管理（owner）
原"所有者管理成员"修改为：owner、captain、teacher 均可调整成员角色与移除成员；owner 额外拥有删除整个赛队时间轴的权限。

### Requirement: 删除按钮
原"移除成员按钮"修改为：使用 X 图标，无文字标签；点击后弹出确认对话框。

### Requirement: 成员列表显示
原"成员列表"修改为：显示名优先使用真实姓名（老师仅显示姓 + "老师"）；真实姓名为空时回退到昵称/用户名。

## REMOVED Requirements

### Requirement: "请切换到赛队"提示弹窗
**Reason**: 既然个人时间轴下根本不显示"管理赛队"按钮，该提示弹窗成为死代码。
**Migration**: 直接删除相关 DOM 与 JS 引用；手机端下拉菜单统一显示管理赛队选项。

### Requirement: 文字版"删除"按钮
**Reason**: 删除按钮改为 X 图标以节省空间。
**Migration**: 用 lucide `x` 图标替换文字"删除"；保留确认对话框。

## Supabase 数据库变更

### 新增迁移 `004_user_profile_and_role_expansion.sql`

```sql
-- 1. 扩展 users 表
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS real_name text,
  ADD COLUMN IF NOT EXISTS name_only_surname boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity text CHECK (identity IN ('student', 'teacher'));

-- 2. 扩展 timeline_members.role 枚举
ALTER TABLE public.timeline_members
  DROP CONSTRAINT IF EXISTS timeline_members_role_check;
ALTER TABLE public.timeline_members
  ADD CONSTRAINT timeline_members_role_check
  CHECK (role IN ('owner', 'captain', 'teacher', 'member', 'visitor'));

-- 3. 已有数据迁移（如果需要）
-- 现有 owner 保持 owner；现有 member 保持 member
```

### 新增迁移 `005_member_management_rls.sql`

```sql
-- 成员管理权限：owner / captain / teacher 可 UPDATE/DELETE 其他成员
CREATE POLICY "timeline_members_update_privileged" ON public.timeline_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members tm
      WHERE tm.timeline_id = timeline_members.timeline_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'captain', 'teacher')
    )
  );

CREATE POLICY "timeline_members_delete_privileged" ON public.timeline_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members tm
      WHERE tm.timeline_id = timeline_members.timeline_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'captain', 'teacher')
    )
  );

-- visitor 不可 INSERT records
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

-- visitor 不可 UPDATE/DELETE records
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
```

### 修改注册 RPC 函数
扩展 `register(username, nickname, real_name, name_only_surname, identity)` 入参，存储到 `public.users`；老用户调用 `complete_profile(nickname, real_name, name_only_surname, identity)` RPC 补全资料。

## 技术方案（概要）

### UI 渲染逻辑
- 在 `cloud-db.js` 中新增 `getMemberRole(timelineId, userId)` 辅助方法
- 在 `app.js` 中维护 `currentTimelineRole` 状态；进入赛队时间轴时拉取并缓存
- 成员管理弹窗按 `currentTimelineRole` 条件渲染：owner → 全部；captain/teacher → 无删除赛队；member → 只读；visitor → 极简
- 角色下拉菜单使用原生 `<select>` 或自定义 dropdown（与 Nothing 风格一致：黑色边框 + 白底）
- X 按钮：lucide `x` 图标 16×16px，hover 时变红

### 显示名解析
```js
function getDisplayName(user) {
  if (user.real_name) {
    if (user.name_only_surname) {
      return `${user.real_name}老师`; // 或 `家长`，按 identity 区分
    }
    return user.real_name;
  }
  if (user.nickname) return user.nickname;
  return user.username;
}
```

### 老用户补全弹窗
- 在 `app.js` 的 `init()` 中检测当前用户 `real_name`/`identity` 是否为空
- 若为空且 `localStorage["vex.profile_completed"]` 不为 `true`，弹出强制补全 modal
- 提供"跳过"按钮（仅在 identity 已存在时可用），跳过则写入标记位
