# Checklist

## 第一级：用户资料与身份
- [x] `users` 表新增 `nickname` / `real_name` / `name_only_surname` / `identity` 字段
- [x] `timeline_members.role` 枚举扩展为 `{owner, captain, teacher, member, visitor}`
- [x] 注册表单新增：昵称、真实姓名、身份单选、老师"仅填姓"复选框
- [x] 老师仅填姓时真实姓名仅接受 1 个字符并设置 `name_only_surname = true`
- [x] 学生注册时真实姓名至少 2 个字符
- [x] 老用户首次登录新版本弹出补全资料弹窗
- [x] 补全完成前主时间轴内容不渲染
- [x] "跳过"按钮仅在 `identity` 已存在时可用
- [x] `register` RPC 接受新参数；`complete_profile` RPC 可被老用户调用

## 第二级：赛队角色与权限
- [x] owner 拥有全部权限（含删除赛队）
- [x] captain / teacher 拥有除删除赛队外的全部权限
- [x] member 可查看/编辑赛队内所有记录，但不可删除/添加成员、不可删除赛队
- [x] visitor 仅可查看，不可增删改任何记录、不可管理成员
- [x] 通过邀请码加入赛队默认 `role = 'member'`
- [x] 创建赛队时创建者 `role = 'owner'`，且不可被降级或移除
- [x] owner / captain / teacher 可调整其他成员角色
- [x] owner / captain / teacher 可移除其他成员
- [x] RLS 策略：visitor 不可 INSERT / UPDATE / DELETE records
- [x] RLS 策略：member 不可 UPDATE / DELETE 他人 records

## 成员管理 UI
- [x] 成员行显示：显示名（真实姓名/昵称/用户名 回退）+ 角色下拉菜单 + X 按钮
- [x] 角色下拉菜单选项：`captain` / `teacher` / `member` / `visitor`，默认 `member`
- [x] 角色下拉菜单 change 事件立即保存到 Supabase
- [x] 删除按钮改为 X 图标（lucide `x`），无文字
- [x] X 按钮点击后弹出确认对话框
- [x] owner 行不显示下拉与 X 按钮
- [x] 真实姓名优先显示；老师仅填姓时显示为"X 老师"；空时回退 nickname → username

## 管理赛队弹窗按角色渲染
- [x] owner 视图：成员列表（含下拉/X）、邀请码、重置邀请码、删除赛队
- [x] captain / teacher 视图：成员列表（含下拉/X）、邀请码、重置邀请码（**不显示**删除赛队）
- [x] member 视图：成员列表（只读）、邀请码（只读，无重置按钮）
- [x] visitor 视图：仅成员列表（只读，无邀请码）
- [x] 各角色无权限的按钮/菜单不渲染（而非禁用）

## 下拉菜单与管理赛队按钮的多端修正
- [x] 手机端头像下拉菜单：所有用户可见"管理赛队"选项
- [x] 手机端头像下拉菜单底部新增"关闭"选项
- [x] 桌面端头像下拉菜单：所有用户可见"管理赛队"选项
- [x] 个人时间轴下：所有设备端均**不显示**"管理赛队"选项
- [x] 赛队时间轴下：所有设备端均显示"管理赛队"按钮
- [x] 删除"请切换到赛队时间轴"提示弹窗（DOM 与 JS 引用均已清理）

## 前端权限校验
- [x] `canAddRecord()` / `canEditRecord()` / `canDeleteRecord()` / `canManageMembers()` / `canDeleteTimeline()` 五个判定函数
- [x] visitor 不可见"添加记录"按钮
- [x] member 不可见他人记录上的"编辑"/"删除"按钮
- [x] member 角色下成员列表不显示下拉与 X 按钮
- [x] 即便前端隐藏，后端 RLS 仍拒绝违规操作

## 兼容性
- [x] 现有 `role = 'owner'` 判定逻辑保持兼容
- [x] 现有 `role = 'member'` 默认值保持兼容
- [x] 老用户补全资料前 `real_name` / `identity` 为 NULL，但 RLS 不被破坏
- [x] 邀请码功能、记录 CRUD、图片上传功能无回归
