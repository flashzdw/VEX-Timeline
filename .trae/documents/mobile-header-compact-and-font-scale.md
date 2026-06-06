# 手机端 Header 精简与字号调整

## Summary

针对移动端（< 1024px）header 横向溢出、字号偏小、整体臃肿的问题，做三处针对性修复：

1. **手机端 header 精简到 4 个核心元素**（V logo + 云状态 + 添加按钮 + 汉堡），把时间轴选择器与用户菜单下移到 `lg+` 断点；移动端抽屉已有这两项入口。
2. **header 高度收窄、边框变细**，消除臃肿感。
3. **过滤条与时间轴卡片字号适度上调**（约 +2px），保证手机端可读性。

桌面端（≥ 1024px）布局完全不变。

## Current State Analysis

### 截图反映的三类问题

| 现象 | 根因 |
| --- | --- |
| 6 个 header 元素在 375px 行内挤不下，V logo / 时间轴选择器被裁切 | `#timeline-selector` 用了 `hidden md:block`（在 768px+ 才隐藏），但 `md` 断点仍 < `lg`（1024px），且 `#user-info` 通过 JS 移除 `hidden` 后无断点保护 |
| 过滤器 / 卡片文字偏小 | 过滤器 `text-xs`/`text-sm`、时间 `10px`、标题 `17px`、内容 `14px` 在手机端偏小 |
| header 显得臃肿 | `h-16` + `border-b-4` + 各元素高度不统一（40 / 48 / 32 混杂） |

### 关键代码位置（基于 Phase 1 探索）

