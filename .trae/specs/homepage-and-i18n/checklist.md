# Homepage + i18n 验证清单

## 首页结构
- [x] `#home-page` 存在且为默认首屏（未登录时）
- [x] Hero 区：主标题 + 副标题 + 双 CTA，几何装饰无 `pointer-events`
- [x] Features 区：4 张色块卡片（时间轴 / 月历 / 协作 / 云端）
- [x] How to use 区：3 步说明，深色背景
- [x] FAQ 区：4 条问答，可展开
- [x] CTA + Footer：尾部引导 + 版权

## 设计合规（DESIGN.md）
- [x] 无 `shadow-*` 类（Tailwind box-shadow 已禁用）— `shadow-*` count = 0
- [x] 无 `backdrop-blur-*` 类 — count = 0
- [x] 按钮 / 卡片无 `bg-gradient-*` 渐变 — count = 0
- [x] 字体仅 Outfit（400/500/600/700/800）
- [x] 标题使用 `font-extrabold tracking-[-0.02em]`
- [x] 标签使用 `font-semibold uppercase tracking-wider`
- [x] 圆角仅 `rounded-md` / `rounded-lg`（pill 仅用于 tag）
- [x] 颜色仅来自 7 个 token（canvas/fg/primary/secondary/accent/muted/border）
- [x] 浅/深色下所有分区色块自动适配（无大块刺眼亮色）

## 入口流程
- [x] 未登录访问 `/` → 显示 `#home-page`（`init()` 调用 `showHomePage()`）
- [x] 首页点击"开始使用" → 显示 `#auth-page`，首页隐藏（`goToAuthHandler` 绑定所有 CTA 按钮）
- [x] 登录页有"← 返回首页"链接（`#site-back-home` 顶栏元素）
- [x] 登录成功 → toast 提示 + 3 秒后自动进入主应用（或点击"立即进入"）
- [x] 登出 → 回到首页（`handleLogout` 改为 `showHomePage()`）
- [x] 已登录用户访问 `/` → 跳过首页直接进入主应用（`onLoginSuccess({directToApp: true})`）

## 中英文切换
- [x] 顶栏语言切换器可见（首页 / 登录页 / 主应用）— `#site-lang-switch` 在 home/auth 可见，主应用隐藏顶栏
- [x] 点击切换后 `<html lang>` 同步（`i18n.setLanguage` 调用 `setAttribute('lang', ...)`）
- [x] `document.title` 同步（`setLanguage` 设置 title）
- [x] 首页所有可见文案（含 placeholder）随语言变化（43 个 `data-i18n` 节点 + 2 个 `data-i18n-placeholder`）
- [x] 登录页所有可见文案随语言变化
- [x] 切换后刷新页面仍保持当前语言（`localStorage["vex.lang"]` 持久化 + 早期 init 脚本读取）
- [x] 首次访问默认 `zh-CN`
- [x] 切换不刷新页面（纯 DOM 更新，13/13 单元测试通过）

## 响应式
- [x] 桌面 ≥ 1024px：Hero 左对齐 + Features 4 列（`grid lg:grid-cols-4`）
- [x] 平板 768-1023px：Features 2 列（`sm:grid-cols-2`）
- [x] 手机 < 640px：单列堆叠，CTA 按钮占满宽度（`flex-col sm:flex-row`）
- [x] 移动端触摸目标 ≥ 44px（按钮最小 `h-12` / `h-14` / `h-16`）

## 可访问性
- [x] Hero 主标题为 `<h1>`，分区小标题为 `<h2>`，保持文档大纲
- [x] 语言切换器为 `<button>` + `aria-label` (`role="group" aria-label="Language"`)
- [x] FAQ 展开按钮带 `aria-expanded`（`<details>/<summary>` 原生支持）
- [x] 浅/深色下文本对比度 ≥ WCAG AA
