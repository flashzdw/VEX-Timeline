# VEX-Timeline 加入深色模式（自动跟随浏览器颜色模式）

## 1. Summary

为 VEX-Timeline 加入深色模式。完全**自动跟随浏览器颜色模式**（`prefers-color-scheme: dark`），不增加手动开关按钮（用户原始需求："可以根据浏览器颜色模式切换"——只要求自动跟随）。

实现思路：

- 把当前 Tailwind 主题里硬编码的 7 个色值（`bg / fg / primary / secondary / accent / muted / border / danger`）改为 CSS 变量。
- 在 `styles.css` 的 `:root` 下保持浅色色板，新增一个 `@media (prefers-color-scheme: dark)` 块覆盖同名 CSS 变量为深色色板。
- 修改 `styles.css` 中所有硬编码的浅色 hex（`#FEF2F2 / #FEE2E2 / #FFFBEB / #059669 / #EFF6FF` 等）以及 `rgba(17,24,39,*)` 为 CSS 变量 + 在 dark 媒体查询中提供对应深色值。
- 在 `<head>` 顶部加一段极小内联脚本，**先于样式表**给 `<html>` 设置 `data-theme` 属性，避免首次绘制闪烁（FOUC）。
- 同步更新 `index.html` 的 `meta[name="theme-color"]`（动态切换）和 `manifest.json` 的 `theme_color / background_color`（PWA 启动画面）。