| 文件 | 行 | 现状 |
| --- | --- | --- |
| [index.html:144](file:///workspace/index.html#L144) | `<div class="container mx-auto hidden">` | 主容器，OK |
| [index.html:149-150](file:///workspace/index.html#L149-L150) | `<header class="sticky top-0 z-40 bg-white border-b-4 border-border">` + `h-16 md:h-20` | header 高度与粗边框 |
| [index.html:153-156](file:///workspace/index.html#L153-L156) | Logo + `VEX-Timeline` 文本 (`hidden sm:inline`) | OK |
| [index.html:171](file:///workspace/index.html#L171) | `<div id="timeline-selector" class="hidden md:block relative shrink-0">` | **问题点：应改 `hidden lg:block`** |
| [index.html:192](file:///workspace/index.html#L192) | `<div id="user-info" class="hidden relative">` | **问题点：JS 移除 `hidden` 后无断点保护** |
| [index.html:219-223](file:///workspace/index.html#L219-L223) | `+` 按钮 `h-12 sm:h-14` | 手机端 48px（过高） |
| [index.html:226-229](file:///workspace/index.html#L226-L229) | 汉堡 `h-10 w-10` | OK |
| [index.html:245-255](file:///workspace/index.html#L245-L255) | 过滤器 `p-6` + `text-xs/text-sm` | 字号与内边距 |
| [src/css/styles.css:213](file:///workspace/src/css/styles.css#L213) | `.vx-item-content { font-size: 0.8125rem; }` | 手机端过小 |
| [src/css/styles.css:543](file:///workspace/src/css/styles.css#L543) | `.vx-item-time { font-size: 10px; }` | 手机端过小 |
| [src/css/styles.css:559](file:///workspace/src/css/styles.css#L559) | `.vx-item-title { font-size: 1.0625rem; }` | 手机端可加大 |
| [src/css/styles.css:566](file:///workspace/src/css/styles.css#L566) | `.vx-item-content { font-size: 0.875rem; }` | 手机端可加大 |
| [src/js/app.js:107-108](file:///workspace/src/js/app.js#L107-L108) | `user-info` 移除 `hidden` | **需联动改为 `lg:flex` 可见** |

## Proposed Changes

### 1. Header 元素可见性（[index.html](file:///workspace/index.html)）

**1.1 时间轴选择器**（[index.html:171](file:///workspace/index.html#L171)）
```diff
- <div id="timeline-selector" class="hidden md:block relative shrink-0">
+ <div id="timeline-selector" class="hidden lg:block relative shrink-0">
```
断点从 `md`（768px）提到 `lg`（1024px）。

**1.2 用户菜单容器**（[index.html:192](file:///workspace/index.html#L192)）
```diff
- <div id="user-info" class="hidden relative">
+ <div id="user-info" class="hidden lg:flex relative items-center">
```
- 加 `lg:flex items-center` 让 `user-info` 仅在 `lg+` 可见
- `items-center` 保证内嵌按钮垂直居中

**1.3 联动修改**（[src/js/app.js:107-108](file:///workspace/src/js/app.js#L107-L108)）
```js
// 现状（保留语义、依赖 CSS 断点隐藏）：
document.getElementById('user-info').classList.remove('hidden');
const username = authManager.getUsername() || 'User';
```
无需改 JS，因为 CSS 的 `lg:flex` 在 `< lg` 视口下会强制隐藏元素（即便 `.hidden` 已被移除）。**这是 CSS 优先级的优势：JS 不感知断点。**

**1.4 移动端抽屉补强**（[index.html:474-507](file:///workspace/index.html#L474-L507)）
现状：移动端抽屉已有视图切换、添加记录、刷新云端、时间轴列表、赛队操作、登出。**无需修改**，但需在 checklist 中确认移动端抽屉已包含时间轴选择入口（已存在：`#mobile-timeline-list`）。

### 2. Header 高度与边框（[index.html:149-150](file:///workspace/index.html#L149-L150)）

```diff
- <header class="sticky top-0 z-40 bg-white border-b-4 border-border">
-   <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between gap-4">
+ <header class="sticky top-0 z-40 bg-white border-b-2 md:border-b-4 border-border">
+   <div class="max-w-7xl mx-auto px-3 sm:px-6 h-14 md:h-20 flex items-center justify-between gap-2 sm:gap-4">
```

| 改动 | 原值 | 新值 | 理由 |
| --- | --- | --- | --- |
| header 高度（移动端） | `h-16` (64px) | `h-14` (56px) | 减少 8px 视觉占位 |
| header 高度（桌面端） | `md:h-20` (80px) | `md:h-20` (80px) | **不变** |
| 边框（移动端） | `border-b-4` (4px) | `border-b-2` (2px) | 减半，更轻盈 |
| 边框（桌面端） | `border-b-4` | `md:border-b-4` | **桌面端保持 4px** |
| 容器内边距（移动端） | `px-4` (16px) | `px-3` (12px) | 给左右各让 4px 容纳按钮 |
| gap（移动端） | `gap-4` (16px) | `gap-2` (8px) | 4 个元素 8px 间距，40+8+40+8+40+8+40 = 184px，剩余 167px 可分配 |
| gap（桌面端） | `gap-4` | `sm:gap-4` | **桌面端保持 16px** |

### 3. 添加按钮高度统一（[index.html:219-223](file:///workspace/index.html#L219-L223)）

```diff
- class="h-12 sm:h-14 px-4 sm:px-5 bg-primary text-white rounded-md font-semibold tracking-wider uppercase text-sm flex items-center gap-2 hover:bg-primary-hover hover:scale-105 transition-all duration-200"
+ class="h-10 sm:h-14 px-3 sm:px-5 bg-primary text-white rounded-md font-semibold tracking-wider uppercase text-sm flex items-center gap-2 hover:bg-primary-hover hover:scale-105 transition-all duration-200"
```

- 移动端从 `h-12` (48px) 改 `h-10` (40px)，与其他元素对齐
- 桌面端 `sm:h-14` (56px) **不变**
- 移动端水平内边距从 `px-4` (16px) 改 `px-3` (12px)，节省水平空间

### 4. 字号调整（[src/css/styles.css](file:///workspace/src/css/styles.css)）

修改 [styles.css:207-216](file:///workspace/src/css/styles.css#L207-L216) 现有 `@media (max-width: 640px)` 块：

```diff
  @media (max-width: 640px) {
    .vx-calendar-cell { min-height: 72px; }
-   .vx-timeline-item {
-     padding: 0.375rem 0.5rem !important;     /* 6px 8px */
-   }
-   .vx-item-content { font-size: 0.8125rem; }
-   .vx-timeline-actions { top: 2px; right: 2px; }
-   .vx-timeline-actions .vx-action-btn { min-width: 32px; min-height: 32px; }
+   /* 时间轴卡片：适度增大字号与呼吸感 */
+   .vx-timeline-item { padding: 0.75rem !important; }   /* 12px（原 6px） */
+   .vx-day-header   { font-size: 1.125rem; }             /* 18px（原 16px） */
+   .vx-item-time    { font-size: 0.75rem; }              /* 12px（原 10px） */
+   .vx-item-title   { font-size: 1.0625rem; }            /* 17px（保持，1.0625rem） */
+   .vx-item-content { font-size: 0.9375rem; }            /* 15px（原 13px） */
+   .vx-timeline-actions { top: 6px; right: 6px; }
+   .vx-timeline-actions .vx-action-btn { min-width: 36px; min-height: 36px; }
  }
```

同时调整 [styles.css:598-599](file:///workspace/src/css/styles.css#L598-L599) 的 `@media (max-width: 640px)` 块（这部分用了 `min-width` 选择器）：

```diff
  @media (max-width: 640px) {
-   .vx-day-header { font-size: 1rem; }
-   .vx-item-title { font-size: 1rem; }
+   /* 由 207-216 块统一处理，留空避免冲突 */
  }
```

实际上 styles.css 中有两段 `@media (max-width: 640px)` 规则（行 207-216 和 597-600），后者覆盖前者。**需将后者删除或合并到前者**。我会把后者整个移除（行 597-600），由前者在 207-216 统一处理。

### 5. 过滤器字号（[index.html:245-255](file:///workspace/index.html#L245-L255)）

```diff
- <div id="filter-bar" class="mb-8 p-6 bg-muted rounded-lg">
+ <div id="filter-bar" class="mb-6 sm:mb-8 p-4 sm:p-6 bg-muted rounded-lg">
    <div class="flex items-center gap-4 flex-wrap">
-     <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">重要性</span>
+     <span class="text-sm sm:text-xs font-semibold uppercase tracking-wider text-fg/60">重要性</span>
      <div class="flex gap-2 flex-wrap">
-       <button data-filter="all"    class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-fg text-white transition-all duration-200">全部</button>
-       <button data-filter="high"   class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">高</button>
-       <button data-filter="medium" class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">中</button>
-       <button data-filter="low"    class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">低</button>
+       <button data-filter="all"    class="h-11 sm:h-10 px-4 rounded-md text-base sm:text-sm font-semibold tracking-wider uppercase bg-fg text-white transition-all duration-200">全部</button>
+       <button data-filter="high"   class="h-11 sm:h-10 px-4 rounded-md text-base sm:text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">高</button>
+       <button data-filter="medium" class="h-11 sm:h-10 px-4 rounded-md text-base sm:text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">中</button>
+       <button data-filter="low"    class="h-11 sm:h-10 px-4 rounded-md text-base sm:text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">低</button>
```

| 元素 | 移动端 | 桌面端（sm+） |
| --- | --- | --- |
| 容器内边距 | `p-4` (16px) | `sm:p-6` (24px) |
| 容器下边距 | `mb-6` | `sm:mb-8` |
| "重要性" 字号 | `text-sm` (14px) | `sm:text-xs` (12px) |
| 按钮高度 | `h-11` (44px) | `sm:h-10` (40px) |
| 按钮字号 | `text-base` (16px) | `sm:text-sm` (14px) |

44px 按钮高度满足 Apple HIG 触摸目标最小值（44px），同时字号 16px 避免 iOS 自动放大。

## Assumptions & Decisions

1. **`md` 断点 = 768px，`lg` 断点 = 1024px**（Tailwind 默认）。将 `#timeline-selector` 与 `#user-info` 改用 `lg:block` / `lg:flex`，意味着 **768px - 1023px（iPad 竖屏）也会进入"精简模式"**。这是有意为之：iPad 竖屏宽度也不够放下完整 6 元素 header，而移动端抽屉已提供完整功能。
2. **JS 不感知断点**。`user-info` 的 `.hidden` 移除操作保持不变，断点由 CSS `lg:flex` 控制。这样未来扩展（如增加 `xl` 断点）只需改 CSS。
3. **移动端抽屉的时间轴选择** 已在 [index.html:503-507](file:///workspace/index.html#L503-L507) 实现（`#mobile-timeline-list`），无需新增。
4. **桌面端（≥ lg）布局完全不变**，所有 `sm:` / `md:` 修饰符保持原值。
5. **不修改 `sm:text-xs` 等桌面优先类**，仅在缺失断点处补充 `sm:` 前缀以确保桌面字号不被影响。
6. **过滤按钮 44px 高度**（`h-11`）满足 Apple HIG，是按钮高度的最低标准。重要按钮（添加记录、登录）已在 56px。
7. **不修改日历视图**（`#calendar-container`），用户截图聚焦在时间轴视图；月历在 `lg-` 已有 72px 单格高度。
8. **不引入新 CSS 文件**，所有改动集中在 [index.html](file:///workspace/index.html) 与 [src/css/styles.css](file:///workspace/src/css/styles.css)。

## Verification Steps

### 视觉验证（手动 + 截图）

| 视口 | 设备 | 验证项 |
| --- | --- | --- |
| 375 × 667 | iPhone SE | ① header 不溢出；② 4 元素（V/云/+/☰）水平排开；③ 过滤器"全部/高/中/低"可读；④ 卡片"Test"标题 ≥ 17px；⑤ 无横向滚动 |
| 390 × 844 | iPhone 14 | 同上 |
| 768 × 1024 | iPad 竖屏 | header 进入精简模式（4 元素），符合预期 |
| 1024 × 768 | iPad 横屏 | header 恢复完整 6 元素，时间轴选择器与用户名可见 |
| 1440 × 900 | 桌面 | 完整布局无变化（回归） |

### 自动化检查

1. **横向滚动检测**：在 375px 视口下用 `document.documentElement.scrollWidth <= 375` 判断无横向滚动。
2. **元素高度检测**：所有 header 内的 button 高度 ≥ 40px（`h-10`），主要 button ≥ 44px。
3. **CSS 断点验证**：用 `getComputedStyle` 检查 `#timeline-selector` 在 375px 下 `display: none`，在 1024px 下 `display: block`。
4. **JS 控制台**：无新增报错（`renderDiagnosticBar` 等 no-op 仍正常）。

### 回归检查

- [ ] 桌面端（≥ 1024px）header 6 元素完整显示
- [ ] 桌面端过滤条 `p-6`、按钮 `h-10`、`text-sm` 字号保持
- [ ] 移动端抽屉的"时间轴"区块、`#mobile-timeline-list` 正常加载
- [ ] 移动端抽屉的"添加记录"按钮（`#mobile-add-btn`）可打开模态框
- [ ] 模态框在 < 768px 全屏显示（已被前次 spec 实现）
- [ ] 月历在 < 640px 仍 72px 单格
- [ ] 登录/注册页在前次 spec 基础上无回归

### 修改文件清单

| 文件 | 改动类型 | 预计行数 |
| --- | --- | --- |
| [index.html](file:///workspace/index.html) | header 元素可见性、header 高度、添加按钮、过滤器 | ~6 处，约 12 行 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | `@media (max-width: 640px)` 块合并与字号调整 | ~10 行 |

不需修改 JS、不需修改 HTML 结构（仅调整 class）、不需新增文件。
