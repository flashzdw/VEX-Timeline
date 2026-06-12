# 官网首页 + 中英文切换 Spec

## Why
VEX-Timeline 目前打开后直接进入登录页（`#auth-page`），缺乏对外宣传与功能导览。新用户无法在登录前理解这个 PWA 是做什么的、怎么用、有什么独特价值。需要补一个**展示 + 宣传性质的官网首页**作为首屏，将登录页"降级"为第二屏；同时为国际化准备，先实现中/英双语切换。

## What Changes
- 新增 `#home-page` 作为首屏落地页（Hero + Features + How to use + FAQ/CTA + Footer），遵循 `DESIGN.md` 的 Flat Design 规范
- 将现有 `#auth-page` 改为通过首页的"开始使用 / 登录"入口进入的"第二屏"页面，登录成功后跳转回首页或应用
- 顶部导航新增语言切换器（中文 / English），持久化到 `localStorage`，并响应 `<html lang>` 切换
- 实现轻量 i18n 框架：把所有面向用户的硬编码中文文案抽离到 `src/js/i18n.js` 的字典中，按当前语言渲染
- 登录成功后的跳转逻辑改为：先回到首页 → 用户可手动进入应用；或保留原"登录成功直接进入应用"行为（在首页提供明显"进入应用"按钮）
- 移动端首页保持单列堆叠，桌面端保持海报式多分区色块

## Impact
- Affected specs:
  - `vex-timeline`（间接：UI 文案、双语字典、入口路径调整）
  - `mobile-ui-and-auth-cleanup`（间接：登录页的入口位置变化，但其内部布局不动）
- Affected code:
  - `index.html` — 新增 `#home-page`（Hero / Features / How-to-use / CTA / Footer）；header 改为首页/应用通用顶栏并加入语言切换器
  - `src/css/styles.css` — 增加首页各分区的几何装饰与海报式色块（蓝/绿/琥珀/深灰交替）
  - `src/js/i18n.js`（**新**）— 双语字典 + `t(key)` / `applyI18n()` / `setLanguage()`
  - `src/js/app.js` — `showAuthPage()` 改为"显示首页"语义；新增 `showHomePage()` / `goToAuth()`；登录成功后跳转首页（不直接进应用）
  - `src/js/auth.js` — 注册/登录按钮文案、提示语改为 i18n key
  - 其它 DOM 文案（时间轴、模态框）暂不在本轮强制 i18n，但需保证切换语言后**至少首页与登录页**正常显示
- 不动：`sw.js`、`manifest.json`、Supabase 数据层

## ADDED Requirements

### Requirement: 官网首页存在且为默认首屏
系统 SHALL 在未登录状态下打开应用时首先显示官网首页（`#home-page`），登录页（`#auth-page`）通过首页的"开始使用"按钮进入。

#### Scenario: 首次访问
- **WHEN** 用户首次访问（未登录）
- **THEN** 默认显示 `#home-page`，且 `#auth-page` / 主应用容器均隐藏

#### Scenario: 已登录用户访问根路径
- **WHEN** 用户已登录并直接访问 `/`
- **THEN** 跳过首页直接进入主应用（保留原行为，避免破坏既有用户习惯）
- **THEN** 同时在主应用 header 提供"返回首页"链接（仅当 `window.location` 允许时）

#### Scenario: 登出
- **WHEN** 用户在主应用点击登出
- **THEN** 跳回 `#home-page`，不直接回到登录页（用户需主动点击首页 CTA 进入登录）

### Requirement: 首页包含完整导览结构
首页 SHALL 自上而下包含以下分区，每个分区都是"一张海报"：Hero、功能示例（Features）、使用说明（How to use）、常见问题（FAQ，可选，简化版）、底部 CTA + Footer。

#### Scenario: Hero 区
- **WHEN** 滚动到 Hero
- **THEN** 显示：产品名（VEX-Timeline）、主标题（一句话价值主张）、副标题（含"Personal & team timeline for VEX robotics"）、两个 CTA 按钮（"开始使用" → 登录页、"了解更多" → 滚动到 Features）、左侧/底部装饰几何图形（大圆、旋转方块、低透明度）
- **THEN** Hero 高度至少占满首屏（`min-h-screen`），且 Hero 设计必须"独特"——用大号 Outfit ExtraBold 800 + 负字距 + 大色块背景（蓝）+ 海报式几何装饰，但仍严格遵守"无阴影 / 无渐变 / 无 backdrop-blur"