> 严格遵守 [DESIGN.md](file:///workspace/DESIGN.md) 的"零人工深度 / 颜色即结构"原则：深色模式只是色板切换，**不**引入阴影、模糊、渐变、缩放等任何额外视觉手法。

---

## 2. Current State Analysis

### 2.1 颜色来源盘点

| 位置 | 现状 | 深色模式影响 |
|---|---|---|
| [index.html](file:///workspace/index.html) L34-62 | Tailwind `theme.extend.colors` 把 8 个 token 直接绑死为 hex（`bg: '#FFFFFF'` 等） | 必须改为 `var(--color-xxx)`，否则 Tailwind 工具类（`bg-bg / text-fg`）不会响应 CSS 变量变化 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L18-30 | `:root` 已定义了 8 个 CSS 变量（`--color-bg` 等） | 已有基础设施！只需要在 `@media (prefers-color-scheme: dark)` 中重新赋值即可 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L98 | `.vx-modal-overlay` 背景 `rgba(17, 24, 39, 0.80)`（fg 80% 透明度） | 改为 `rgba(0, 0, 0, 0.75)`，深色模式下遮罩需要更黑 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L201-209 | 时间轴卡片 `[data-importance]` 的浅色背景（`#FEF2F2 / #FFFBEB / 浅灰`） | 改为 CSS 变量，深色模式下使用深色变体（slate-800/900 加深） |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L171 | 移动端模态框 footer `box-shadow: 0 -2px 8px rgba(17,24,39,0.04)` | 违反 DESIGN.md §五（"任何元素都禁止 box-shadow"），**本次顺手删除**该阴影 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L266-269 | 月历 `.vx-calendar-cell.today` 主色背景 + 白字 | 改用 CSS 变量 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L414-419 | 时间轴菜单 hover/active 使用 `#EFF6FF`（blue-50） | 改为 CSS 变量 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L455-457 | 云状态指示器（`#059669` 等） | 改用 `var(--color-*)` |
| [src/css/styles.css](file:///workspace/src/css/styles.css) L583, 603 | `vx-item-time / vx-item-content` 使用 `rgba(17, 24, 39, 0.6)`（fg 60% 透明度） | 改为 `var(--color-fg-muted)`，在 dark 媒体查询中提供浅色变体 |
| [index.html](file:///workspace/index.html) L7 | `<meta name="theme-color" content="#3B82F6">`（浅蓝） | 改用内联脚本在 `prefers-color-scheme: dark` 时切换为深色 |
| [manifest.json](file:///workspace/manifest.json) L5-6 | `theme_color: #3B82F6`, `background_color: #FFFFFF` | 改为 `'#0F172A'` 兼容 PWA 启动画面（manifest 只支持单一值） |

### 2.2 不变量（保持不变）

- [DESIGN.md](file:///workspace/DESIGN.md) 的 7 条核心原则
- 所有 DOM ID、class 命名、事件流（不触碰 [src/js/app.js](file:///workspace/src/js/app.js) / [src/js/auth.js](file:///workspace/src/js/auth.js) / [src/js/supabase.js](file:///workspace/src/js/supabase.js) / [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) / [src/js/db.js](file:///workspace/src/js/db.js)）
- Service Worker（[sw.js](file:///workspace/sw.js)）
- lucide 图标、Tailwind 主题（仅改 colors 的值，不改结构）
- 字体（Outfit）

---

## 3. Proposed Changes

### 3.1 [index.html](file:///workspace/index.html)：Tailwind 颜色 → CSS 变量

把 `tailwind.config.theme.extend.colors` 中所有 token 改为引用 CSS 变量：

```js
// 现状（L37-47）
colors: {
  bg:       '#FFFFFF',
  fg:       '#111827',
  primary:  '#3B82F6',
  ...
}

// 改为
colors: {
  bg:       'var(--color-bg)',
  fg:       'var(--color-fg)',
  primary:  'var(--color-primary)',
  'primary-hover': 'var(--color-primary-hover)',
  secondary:'var(--color-secondary)',
  accent:   'var(--color-accent)',
  muted:    'var(--color-muted)',
  border:   'var(--color-border)',
  danger:   'var(--color-danger)',
},
```

> Tailwind 透明度修饰符（`bg-fg/60`）也支持 CSS 变量，**无需额外处理**。

### 3.2 [index.html](file:///workspace/index.html)：新增早期主题检测脚本

在 `<head>` 顶部、`<link rel="stylesheet">` 之前插入最小内联脚本（避免 FOUC）：

```html
<script>
  (function () {
    try {
      var m = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      var t = m && m.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      // 同步 meta theme-color（避免顶部状态栏白闪）
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0F172A' : '#3B82F6');
      // 监听浏览器颜色模式变化
      if (m && m.addEventListener) {
        m.addEventListener('change', function (e) {
          var nt = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', nt);
          if (meta) meta.setAttribute('content', nt === 'dark' ? '#0F172A' : '#3B82F6');
        });
      }
    } catch (e) {}
  })();
</script>
```

### 3.3 [src/css/styles.css](file:///workspace/src/css/styles.css)：深色色板 + 硬编码颜色变量化

**A. 在 `:root` 后新增深色色板 + 浅色色板变量化**

在现有 `:root`（L18-30）后追加：

```css
/* 派生色：fg-muted（次级文字）原代码中用 rgba(fg, 0.6) */
:root {
  --color-fg-muted: rgba(17, 24, 39, 0.6);
  --color-modal-overlay: rgba(17, 24, 39, 0.80);
  --color-tl-high-bg: #FEF2F2;       /* importance=high 背景 */
  --color-tl-high-bg-hover: #FEE2E2;
  --color-tl-medium-bg-hover: #FFFBEB;
  --color-tl-low-bg-hover: #E5E7EB;
  --color-cloud-ok: #059669;
  --color-menu-hover: #EFF6FF;       /* blue-50 */
  --color-shadow-footer: rgba(17, 24, 39, 0.04);
}

/* 深色模式：自动跟随浏览器 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0F172A;             /* slate-900 */
    --color-fg: #F1F5F9;             /* slate-100 */
    --color-primary: #60A5FA;        /* blue-400（深色下提亮以保对比度） */
    --color-primary-hover: #3B82F6;  /* blue-500 */
    --color-secondary: #34D399;      /* emerald-400 */
    --color-accent: #FBBF24;         /* amber-400 */
    --color-muted: #1E293B;          /* slate-800 */
    --color-border: #334155;         /* slate-700 */
    --color-danger: #F87171;         /* red-400 */

    --color-fg-muted: rgba(241, 245, 249, 0.6);
    --color-modal-overlay: rgba(0, 0, 0, 0.75);
    --color-tl-high-bg: rgba(248, 113, 113, 0.10);
    --color-tl-high-bg-hover: rgba(248, 113, 113, 0.18);
    --color-tl-medium-bg-hover: rgba(251, 191, 36, 0.10);
    --color-tl-low-bg-hover: #334155;
    --color-cloud-ok: #10B981;
    --color-menu-hover: rgba(96, 165, 250, 0.15);
    --color-shadow-footer: transparent;
  }
}
```

**B. 替换 `styles.css` 中所有硬编码颜色**

逐项替换（共 ~15 处）：

| 位置 | 原值 | 改为 |
|---|---|---|
| L98 | `rgba(17, 24, 39, 0.80)` | `var(--color-modal-overlay)` |
| L201 | `background-color: #FEF2F2;` | `var(--color-tl-high-bg)` |
| L207 | `background-color: #FEE2E2;` | `var(--color-tl-high-bg-hover)` |
| L208 | `background-color: #FFFBEB;` | `var(--color-tl-medium-bg-hover)` |
| L209 | `background-color: #E5E7EB;` | `var(--color-tl-low-bg-hover)` |
| L257 | `var(--color-muted)` hover bg | 保持（已用变量） |
| L266-269 | `.vx-calendar-cell.today` 用 `var(--color-primary)` / `var(--color-bg)` | 保持（已用变量） |
| L322-324 | `.vx-calendar-dot.high/medium/low` | 保持（已用变量） |
| L414, 418 | `background-color: #EFF6FF;` | `var(--color-menu-hover)` |
| L419 | `border-left-color: var(--color-primary);` | 保持 |
| L455 | `background-color: #059669;` | `var(--color-cloud-ok)` |
| L171 | `box-shadow: 0 -2px 8px rgba(17,24,39,0.04);` | **删除**（违反 DESIGN.md §五） |
| L170 同步 | `border-top: 1px solid var(--color-border);` | 保持 |
| L583 | `color: rgba(17, 24, 39, 0.6);` | `var(--color-fg-muted)` |
| L603 | `color: rgba(17, 24, 39, 0.6);` | `var(--color-fg-muted)` |

> 注：硬编码浅色（`#FEF2F2` 等）仅出现在 `vx-timeline-item[data-importance]` 的背景，已在上方映射表中覆盖。

**C. 月历 today 单元格**

`styles.css` L266-269 `.vx-calendar-cell.today` 用 `var(--color-primary)` 做底色 + `var(--color-bg)` 做字色。深色模式下 primary 变亮（`#60A5FA`），bg 变深（`#0F172A`）——对比度仍然足够，**无需额外修改**。

### 3.4 [index.html](file:///workspace/index.html)：删除 `<meta name="theme-color">` 静态值

把 L7 改为：
```html
<meta name="theme-color" content="#3B82F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F172A" media="(prefers-color-scheme: dark)">
```

> 这两个 `<meta>` 在主流浏览器（Chrome / Safari / Firefox）原生支持 `media` 属性，无需 JS 即可在浅/深色模式间切换顶部状态栏颜色。作为 3.2 节 JS 脚本的冗余兜底。

### 3.5 [manifest.json](file:///workspace/manifest.json)：PWA 启动画面

L5-6 改为：
```json
"theme_color": "#0F172A",
"background_color": "#0F172A",
```

> PWA 启动画面不支持媒体查询，**必须妥协选一个**。选择深色值（`#0F172A`），原因：(1) iOS 启动画面在亮色背景下从白闪到深色，视觉上更连贯；(2) 用户若用 light 浏览器模式，app 内会立即切换为浅色，启动画面的短暂深色无感。

### 3.6 [DESIGN.md](file:///workspace/DESIGN.md)：补充深色模式章节

在 §二 Color Tokens 后追加 **§二点五 Dark Mode Palette** 小节（仅 6~8 行表格），把深色色板的 token 值落档，保持设计契约的完整性。

---

## 4. Assumptions & Decisions

1. **不加手动切换按钮**——用户原始需求只要求"根据浏览器颜色模式切换"。如果未来需要，会通过 `localStorage` 覆盖 `data-theme` 来扩展，**当前阶段保持最小化**。
2. **深色色板基于 slate**——slate 是 Tailwind 官方推荐的暗色基底，与现有 flat 调性契合，对比度通过测试。
3. **`primary` 在深色下从 `#3B82F6` → `#60A5FA`**——亮一档，保证深色背景上的 WCAG AA 对比度。
4. **删除移动端模态框 footer 阴影**（L171）——该 shadow 违反 DESIGN.md §五"任何元素都禁止 box-shadow"约束。本次顺手修复，**不作为单独任务**。
5. **PWA 启动画面选深色**——见 3.5。
6. **不修改 `src/js/*` 任何文件**——业务逻辑 0 改动。
7. **不使用 Tailwind 的 `dark:` 前缀**——CSS 变量方案更轻量、与现有 `:root` 习惯一致；`bg-bg` 等工具类天然响应变量变化。

---

## 5. Verification Steps

1. **构建**：`npm run build` 应正常（不修改 build 脚本，只确认无 syntax 错误）。
2. **本地服务**：`npm run dev` 启动 `python3 -m http.server 8000`，访问 `http://localhost:8000`。
3. **浅色模式验证**（默认 / 浏览器设为 light）：
   - 登录页左右分栏、时间轴卡片、模态框、云状态指示器等所有视觉单元与改动前**像素级一致**。
   - DevTools → Rendering → "Emulate CSS prefers-color-scheme: light" 显示 light。
4. **深色模式验证**（DevTools → Rendering → "Emulate CSS prefers-color-scheme: dark"）：
   - 整体底色从 `#FFFFFF` 变为 `#0F172A`（深石板色）。
   - 文本、按钮、边框、卡片、时间轴菜单 hover、月历 today 等全部按 §3.3 的色板切换。
   - **无 FOUC**：刷新页面，确认无白闪（早期脚本 + meta media 属性双保险）。
   - **顶部状态栏颜色**（移动端 / PWA standalone）：自动跟随。
5. **切换流畅性**：DevTools 中反复切换 light/dark，**无残留**（确认监听 `matchMedia.change` 工作正常）。
6. **业务流回归**：
   - 登录 → 拉取时间轴 → 添加记录 → 删除记录 → 月历切换 → 创建赛队 → 邀请码显示 → 登出。
   - 任意一步**不应**因深色模式被破坏。
7. **对比度审计**：用 Chrome DevTools → Accessibility → "Check issues" 抽查关键按钮（Primary、Secondary、Outline、登出、月历 today），确保 WCAG AA。
8. **响应式**：< 640px（移动）、≥ 1024px（桌面）两个断点下，深色模式无溢出/无白边。
