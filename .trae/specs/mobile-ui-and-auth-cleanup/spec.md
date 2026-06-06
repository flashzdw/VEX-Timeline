# 手机端 UI 适配与登录/注册页调试信息清理 Spec

## Why
当前 VEX-Timeline 在桌面端表现良好，但手机端体验存在多处可优化项：登录/注册页未针对小屏幕充分适配（表单拥挤、按钮偏小、留白不合理），主界面模态框/抽屉在窄屏下可读性差、触摸目标偏小。同时登录页正中央保留了一个开发用的 `diagnostic-bar`（显示 URL / Key / Session / Token / 时间轴），这是上线前应清理的调试信息，不应暴露给最终用户。

## What Changes
- 移除登录/注册页的 `#diagnostic-bar`（URL / Key / Session / Token / 时间轴 五行调试信息）
- 优化 `#diag-banner`：当 Supabase 未配置时，保留对用户友好的红条提示，但内容改为非技术用户可读，并改为非首要展示位置
- 登录/注册页针对手机端做 UI 适配：表单居中、内边距、字号、按钮高度符合移动端规范
- 主界面模态框（添加/编辑记录、创建/加入/管理赛队、记录详情）在手机端改为底部抽屉或全屏样式
- 主界面 header 的移动端汉堡菜单增加"云状态"与"添加记录"入口，避免桌面/移动端功能割裂
- 日历视图在手机端缩小单元格字号、压缩内边距，避免一屏只能看到几格
- 触摸目标最小 44px（参考 Apple HIG），按钮/输入框在 `md` 以下断点统一为 48px
- **BREAKING** 移除 `#diagnostic-bar` 后，`app.js` 中 `renderDiagnosticBar()` 的 DOM 查询将返回 null，需修改为防御性 no-op；`#diag-banner` 仍保留

## Impact
- Affected specs:
  - `add-supabase-auth-cloud-sync`（间接：清理后用户首次进入登录页不再看到开发信息）
  - `vex-timeline`（间接：移动端体验提升）
- Affected code:
  - `index.html` — 移除 `#diagnostic-bar` 整段；调整 `#auth-page`、header、模态框的 Tailwind class
  - `src/css/styles.css` — 增加模态框在 `md` 断点下的全屏/抽屉样式；调整日历/卡片在窄屏下的内边距
  - `src/js/app.js` — `renderDiagnosticBar()` 改为防御性 no-op；`handleLogin`/`handleRegister`/`handleLogout` 中调用 `renderDiagnosticBar()` 的代码需保留（避免空引用）

## ADDED Requirements

### Requirement: 登录/注册页调试信息清理
系统 SHALL 不在登录/注册页面向最终用户展示任何开发/调试信息（URL、API Key、Session、Token、时间轴等）。

#### Scenario: 默认进入登录页
- **WHEN** 用户打开应用且未登录
- **THEN** 登录/注册页面只显示用户名、密码输入框、登录/注册按钮、Logo 与欢迎语，不显示任何 URL/Key/Token 等调试字段

#### Scenario: Supabase 未配置
- **WHEN** 检测到 Supabase 未配置
- **THEN** 在登录页底部以小号灰色文字提示"云端未配置，请联系管理员"，不展示 URL/Key 细节

#### Scenario: 控制台日志
- **WHEN** 应用启动时执行诊断
- **THEN** 诊断信息仅写入 `console`（开发者可见），不渲染到 DOM

### Requirement: 登录/注册页手机端适配
系统 SHALL 让登录/注册页在手机端（视口宽度 < 768px）显示正常、可单手操作、无横向滚动。

#### Scenario: 手机端字号
- **WHEN** 视口宽度 < 640px
- **THEN** 欢迎语标题字号 ≤ 2rem；副标题字号 ≤ 0.75rem

#### Scenario: 手机端输入框
- **WHEN** 视口宽度 < 768px
- **THEN** 用户名/密码输入框高度 ≥ 48px；左右内边距 ≥ 1rem；placeholder 字号 ≥ 1rem（避免 iOS 自动放大）

#### Scenario: 手机端按钮
- **WHEN** 视口宽度 < 768px
- **THEN** 登录/注册按钮高度 ≥ 48px；按钮间距 ≥ 0.75rem

#### Scenario: 手机端滚动
- **WHEN** 视口高度 < 700px（如 iPhone SE）
- **THEN** 登录表单可垂直滚动，不被视口裁剪

#### Scenario: 横屏
- **WHEN** 设备横屏
- **THEN** 登录/注册页仍可正常使用，不出现内容重叠

### Requirement: 主界面手机端适配
系统 SHALL 让主界面（时间轴、月历、记录详情、赛队管理）在手机端单手可操作、关键功能可达。

#### Scenario: Header 触摸目标
- **WHEN** 视口宽度 < 768px
- **THEN** header 中所有可点击元素（云状态、用户菜单、添加按钮、汉堡菜单）高度/宽度 ≥ 40px，相邻元素间距 ≥ 0.5rem

