# Tasks

## [x] Task 1: 创建 i18n 框架
- **Priority**: P0
- **Depends On**: —
- **SubTask 1.1**: 新建 `src/js/i18n.js`，导出 `t(key)` / `setLanguage(lang)` / `applyI18n()` / `getLanguage()`
- **SubTask 1.2**: 定义中/英双语字典（先覆盖首页 + 登录页 + 共用顶栏的所有文案 key）
- **SubTask 1.3**: 在 `<head>` 内联脚本中读取 `localStorage["vex.lang"]` 并在 `i18n.js` 加载前设置 `<html lang>` 与 `document.title`
- **SubTask 1.4**: 在 `index.html` 中按 `data-i18n` / `data-i18n-placeholder` 标注所有需要翻译的节点
- **Acceptance**: 切换语言后首页与登录页文案立即变化且刷新后保持

## [x] Task 2: 改造顶栏（共用导航）
- **Priority**: P0
- **Depends On**: [Task 1]
- **SubTask 2.1**: 在 `<body>` 顶部新增 `<header id="site-header">`，含 Logo、锚点导航（首页显示）、语言切换器、"开始使用"按钮
- **SubTask 2.2**: 登录页隐藏该顶栏的锚点导航；主应用 header 改为使用共用顶栏样式，并新增"🏠 返回首页"图标按钮
- **SubTask 2.3**: 语言切换器样式遵循 DESIGN.md（`bg-muted` + `h-10`，切换按钮为 outline 风格）
- **Acceptance**: 首页 / 登录页 / 主应用三处顶栏视觉一致；语言切换入口在所有页面都可见

## [x] Task 3: 实现首页 Hero 区
- **Priority**: P0
- **Depends On**: [Task 1]
- **SubTask 3.1**: 新增 `<section id="home-hero">`，`min-h-screen bg-primary text-canvas`
- **SubTask 3.2**: 放置主标题（`font-extrabold text-6xl tracking-[-0.02em]`）、副标题、两个 CTA（"开始使用" / "了解更多"）
- **SubTask 3.3**: 添加 3 个几何装饰（绝对定位大圆、旋转方块、琥珀 / 绿色色块），`pointer-events-none`，浅色下透明度 `bg-white/10` `bg-accent/20` `bg-secondary/30`
- **SubTask 3.4**: Hero 必须在浅/深色下都"独特但扁平"——深色下用 `--color-hero-bg`（极深藏青）替代纯蓝，避免大块刺眼蓝
- **Acceptance**: 视觉评审通过 DESIGN.md §十一"海报观感"准则；移动端堆叠居中

## [x] Task 4: 实现 Features 区
- **Priority**: P0
- **Depends On**: [Task 3]
- **SubTask 4.1**: 4 个色块卡片：时间轴记录（蓝）/ 月历总览（绿）/ 个人与赛队协作（琥珀）/ 云端同步（灰）
- **SubTask 4.2**: 每卡片：lucide 图标（实色圆 `h-14 w-14`） + 标题 + 一行说明；hover 缩放
- **SubTask 4.3**: 使用浅色块 `bg-blue-50` / `bg-emerald-50` / `bg-amber-50` / `bg-muted`（DESIGN.md §六允许柔和色块）
- **Acceptance**: 4 卡在桌面 4 列、`md` 2 列、移动 1 列；hover 反馈符合规范

## [x] Task 5: 实现 How to use 区
- **Priority**: P1
- **Depends On**: [Task 3]
- **SubTask 5.1**: `bg-fg text-canvas` 深色背景，3 步说明（注册 → 创建时间轴 → 添加记录）
- **SubTask 5.2**: 每步配大字号数字徽章（`h-16 w-16 bg-primary rounded-md`）+ 标题 + 一行说明
- **Acceptance**: 移动端纵向堆叠；深色下文字对比度 ≥ WCAG AA

## [x] Task 6: 实现 FAQ + CTA + Footer
- **Priority**: P1
- **Depends On**: [Task 3]
- **SubTask 6.1**: FAQ 4 条（离线能用吗 / 数据安全吗 / 是否收费 / 怎么邀请队友），`bg-muted`，`border-2 border-border` 分隔，点击展开
- **SubTask 6.2**: CTA 区 `bg-accent`，标题"准备好开始记录了吗？" + 按钮"开始使用"
- **SubTask 6.3**: Footer `bg-fg text-canvas`，Logo / 版权 / GitHub 链接占位
- **Acceptance**: 所有分区背景色在浅/深色下都自然过渡

## [x] Task 7: 改造入口跳转逻辑
- **Priority**: P0
- **Depends On**: [Task 1, Task 2]
- **SubTask 7.1**: `app.js` 新增 `showHomePage()` / `hideHomePage()` / `goToAuth()`
- **SubTask 7.2**: 修改 `showAuthPage()` → 改为 `goToAuth()` 语义，但保留兼容；新行为：未登录时显示首页，登录页通过 `goToAuth()` 进入
- **SubTask 7.3**: `onLoginSuccess()` 改为：先 `showHomePage()` + toast "登录成功，正在进入应用…"，3 秒后或点击"立即进入"后 `hideHomePage()` + 显示主应用
- **SubTask 7.4**: 登出时跳回首页（不直接回登录页）
- **Acceptance**: 未登录默认看到首页；登录页成为第二屏；登录成功有 toast 过渡

## [x] Task 8: 验证 DESIGN.md 合规 + 中英切换
- **Priority**: P0
- **Depends On**: [Task 1, Task 7]
- **SubTask 8.1**: 检索首页 DOM 中所有 Tailwind class，验证无 `shadow-*` / `backdrop-blur-*` / 按钮/卡片渐变
- **SubTask 8.2**: 在浅/深色下截图首页所有分区，确认色块对比度
- **SubTask 8.3**: 在桌面（≥ 1024px）、平板（768-1023px）、手机（< 640px）三个断点验证首页布局
- **SubTask 8.4**: 验证中英切换：刷新后保持；切换后所有 `data-i18n` 节点文案更新；`<html lang>` 同步
- **Acceptance**: checklist.md 全部勾选

# Task Dependencies
- Task 7 depends on Task 1 + Task 2
- Task 8 depends on Task 1 + Task 7
- Task 3-6 可并行（在 Task 1 完成后）
