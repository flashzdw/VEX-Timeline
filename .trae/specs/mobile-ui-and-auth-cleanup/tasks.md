# Tasks

- [x] Task 1: 清理登录/注册页调试信息
  - [x] SubTask 1.1: 在 `index.html` 中移除 `<div id="diagnostic-bar">…</div>` 整段（URL/Key/Session/Token/时间轴）
  - [x] SubTask 1.2: 将 `#diag-banner` 的内容从"Vercel 环境变量…Redeploy"改为用户友好的"云端服务暂不可用"灰色小号提示
  - [x] SubTask 1.3: 修改 `src/js/app.js` 中 `renderDiagnosticBar()`，对 `#diagnostic-bar` 增加空引用保护（`if (!el) return;`），使其成为 no-op
  - [x] SubTask 1.4: 在 `handleLogin` / `handleRegister` / `handleLogout` 中保留对 `renderDiagnosticBar()` 的调用（已 no-op，验证不报错）

- [x] Task 2: 登录/注册页手机端适配
  - [x] SubTask 2.1: 调整 `index.html` 中 `#auth-page` 内边距为 `p-6 sm:p-8`（去除 `lg:p-12`）
  - [x] SubTask 2.2: 表单容器 `max-w-md` 保持不变，标题字号 `text-4xl` 在 `< 640px` 时降为 `text-3xl`
  - [x] SubTask 2.3: 输入框高度统一 `h-14`（56px），确保触摸目标 ≥ 48px
  - [x] SubTask 2.4: 登录/注册按钮 `h-14`（56px），按钮间距 `gap-3` 保持
  - [x] SubTask 2.5: 验证 375px 视口下无横向滚动、输入框/按钮可点击区域 ≥ 48px

- [x] Task 3: 主界面 header 与汉堡菜单手机端适配
  - [x] SubTask 3.1: 在 `< 768px` 视口下，header 高度从 `h-20` 调整为 `h-16`
  - [x] SubTask 3.2: 移动端汉堡菜单新增"云状态"与"添加记录"入口（仅 < 768px 可见）
  - [x] SubTask 3.3: 移动端抽屉菜单项高度统一 `h-12`（48px）
  - [x] SubTask 3.4: 验证 375px 视口下 header 不溢出，所有按钮 ≥ 40px

- [x] Task 4: 模态框手机端适配
  - [x] SubTask 4.1: 在 `src/css/styles.css` 增加 `@media (max-width: 767px)` 规则，`.vx-modal` 改为全屏（width/height 100vw/vh，border-radius 0）
  - [x] SubTask 4.2: 添加/编辑记录模态框头部 `px-8` 在窄屏改为 `px-4`；关闭按钮保持 44px
  - [x] SubTask 4.3: 赛队管理（创建/加入/邀请码）模态框邀请码 `text-4xl` 在窄屏降为 `text-2xl`
  - [x] SubTask 4.4: 日内记录详情模态框图片 `max-w-full`、内边距 `p-4`
  - [x] SubTask 4.5: 验证 375px 视口下所有模态框全屏显示，无横向滚动

- [x] Task 5: 时间轴与月历手机端适配
  - [x] SubTask 5.1: 在 `src/css/styles.css` 中将 `< 640px` 月历单格 `min-height` 从 80px 调整为 72px
  - [x] SubTask 5.2: 时间轴卡片在窄屏减小内边距（保持 `p-3 sm:p-4`）
  - [x] SubTask 5.3: 过滤器按钮在窄屏下保持 `h-10`（40px，触摸目标最小值）
  - [x] SubTask 5.4: 验证 375px 视口下月历 6 周可见（首屏）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 2]
