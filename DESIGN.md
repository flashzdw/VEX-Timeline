# DESIGN.md — VEX-Timeline 设计系统

> 风格定位：**Flat Design（扁平化设计）** —— 数字原生、印刷品启发。拒绝立体感（无投影/无渐变/无纹理），依靠尺寸、颜色、字体建立层级。

本文件是 VEX-Timeline 项目的视觉契约。所有 UI 工作（HTML、CSS、Tailwind class、lucide 图标、动效）必须遵循本规范。CSS Token 与本仓库代码中的 Tailwind 主题配置一一对应（见 [index.html](file:///workspace/index.html) `<head>` 的 `tailwind.config`）。

---

## 一、设计哲学

**核心原则**

1. **零人工深度**：Z 轴不存在，所有元素处于同一平面。层级通过尺寸、颜色对比、几何层叠实现。
2. **颜色即结构**：用大色块定义分区与分组，**不**使用线条或阴影。颜色切换必须硬切，禁止模糊过渡。
3. **字体即界面**：层级由字号、字重承担。字体几何感强、字重粗、视觉冲击力强。
4. **几何纯粹性**：以矩形、圆、方为主，圆角统一且克制。禁止有机异形/复杂图形。
5. **交互反馈**：通过颜色切换、缩放变换、即时过渡实现 hover 反馈，**绝不**使用阴影深度。
6. **策略性装饰**：背景中放置大尺寸、低透明度的几何图形，营造海报式视觉张力。

---

## 二、Color Tokens（浅色单色板）

| Token | Tailwind class | 色值 | 用途 |
|---|---|---|---|
| `background` | `bg-bg` | `#FFFFFF` | 画布 |
| `foreground` | `text-fg` / `bg-fg` | `#111827`（Gray 900） | 高对比文本 |
| `primary` | `bg-primary` / `text-primary` | `#3B82F6`（Blue 500） | 行动色（Action） |
| `secondary` | `bg-secondary` / `text-secondary` | `#10B981`（Emerald 500） | 辅助强调 |
| `accent` | `bg-accent` / `text-accent` | `#F59E0B`（Amber 500） | 高亮 / 徽章 |
| `muted` | `bg-muted` / `text-muted` | `#F3F4F6`（Gray 100） | 次级背景 / 色块 |
| `border` | `border-border` | `#E5E7EB`（Gray 200） | 谨慎使用 |

> 高对比是必须的，色板避免浑浊色调。

### 二.五、Dark Mode Palette（深色模式色板）

> **自动跟随浏览器** [`prefers-color-scheme`](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-color-scheme)，无手动开关。所有 token 通过 CSS 变量在 `@media (prefers-color-scheme: dark)` 中整体覆盖，Tailwind 工具类（`bg-bg / text-fg` 等）天然响应。

| Token | Light 值 | Dark 值（slate 基底） | 用途 |
|---|---|---|---|
| `background` | `#FFFFFF` | `#0F172A`（slate-900） | 画布 |
| `foreground` | `#111827` | `#F1F5F9`（slate-100） | 高对比文本 |
| `primary` | `#3B82F6` | `#60A5FA`（blue-400） | 行动色（深色下提亮一档以保对比度） |
| `primary-hover` | `#2563EB` | `#3B82F6`（blue-500） | Primary hover |
| `secondary` | `#10B981` | `#34D399`（emerald-400） | 辅助强调 |
| `accent` | `#F59E0B` | `#FBBF24`（amber-400） | 高亮 / 徽章 |
| `muted` | `#F3F4F6` | `#1E293B`（slate-800） | 次级背景 / 色块 |
| `border` | `#E5E7EB` | `#334155`（slate-700） | 谨慎使用 |
| `danger` | `#EF4444` | `#F87171`（red-400） | 高风险提示 |

**派生色**（如时间轴 importance 卡片背景、菜单 hover、模态框遮罩等）也按相同模式在 `:root` 与 `@media (prefers-color-scheme: dark)` 块中分别定义。详见 [src/css/styles.css](file:///workspace/src/css/styles.css) 的"派生色"和"深色模式"两节。

**实现要点**：
- `<html data-theme="light|dark">` 由 [index.html](file:///workspace/index.html) 顶部内联脚本在样式表加载**之前**设置，避免 FOUC。
- `meta[name="theme-color"]` 配合 `media="(prefers-color-scheme: …)"` 原生属性，让浏览器顶部状态栏在浅/深色间自动切换。
- [manifest.json](file:///workspace/manifest.json) 中 `theme_color / background_color` 取深色（`#0F172A`），因 PWA 启动画面不支持媒体查询，必须二选一。

---

## 三、Typography（字体）

- **字体族**：`Outfit`, sans-serif（Tailwind class `font-sans`）
- **加载**：`https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap`
- **标题**：Bold (700) / ExtraBold (800)，字距 `-0.02em`（Tailwind `tracking-[-0.02em]`）
- **正文**：Regular (400)
- **标签 / 按钮**：Medium (500) / SemiBold (600)，常使用大写 + `tracking-wider`

```html
<h1 class="font-extrabold text-4xl tracking-[-0.02em]">标题</h1>
<p class="text-base font-normal">正文</p>
<span class="text-xs font-semibold uppercase tracking-wider">LABEL</span>
```

---

## 四、Radius & Shapes

- **圆角**：`rounded-md`（6px）或 `rounded-lg`（8px），全局统一
- **特殊**：仅 Tag 类元素可使用全圆角（pill，`rounded-full`）
- **边框**：默认 `0px`，用色块定义边缘；若必须（如输入框），使用 `border-2 solid` 或 `border-4 solid`

---

## 五、Shadows & Effects（严格限制）

- **阴影**：`shadow-none`，**任何元素都禁止 box-shadow**
  - 在 `tailwind.config` 中 `corePlugins: { boxShadow: false }` 禁用阴影类
- **渐变**：仅允许用于背景装饰的方向性渐变（如 `from-[#F3F4F6] to-transparent`），按钮/卡片上**禁止**
- **模糊**：禁止 `backdrop-blur` 等模糊效果
- **背景装饰**：大尺寸几何图形，绝对定位，低透明度（如 `bg-white/5` 或 `bg-primary/5`），必须 `pointer-events-none`

---

## 六、组件样式

### Buttons（按钮）

| 类型 | 样式规则 |
|---|---|
| **Primary** | 实色 Primary 背景，白字，`rounded-md`，高度 `h-14` ~ `h-16`；`transition-all duration-200 hover:scale-105`；hover 时颜色加深（`hover:bg-blue-600`）；**无阴影** |
| **Secondary** | 实色 Muted 背景（Gray 100），深色文字；`hover:bg-gray-200` + scale 效果 |
| **Outline** | `border-4`（注意是 4 而非 2，更粗犷）实色，文字与边框同色，透明背景；hover 时填充色块（`hover:bg-[color] hover:text-white`） |

```html
<button class="h-14 px-6 bg-primary text-white rounded-md font-semibold tracking-wider uppercase text-sm hover:bg-blue-600 hover:scale-105 transition-all duration-200">
  Primary
</button>

<button class="h-14 px-6 bg-muted text-fg rounded-md font-semibold tracking-wider uppercase text-sm hover:bg-gray-200 transition-all duration-200">
  Secondary
</button>

<button class="h-14 px-6 border-4 border-fg text-fg rounded-md font-semibold tracking-wider uppercase text-sm hover:bg-fg hover:text-white transition-all duration-200">
  Outline
</button>
```

### Cards（卡片）

- **风格**："Color Block"（色块化）
- **外观**：纯色背景（白底或柔和色块 `bg-blue-50`、`bg-green-50`），**无阴影、无边框**
- **内边距**：`p-6` 或 `p-8`
- **圆角**：`rounded-lg`
- **交互**：`group cursor-pointer transition-all duration-200 hover:scale-[1.02]`；彩色背景下可加 `hover:bg-[color]-100`；卡片内图标可用 `group-hover:scale-110`

### Inputs（输入框）

- **默认**：Gray 100 背景（`bg-muted`），**无边框**，文字 Gray 900，`rounded-md`
- **聚焦**：白色背景 + `border-2` Primary 实色；**禁止** focus ring 发光，仅硬边框

```html
<input class="h-14 px-4 bg-muted text-fg rounded-md border-0 outline-none focus:bg-white focus:border-2 focus:border-primary transition-all duration-200" />
```

### Sections（分区）

- **背景交替**：White / Gray 100（`#F3F4F6`）/ 大胆强调色（Primary Blue、Emerald、Amber）切换
- **分区分隔**：**禁止**细线分隔，用留白或色块替代
- **例外**：FAQ 区使用 `border-2` 加粗分隔
- **背景装饰**：`absolute` 定位的几何图形（大圆、旋转方块、渐变蒙层 `from-[color] to-transparent`）

---

## 七、Iconography（图标）

- **库**：`lucide`（CDN：`https://unpkg.com/lucide@latest`，自动扫描 `[data-lucide]` 替换为 SVG）
- **风格**：常规到加粗描边（2px ~ 2.5px，默认即可）
- **处理方式**：常放置于实色圆中（如 `bg-white text-primary rounded-full`），圆尺寸 `h-14 w-14` 或 `h-16 w-16`
- **动画**：`transition-transform duration-200 group-hover:scale-110`；hover 时颜色强度切换

```html
<i data-lucide="plus" class="w-5 h-5"></i>
<div class="h-14 w-14 bg-white text-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
  <i data-lucide="circle-dot" class="w-6 h-6"></i>
</div>
```

---

## 八、Layout & Spacing

- **容器**：`max-w-7xl mx-auto px-6`
- **网格**：严格 12 列基线，元素完美对齐
- **间距**：4 的倍数（Tailwind 默认）
- **密度**：中等（功能型），不空旷也不拥挤

---

## 九、Motion（动效）

- **调性**："Digital"、"Snappy"、"Direct"
- **过渡**：`transition-all duration-200`（大多数交互），`duration-300`（大变换）
- **Hover 反馈**：
  - 缩放（按钮 `hover:scale-105`，卡片 `hover:scale-[1.02]`）
  - 颜色切换（加深或变亮）
  - 颜色填充（Outline 按钮 hover 填充）
  - 卡片内图标缩放（`group-hover:scale-110`）

---

## 十、Accessibility（无障碍）

- **Focus Ring**：因无阴影，focus 状态必须使用高对比实线 outline，如 `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary`
- **对比度**：彩色背景上的文字必须通过 WCAG AA（如 White on Blue 500 可用，浅色强调色需逐项校验）

---

## 十一、Non-Genericness（去模板化要点）

### ❌ 避免
- Material Design 悬浮卡片
- 通用 Bootstrap 布局
- 到处使用柔和粉彩

### ✅ 强调
- "海报"（Poster）观感 —— 每个 section 都是一张扁平海报
- 大胆色块切换
- 大尺寸装饰几何图形（hero 中的大圆、旋转方块，低透明度）
- 全屏大胆色块分区（Blue hero、Emerald benefits、Amber CTA、Dark gray How It Works & Footer）
- 价格卡片戏剧化缩放（popular 档起始更大、缩放更明显）
- 统计数字多色搭配（每个 stat 用不同强调色）
- 抽象几何构图（hero 插画、benefits 区的层叠形状）
- 显著的 hover 状态
- 粗体字 + 紧凑行高 + 强字重对比
- 加粗边框（Outline 按钮 `border-4`、FAQ `border-2`）

### 核心准则
> **无深度的视觉趣味**：通过颜色对比、几何层叠、尺寸实现，**绝不**依赖阴影或渐变。

---

## 十二、本仓库映射（Implementation Notes）

| 设计规范条目 | 本仓库实现位置 |
|---|---|
| Tailwind 主题（colors / font / radius） | [index.html](file:///workspace/index.html) `<head>` 中 `tailwind.config = { … }` |
| 不可降级关键样式（动效/重要性色点） | [src/css/styles.css](file:///workspace/src/css/styles.css) 薄层 `custom.css` |
| 图标库 | lucide CDN，`<i data-lucide="…" class="w-5 h-5">` |
| 字体 | Google Fonts：Outfit（400/500/600/700/800） |
| 业务逻辑（db.js / supabase.js / cloud-db.js） | 不动；仅 DOM 节点 ID/class 与本规范对齐 |
| Service Worker | 不动（独立于视觉） |