#### Scenario: Features 区
- **WHEN** 滚动到 Features
- **THEN** 展示 4 个核心功能卡片（时间轴记录 / 月历总览 / 个人与赛队协作 / 云端同步），每个卡片：图标（lucide）+ 标题 + 一行说明；色块为浅蓝 / 浅绿 / 浅琥珀 / 浅灰交替
- **THEN** 卡片悬停时 `scale-[1.02]`，图标 `group-hover:scale-110`

#### Scenario: How to use 区
- **WHEN** 滚动到 How to use
- **THEN** 展示 3 步入门说明（1. 注册账号 → 2. 创建时间轴（个人 / 赛队）→ 3. 添加每日记录），深色背景（`bg-fg`）配白字，每步配数字徽章
- **THEN** 文案用列表项形式呈现，编号大字号

#### Scenario: FAQ 区（简化）
- **WHEN** 滚动到 FAQ
- **THEN** 展示 3-4 条常见问题（离线能用吗 / 数据安全吗 / 是否收费 / 怎么邀请队友），每条可点击展开答案
- **THEN** 使用 `border-2` 加粗分隔（DESIGN.md §六 例外条款）

#### Scenario: CTA + Footer
- **WHEN** 滚动到底部
- **THEN** 大色块（accent 琥珀或 primary 蓝）CTA 区，文案"准备好开始记录了吗？" + 按钮"开始使用"
- **THEN** Footer 显示 Logo、版权、GitHub/项目链接占位

