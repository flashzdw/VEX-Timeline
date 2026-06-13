# Tasks

- [x] Task 1: 数据库 schema 扩展与迁移
  - [x] SubTask 1.1: 创建迁移文件 `supabase/migrations/004_user_profile_and_role_expansion.sql`，在 `users` 表新增 `nickname` / `real_name` / `name_only_surname` / `identity` 字段
  - [x] SubTask 1.2: 在同一迁移文件中扩展 `timeline_members.role` CHECK 约束为 `{owner, captain, teacher, member, visitor}`
  - [x] SubTask 1.3: 创建迁移文件 `005_member_management_rls.sql`，更新成员管理 RLS 策略（owner/captain/teacher 可调整/移除成员）
  - [x] SubTask 1.4: 在同一迁移文件中更新 records 表 RLS：visitor 不可 INSERT/UPDATE/DELETE；member 不可改/删他人记录
  - [x] SubTask 1.5: 修改注册 RPC 函数接受新参数；新增 `complete_profile` RPC 供老用户补全资料
  - [x] SubTask 1.6: 在 Supabase 中执行两个迁移 SQL 并验证 schema

- [x] Task 2: 用户认证模块扩展
  - [x] SubTask 2.1: 在 `src/js/auth.js` 中扩展 `register()` 接受 `nickname` / `real_name` / `name_only_surname` / `identity` 参数
  - [x] SubTask 2.2: 在 `src/js/auth.js` 中扩展 `login()` 返回当前用户的 `real_name` / `identity`，便于前端判断是否需要补全弹窗
  - [x] SubTask 2.3: 在 `src/js/auth.js` 中新增 `completeProfile()` 调用 `complete_profile` RPC
  - [x] SubTask 2.4: 在 `src/js/auth.js` 中实现 `needsProfileCompletion()`，检测当前用户 `real_name` 或 `identity` 是否为空

- [x] Task 3: 登录/注册 UI 增加新字段
  - [x] SubTask 3.1: 在 `index.html` 的注册表单中新增：昵称输入框、真实姓名输入框、身份单选（学生/老师）、老师"仅填姓"复选框
  - [x] SubTask 3.2: 在 `index.html` 的登录表单中保留极简模式（仅用户名），但登录成功后根据 `needsProfileCompletion()` 决定是否弹出补全弹窗
  - [x] SubTask 3.3: 在 `index.html` 中新增"补全资料"弹窗 DOM（昵称/真实姓名/身份/仅填姓）
  - [x] SubTask 3.4: 在 `src/css/styles.css` 中为新字段/单选/复选框添加 Nothing 风格样式
  - [x] SubTask 3.5: 在 `src/js/i18n.js` 中添加新字段的 i18n key（中/英）

- [x] Task 4: 老用户强制补全流程
  - [x] SubTask 4.1: 在 `src/js/app.js` 的 `init()` 中登录后调用 `needsProfileCompletion()`，若返回 true 则显示补全弹窗
  - [x] SubTask 4.2: 实现补全弹窗的"提交"逻辑：调用 `completeProfile()`，成功后关闭弹窗并刷新用户信息
  - [x] SubTask 4.3: 实现补全弹窗的"跳过"逻辑（仅当 `identity` 已存在时可用）：写入 `localStorage["vex.profile_completed"] = true`
  - [x] SubTask 4.4: 补全完成前主时间轴内容不渲染（防止不完整数据污染展示）

- [x] Task 5: 赛队角色枚举与权限管理（数据层）
  - [x] SubTask 5.1: 在 `src/js/cloud-db.js` 中扩展 `getTimelineMembers()`，联表 `users` 拉取 `nickname` / `real_name` / `name_only_surname` / `identity`
  - [x] SubTask 5.2: 在 `src/js/cloud-db.js` 中新增 `updateMemberRole(timelineId, userId, newRole)` 方法
  - [x] SubTask 5.3: 在 `src/js/cloud-db.js` 中新增 `getMemberRole(timelineId, userId)` 辅助方法
  - [x] SubTask 5.4: 在 `src/js/cloud-db.js` 中将 `joinTimelineByInviteCode()` 的默认 role 设为 `member`（已实现，需确认无回归）
  - [x] SubTask 5.5: 在 `src/js/app.js` 中维护 `currentTimelineRole` 缓存：进入赛队时间轴时拉取并缓存，离开时清空

