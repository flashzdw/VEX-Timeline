# Tasks

- [x] Task 1: Supabase 项目初始化与数据库 Schema
  - [x] SubTask 1.1: 创建 Supabase 客户端初始化模块 `src/js/supabase.js`，包含 Supabase URL 和 anon key 配置
  - [x] SubTask 1.2: 编写 Supabase 数据库 migration SQL（users、timelines、timeline_members、records 四张表）
  - [x] SubTask 1.3: 配置 RLS 策略（users 自读、timelines 所有者读写/成员读、records 成员创建读/创建者编辑删除）
  - [x] SubTask 1.4: 创建 Supabase Storage bucket `record-images` 并配置公开访问策略
  - [x] SubTask 1.5: 创建 Supabase RPC 函数 `register(username)` 和 `login(username)` 用于无密码认证

- [x] Task 2: 用户认证模块
  - [x] SubTask 2.1: 创建 `src/js/auth.js`，封装注册、登录、登出、会话恢复逻辑
  - [x] SubTask 2.2: 实现注册功能：调用 RPC `register(username)`，成功后自动登录
  - [x] SubTask 2.3: 实现登录功能：调用 RPC `login(username)`，获取 token 后 `setSession` 恢复会话
  - [x] SubTask 2.4: 实现会话持久化：登录成功后将 session 存入 localStorage，页面加载时自动恢复
  - [x] SubTask 2.5: 实现登出功能：清除 session 和 localStorage

- [x] Task 3: 登录/注册 UI
  - [x] SubTask 3.1: 在 `index.html` 中添加登录/注册页面（用户名输入框、登录/注册按钮）
  - [x] SubTask 3.2: 在 `styles.css` 中添加登录/注册页面样式，保持 Nothing 设计风格
  - [x] SubTask 3.3: 在 header 中添加用户信息显示（用户名）和登出按钮
  - [x] SubTask 3.4: 实现登录/注册页面与主界面的切换逻辑（未登录显示登录页，已登录显示主界面）

- [x] Task 4: 云端数据库操作模块
  - [x] SubTask 4.1: 创建 `src/js/cloud-db.js`，封装所有 Supabase 数据操作
  - [x] SubTask 4.2: 实现记录 CRUD：addRecord、getRecordsByDate、updateRecord、deleteRecord、getAllRecords（操作 Supabase records 表）
  - [x] SubTask 4.3: 实现时间轴管理：createTimeline、getTimelinesForUser、getTimelineMembers
  - [x] SubTask 4.4: 实现邀请功能：generateInviteCode、joinTimelineByInviteCode
  - [x] SubTask 4.5: 实现成员管理：removeMember（仅所有者可调用）
  - [x] SubTask 4.6: 实现图片上传：uploadImage 至 Supabase Storage，返回公开 URL

- [x] Task 5: 数据同步策略（IndexedDB + Supabase 双写）
  - [x] SubTask 5.1: 修改 `src/js/db.js`，增加 `timeline_id` 字段支持，记录关联到具体时间轴
  - [x] SubTask 5.2: 实现双写逻辑：登录用户操作时同时写入 IndexedDB 和 Supabase
  - [x] SubTask 5.3: 实现云端数据拉取：登录后从 Supabase 拉取所有时间轴数据，更新 IndexedDB 缓存
  - [x] SubTask 5.4: 实现离线队列：网络不可用时记录操作到 IndexedDB 队列，网络恢复后批量同步
  - [x] SubTask 5.5: 实现冲突解决策略：以 updated_at 时间戳为准，后更新的覆盖先更新的

- [x] Task 6: 时间轴切换 UI
  - [x] SubTask 6.1: 在 header 下方添加时间轴选择器（下拉菜单或标签切换），显示个人时间轴和已加入的赛队时间轴
  - [x] SubTask 6.2: 实现时间轴切换逻辑：切换时重新加载对应时间轴的记录
  - [x] SubTask 6.3: 在时间轴选择器中添加"创建赛队时间轴"入口

- [x] Task 7: 赛队时间轴管理 UI
  - [x] SubTask 7.1: 创建赛队时间轴弹窗：输入名称、确认创建
  - [x] SubTask 7.2: 邀请功能 UI：显示邀请码、复制邀请码按钮
  - [x] SubTask 7.3: 加入赛队时间轴 UI：输入邀请码、确认加入
  - [x] SubTask 7.4: 成员管理 UI（仅所有者可见）：显示成员列表、移除成员按钮
  - [x] SubTask 7.5: 所有新 UI 组件样式保持 Nothing 设计风格

- [x] Task 8: App 类重构与集成
  - [x] SubTask 8.1: 修改 App 类 init 方法，增加登录状态检查和云端数据加载
  - [x] SubTask 8.2: 修改 saveRecord/deleteRecord 方法，登录时走双写逻辑
  - [x] SubTask 8.3: 修改 renderTimeline/renderCalendar 方法，根据当前选中的时间轴加载对应数据
  - [x] SubTask 8.4: 添加网络状态监听，网络恢复时触发离线队列同步
  - [x] SubTask 8.5: 确保未登录状态下应用仍可正常使用（纯 IndexedDB 模式）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4, Task 3]
- [Task 7] depends on [Task 4, Task 3]
- [Task 8] depends on [Task 5, Task 6, Task 7]