### Requirement: 设计与 DESIGN.md 完全一致
首页 SHALL 严格遵循 [DESIGN.md](file:///workspace/DESIGN.md) 的全部规则：无 box-shadow、无 backdrop-blur、按钮/卡片禁止渐变、字体仅 Outfit、字号/字重/字距符合 token、配色仅来自 7 个 color token + 派生色。

#### Scenario: Token 校验
- **WHEN** 审查首页所有 class
- **THEN** 不出现 `shadow-*` / `backdrop-blur-*` / `bg-gradient-to-*`（按钮/卡片）
- **THEN** 颜色仅来自 `bg-canvas | bg-fg | bg-primary | bg-secondary | bg-accent | bg-muted | bg-border` 及其透明度变体

#### Scenario: 排版校验
- **WHEN** 审查 Hero 与分区标题
- **THEN** 使用 `font-extrabold` (800) + `tracking-[-0.02em]`
- **THEN** 标签/小字使用 `font-semibold uppercase tracking-wider`

#### Scenario: 浅/深色自动适配
- **WHEN** 系统颜色模式切换
- **THEN** 首页所有分区色块（蓝/绿/琥珀/深灰）在深色下自动调整为深色板（`prefers-color-scheme: dark`），不出现刺眼的大块亮色

### Requirement: 中英文切换
系统 SHALL 提供中/英双语切换，入口在首页顶部导航右上角，切换后立即应用并持久化。

#### Scenario: 切换入口
- **WHEN** 用户点击语言切换器
- **THEN** 弹出两个选项"中文 / English"；当前语言高亮（`bg-fg text-canvas`），另一个为 secondary
- **THEN** 点击后 `<html lang>` 立即更新为 `zh-CN` 或 `en`，`document.title` 同步

#### Scenario: 文案渲染
- **WHEN** 语言切换完成
- **THEN** 首页与登录页所有可见文案（含按钮、标题、placeholder、提示语）通过 `data-i18n` / `t(key)` 渲染为对应语言
- **THEN** 切换不刷新页面（纯 DOM 更新）

#### Scenario: 持久化
- **WHEN** 用户首次选择语言
- **THEN** 写入 `localStorage["vex.lang"] = "zh-CN" | "en"`
- **WHEN** 下次访问
- **THEN** 启动脚本在样式表加载前读取并设置初始语言，避免首屏闪烁

#### Scenario: 默认语言
- **WHEN** 首次访问且无 `localStorage["vex.lang"]`
- **THEN** 默认 `zh-CN`（符合当前用户群）

### Requirement: 第二屏 — 登录页
登录页 SHALL 保持现有功能与样式，仅在入口位置与跳转逻辑上做调整。

#### Scenario: 进入登录页
- **WHEN** 用户在首页点击"开始使用"
- **THEN** 滚动/切换至 `#auth-page`，首页隐藏
- **THEN** 登录页提供"← 返回首页"链接

#### Scenario: 登录成功跳转
- **WHEN** 用户登录成功
- **THEN** 跳回 `#home-page`（而非直接进入主应用），首页显示一条 toast"登录成功，正在进入应用…" 3 秒后自动跳转到 `.container`（主应用）
- **THEN** 用户在 toast 倒计时期间点击"立即进入"按钮可立即跳转

#### Scenario: 注册成功跳转
- **WHEN** 用户注册成功
- **THEN** 自动登录并跳转回首页（同上逻辑）

#### Scenario: 文案双语
- **WHEN** 切换语言
- **THEN** 登录页的"欢迎回来"、"登录 · 注册"、"用户名"、"密码"、"登录"按钮、"注册"按钮、错误提示均同步切换语言

## MODIFIED Requirements

### Requirement: 应用入口行为
原"未登录 → 直接进入登录页"修改为：
- 未登录 → 首页（带"开始使用"按钮）
- 点击"开始使用" → 登录页
- 登录成功 → 短暂停留在首页 + toast → 主应用

### Requirement: Header 顶栏
原主应用 header 仅在 `.container` 内部，修改为：
- 抽出共用顶栏结构（Logo + 视图切换 / 时间轴选择 + 语言切换器 + 用户菜单）
- 首页顶栏不显示视图切换 / 时间轴选择 / 用户菜单（仅 Logo + 语言切换 + "开始使用" 按钮）
- 主应用顶栏在原有基础上增加"返回首页"图标按钮（仅未登录时显示在登录页？—— 实际：主应用顶栏增加"🏠 首页"按钮，登录状态可见）

### Requirement: 登录页文案
原登录页所有中文硬编码文案修改为：改用 `t('auth.*')` 渲染，支持中/英。

## REMOVED Requirements
无（不删除任何已存在功能，仅扩展与重排入口）

## 技术方案（概要）

### 首页结构
```
#home-page
  ├─ header（Logo / 锚点导航 / 语言切换 / "开始使用" CTA）
  ├─ section.hero（min-h-screen，bg-primary，几何装饰）
  ├─ section.features（4 张色块卡片，bg-canvas + 浅彩色块）
  ├- section.how-to（bg-fg 文字白色，3 步）
  ├─ section.faq（bg-muted，border-2 分隔，可展开）
  ├─ section.cta（bg-accent 文字深色，大按钮）
  └─ footer（bg-fg 文字浅灰）
```

### i18n 实现
- 新建 `src/js/i18n.js`，导出 `t(key)` / `setLanguage(lang)` / `applyI18n()` / `getLanguage()`
- 字典结构：`{ 'zh-CN': {...}, 'en': {...} }`，key 使用命名空间（如 `home.hero.title`、`auth.login`）
- DOM 标注：`<h1 data-i18n="home.hero.title">…</h1>`；JS 动态文案：`const label = t('auth.login');`
- 启动顺序：`<head>` 内联脚本读取 `localStorage["vex.lang"]` → 设置 `<html lang>` → 加载 `i18n.js` → 加载 `app.js` → `applyI18n()` 在 `DOMContentLoaded` 时执行

### 跳转流程
- `showHomePage()`：隐藏 `#auth-page` 与 `.container`；显示 `#home-page`；隐藏 `#app-loading`
- `goToAuth()`：隐藏 `#home-page`；显示 `#auth-page`
- 登录成功 → `onLoginSuccess()` 内追加：1) `showHomePage()`；2) `showToast('登录成功，正在进入应用…', {actionLabel:'立即进入', action: () => hideHomePage()})`；3) `setTimeout(hideHomePage, 3000)`

### 设计 token 复用
- Hero 蓝：`bg-primary`（蓝 500）
- Features 色块：`bg-blue-50` / `bg-emerald-50` / `bg-amber-50` / `bg-muted`（DESIGN.md §六"纯色或柔和色块"明确允许）
- How to 深色：`bg-fg text-canvas`
- FAQ：`bg-muted`，分隔用 `border-2 border-border`
- CTA：`bg-accent`（琥珀）
- Footer：`bg-fg text-canvas` + 浅灰辅助文字