#### Scenario: 移动端汉堡菜单
- **WHEN** 用户在手机端打开汉堡菜单
- **THEN** 菜单内显示：视图切换（时间轴/月历）、时间轴选择、个人/赛队切换、登出按钮；菜单项高度 ≥ 48px

#### Scenario: 时间轴卡片
- **WHEN** 视口宽度 < 640px
- **THEN** 时间轴卡片左右内边距 ≥ 0.75rem；标题字号 ≥ 1rem；卡片间距 ≥ 0.5rem

#### Scenario: 月历单元
- **WHEN** 视口宽度 < 640px
- **THEN** 月历单元高度 ≥ 72px（保持一屏可见一周 + 部分下一周）；日期数字字号 ≥ 0.875rem

### Requirement: 模态框手机端适配
系统 SHALL 让所有模态框（添加/编辑记录、创建/加入/管理赛队、日内记录详情）在手机端以全屏或底部抽屉形式展示，避免小屏下表单被压缩。

#### Scenario: 添加/编辑记录模态框
- **WHEN** 视口宽度 < 768px
- **THEN** 模态框占满视口宽度与高度（去除圆角、贴边）；关闭按钮 ≥ 44px

#### Scenario: 赛队管理模态框（邀请码、成员列表）
- **WHEN** 视口宽度 < 768px
- **THEN** 模态框宽度 100%，邀请码字号缩小至 ≤ 2rem，成员列表卡片间距 ≥ 0.5rem

#### Scenario: 日内记录详情
- **WHEN** 视口宽度 < 768px
- **THEN** 日内记录详情全屏展示，图片最大宽度 = 视口宽度 - 2rem

### Requirement: 触摸目标统一规范
系统 SHALL 遵循 Apple HIG 与 Material 触摸目标规范，关键可点击元素高度 ≥ 44px（在 `sm` 以下断点放宽为 48px 以兼容戴手套等场景）。

#### Scenario: 主界面按钮
- **WHEN** 视口宽度 < 640px
- **THEN** 添加记录、过滤、重要性选择、月历导航等按钮高度 ≥ 48px

## MODIFIED Requirements

### Requirement: 登录页 UI
原要求"登录/注册页面样式符合 Nothing 设计风格"修改为：
- 移除开发者调试条（URL / Key / Session / Token / 时间轴）
- Supabase 未配置时改为非技术用户可读的友好提示（如"云端服务暂不可用，请稍后再试"）
- 移动端输入框、按钮高度统一 ≥ 48px
- 表单在窄屏垂直居中但允许垂直滚动

### Requirement: 移动端抽屉
原 `vx-mobile-drawer` 仅含视图/时间轴/赛队/登出，修改为：
- 新增"云状态"指示器入口（点击跳转同步）
- 新增"添加记录"快捷入口（点击直接打开模态框）
- 菜单项统一高度 ≥ 48px

## REMOVED Requirements

### Requirement: 登录页开发者诊断条
**Reason**: 该诊断条暴露 URL/Key/Token 等内部信息，不应在生产环境面向最终用户
**Migration**: 诊断信息仅在 `console` 输出（已有 `console.warn` 日志），DOM 中删除相关容器；`renderDiagnosticBar()` 改为防御性 no-op 避免空引用

### Requirement: 桌面端超宽 Hero 分栏
**Reason**: 桌面端两列布局（左侧大色块 + 右侧表单）在 < 1280px 视口下已通过 `lg:flex` 隐藏，保留无副作用
**Migration**: 不做移除，仅在 < 1024px 视口下隐藏

## 技术方案

### 调试信息清理
- 在 `index.html` 中删除 `<div id="diagnostic-bar">...</div>` 整段
- 在 `app.js` 中 `renderDiagnosticBar()` 增加空引用保护（`if (!el) return;`），使其在 element 不存在时安全 no-op
- 保留 `#diag-banner`：当 Supabase 未配置时，仍在登录页底部显示一条用户友好的提示（小号灰色文字），不再使用红色 banner
- 移除 `handleLogin` / `handleRegister` / `handleLogout` 中调用 `renderDiagnosticBar()` 的代码（DOM 已删除，但保留调用也无副作用；为简洁起见一并清理）

### 移动端适配策略
- 使用 Tailwind 响应式断点：`sm` (640px) / `md` (768px) / `lg` (1024px)
- 登录/注册页：移除 `p-8 lg:p-12` 统一为 `p-6 sm:p-8`；表单容器 `max-w-md` 不变
- 模态框：在 `styles.css` 增加 `@media (max-width: 767px)` 规则，`.vx-modal` 改为 `width: 100vw; max-width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0;`
- 触摸目标：所有 `h-12` 在 < 768px 时改为 `h-12`（已满足 48px）；`h-10` 按钮在 < 768px 时改为 `h-12`
- 月历：在 `styles.css` 中将 `< 640px` 的 `min-height` 从 80px 调整为 72px（保持 6 周可见）

### 测试要点
- 在 375px（iPhone SE）、390px（iPhone 14）、768px（iPad）三个视口下验证：
  - 登录/注册页无横向滚动
  - 所有可点击元素 ≥ 44px（首选 ≥ 48px）
  - 模态框全屏展示
  - 月历单格不溢出