- [x] Task 6: 成员管理 UI 重构
  - [x] SubTask 6.1: 在 `index.html` 的赛队管理弹窗中重构成员行：成员名（真实姓名/昵称）+ 角色下拉菜单 + X 按钮
  - [x] SubTask 6.2: 在 `src/js/app.js` 中实现 `renderMemberRow(member, currentUserRole)`：根据当前用户角色决定是否渲染下拉/X
  - [x] SubTask 6.3: 在 `src/css/styles.css` 中添加角色下拉与 X 按钮的样式（lucide x 图标，hover 变红）
  - [x] SubTask 6.4: 角色下拉菜单 change 事件 → 调用 `updateMemberRole()` → 刷新成员列表
  - [x] SubTask 6.5: X 按钮点击 → 弹出确认对话框 → 确认后调用 `removeMember()`

- [x] Task 7: 管理赛队弹窗按角色渲染
  - [x] SubTask 7.1: 在 `src/js/app.js` 中实现 `renderManageTeamModal()`，根据 `currentTimelineRole` 条件渲染弹窗内容
  - [x] SubTask 7.2: owner 视图：成员列表（含下拉/X）、邀请码、重置邀请码、删除赛队
  - [x] SubTask 7.3: captain/teacher 视图：成员列表（含下拉/X）、邀请码、重置邀请码（无删除赛队）
  - [x] SubTask 7.4: member 视图：成员列表（只读）、邀请码（只读，无重置按钮）
  - [x] SubTask 7.5: visitor 视图：仅成员列表（只读，无邀请码）
  - [x] SubTask 7.6: owner 行不显示下拉与 X 按钮（owner 不可降级/移除）

- [x] Task 8: 下拉菜单与管理赛队按钮的多端修正
  - [x] SubTask 8.1: 在 `index.html` 的手机端下拉菜单中：移除 `if (isOwner)` 守卫，让"管理赛队"选项对所有用户可见
  - [x] SubTask 8.2: 在手机端下拉菜单底部新增"关闭"选项（点击关闭下拉）
  - [x] SubTask 8.3: 在 `src/js/app.js` 的下拉菜单渲染中：检测当前选中的是否为赛队时间轴，若是个人时间轴则不显示"管理赛队"
  - [x] SubTask 8.4: 删除"请切换到赛队"提示弹窗相关 DOM 与 JS 代码
  - [x] SubTask 8.5: 在桌面端保留原"管理赛队"选项可见性（与手机端统一）

- [x] Task 9: 显示名解析与成员列表
  - [x] SubTask 9.1: 在 `src/js/app.js` 中实现 `getDisplayName(user)` 辅助函数
  - [x] SubTask 9.2: 真实姓名优先；若 `name_only_surname = true`，渲染为"X 老师"或"X 家长"
  - [x] SubTask 9.3: 真实姓名为空时回退到 nickname；再回退到 username
  - [x] SubTask 9.4: 在成员管理弹窗与成员列表（首页时间轴选择器）均使用 `getDisplayName()`

- [x] Task 10: 权限校验前端落地
  - [x] SubTask 10.1: 在 `src/js/app.js` 中实现 `canAddRecord()` / `canEditRecord(record)` / `canDeleteRecord(record)` / `canManageMembers()` / `canDeleteTimeline()` 五个权限判定函数
  - [x] SubTask 10.2: 渲染时间轴时根据权限隐藏/禁用"添加记录"按钮
  - [x] SubTask 10.3: 记录卡片上的"编辑"/"删除"按钮根据 `canEditRecord` / `canDeleteRecord` 条件渲染
  - [x] SubTask 10.4: 即便前端隐藏，后端 RLS 仍需拒绝违规操作（已在 Task 1 中实现）

- [x] Task 11: 验证与回归测试
  - [x] SubTask 11.1: 在 375px / 768px / 1280px 三个视口下验证成员管理 UI
  - [x] SubTask 11.2: 验证：注册学生 → 注册老师（仅填姓）→ 补全老用户 三种流程
  - [x] SubTask 11.3: 验证五种角色（owner/captain/teacher/member/visitor）的权限矩阵
  - [x] SubTask 11.4: 验证：手机端/桌面端下拉菜单的"管理赛队"可见性；个人时间轴下不可见
  - [x] SubTask 11.5: 验证：删除按钮已改为 X 图标；点击确认后成功移除成员

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 5, Task 7]
- [Task 7] depends on [Task 5]
- [Task 8] depends on [Task 7]
- [Task 9] depends on [Task 5]
- [Task 10] depends on [Task 5]
- [Task 11] depends on [Task 4, Task 6, Task 7, Task 8, Task 9, Task 10]
