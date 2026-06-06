# VEX-Timeline UI 重设计 + DESIGN.md 落档计划

## 1. Summary

按照"Flat Design / 数字原生、印刷品启发"的设计系统（参考 [DESIGN.md 草案](file:///workspace/DESIGN.md)），对 VEX-Timeline 进行**完整的 UI 重写**与**部分交互逻辑重设计**。核心目标：

- 落档设计规范为仓库级 `DESIGN.md`，作为后续 UI 工作的契约
- 引入 Tailwind CDN（Play CDN）+ lucide CDN，把现有的 ASCII/等距风格迁移为"海报式色块"风格
- 把头部分散的控件（Logo、视图切换、时间轴选择器、用户信息、登出、赛队操作）整合为**单行高级感菜单**
- 所有 hover/click 反馈从"border 变色"切换为"scale + 颜色硬切 + 缩放"
- 完全去掉 box-shadow、按钮渐变、柔和粉彩
- 重写时间轴卡片、模态框、月历、过滤器、登录页等所有视觉单元
- 业务逻辑（DB / Supabase / Auth / IndexedDB 同步）**不重写**，只调整 DOM 节点 ID/类名以匹配新模板

## 2. Current State Analysis

### 2.1 现状盘点

| 文件 | 当前作用 | 改造后 |
|---|---|---|
| [index.html](file:///workspace/index.html) | 单 HTML 入口，包含 auth + 主应用两屏；硬编码 SVG 图标；3 个模态框 | 整体重写为 Tailwind class，SVG 替换为 lucide `<i data-lucide="…">` |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 1423 行手写 CSS，2px 边框 + 灰色调 + Space Grotesk/Mono 字体 | **替换为 Tailwind Play CDN + 薄薄一层 custom.css**（仅保留不能由 Tailwind 工具类表达的动效/几何装饰） |
| [src/js/app.js](file:///workspace/src/js/app.js) | 主应用类，事件绑定 + 渲染逻辑 | 改 ID/class 选择器，**业务逻辑原样保留**；新增"菜单收起/展开"等少量交互 |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | Supabase auth | 仅修元素 ID（`#auth-page` 等不变，但 `#user-name` 变成 `#user-menu-name`） |
| [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 客户端初始化 | 不改 |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 云端 CRUD | 不改 |
| [src/js/db.js](file:///workspace/src/js/db.js) | IndexedDB | 不改 |
| [manifest.json](file:///workspace/manifest.json) | PWA 配置 | 调整 `theme_color` / `background_color` 与新色板 |

### 2.2 现有 UI 痛点（与"高级感"目标对照）

- 顶部 `[header]` 横向塞了 5 类控件，移动端折行成两行后，密度感全失
- FAB（添加按钮）+ 浮动赛队按钮组 = 屏幕底部四个 action button，挡住时间轴内容
- 卡片是 `border-2 solid #E8E8E8` + 白底 + 12px 圆点，呈现 Material/Tailwind UI 通用观感，**没有颜色即结构**
- 模态框全是 `border-2 solid` 灰框，破坏"色块即分区"原则
- 字体 `'Doto' / 'Space Grotesk' / 'Space Mono'` 偏等距、ASCII 艺术感，与"海报/印刷品"调性相反
- 大量 `transition: all 0.2s` 配 `background-color` 变色 = 典型的非 Flat 模式
- 整体灰白调，无任何强色块切换，缺少"poster section"观感

### 2.3 必须保留的不变量

- DOM ID：`auth-page / auth-username / auth-password / auth-login-btn / auth-register-btn / auth-guest-btn / auth-error / container / timeline-container / calendar-container / timeline / calendar / add-btn / timeline-actions / timeline-select / user-info / cloud-status / record-modal / create-team-modal / invite-modal / join-team-modal / prev-month / next-month / date-label / filter-bar / import-…`
- 业务事件流：login → onLoginSuccess → loadTimelines → render → 任何修改必须维持可工作状态
- Service Worker 注册、Supabase CDN 加载顺序

> **设计原则**：在 DOM 树中可改 class、id 命名（如 `.view-toggle` → `[data-view-toggle]`），但**不要修改事件流/数据流**。如果改 ID，必须同步修改 app.js / auth.js / cloud-db.js 中的引用。

## 3. Proposed Changes

### 3.1 新增 `DESIGN.md`（仓库根目录）

创建 [DESIGN.md](file:///workspace/DESIGN.md)，把用户提供的设计规范落档为 Markdown。结构：

1. **设计哲学**：6 条核心原则（零人工深度、颜色即结构、字体即界面、几何纯粹性、交互反馈、策略性装饰）
2. **Color Tokens** 表格：background / foreground / primary / secondary / accent / muted / border
3. **Typography**：字体族 Outfit；标题 Bold(700) / ExtraBold(800) `-0.02em`；正文 Regular(400)；标签/按钮 Medium(500) / SemiBold(600) + 大写 + `tracking-wider`
4. **Radius & Shapes**：`rounded-md`(6px) / `rounded-lg`(8px) / pill 仅 Tag
5. **Shadows & Effects**：严格禁令（`shadow-none` / 禁用 `backdrop-blur` / 装饰性方向渐变仅限背景）
6. **组件样式**（Button、Card、Input、Section、Icon 的细则）
7. **Iconography**：`lucide` 图标库，2~2.5px stroke，常置于 `h-14 w-14` 实色圆
8. **Layout & Spacing**：`max-w-7xl`、12 列基线、4 倍数
9. **Motion**：`transition-all duration-200` 默认；hover scale-105/1.02 + 颜色硬切
10. **Accessibility**：`ring-2 ring-offset-2 ring-blue-500` 焦点环；WCAG AA
11. **Non-Genericness**：✅/❌ 清单

> Markdown 文档须与用户原始规范**字面一致**（包括示例颜色值、按钮尺寸），但补充"已落地的本仓库映射"小节：哪些 class 在 [index.html](file:///workspace/index.html) 用到、哪些自定义 CSS 用于 Play CDN 无法表达的细节。

### 3.2 引入 Tailwind + lucide CDN

修改 [index.html](file:///workspace/index.html) `<head>`：

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          bg: '#FFFFFF',
          fg: '#111827',
          primary: '#3B82F6',
          secondary: '#10B981',
          accent: '#F59E0B',
          muted: '#F3F4F6',
          border: '#E5E7EB',
        },
        fontFamily: { sans: ['Outfit', 'sans-serif'] },
        borderRadius: { 'md': '6px', 'lg': '8px' },
      }
    },
    corePlugins: { boxShadow: false } // 严格禁止阴影
  }
</script>
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons();</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

末尾新增 `custom.css` 引用，仅承载：
- 装饰几何的 keyframes（漂浮/旋转方块）
- 时间轴 `.timeline-item::before` 的圆点着色（基于 `[data-importance]`）
- 模态框打开/关闭的硬切动画（`scale(0.95)→1` 200ms）
- 日历单元 `.has-records::after` 的色块指示器

### 3.3 顶部菜单整合（核心交互重设计）

将 [index.html](file:///workspace/index.html#L51-L76) 现有 header 改写为**单行高级感菜单**：

```
[Logo VEX-Timeline] ┊ [Timeline / Month tab] ┊ [Timeline Selector ▾] ┊ [Cloud Status] [Avatar ▾ (user menu)] [➕ Primary]
```

实现要点：

1. **布局**：`max-w-7xl mx-auto`，父容器 `flex items-center justify-between bg-white border-b-4 border-border h-20 px-6`
2. **Logo**：`font-extrabold text-2xl tracking-[-0.02em] text-fg`，左侧
3. **视图切换**：`bg-muted rounded-md p-1` 容器内两个按钮；active 状态 `bg-white text-fg`（白底凸出），非 active `text-fg/60 hover:text-fg`
4. **时间轴选择器**：替换为自定义下拉（用 lucide `chevron-down` 触发），每个选项是色块 `hover:bg-blue-50`，已选条目加 `bg-blue-50 border-l-4 border-primary`
5. **用户菜单（Avatar Dropdown）**：
   - 触发器：圆形头像（首字母方块 `h-10 w-10 bg-primary text-white rounded-full font-bold`）+ lucide `chevron-down`
   - 下拉：色块式菜单 `bg-white border-2 border-border rounded-md mt-2`
   - 菜单项：用户名（标题）、赛队操作组（创建赛队 / 加入赛队 / 管理赛队 —— 用 lucide `users` / `user-plus` / `settings`）、登出（lucide `log-out`）
   - 移动端：下拉全宽 `w-56`
6. **云端状态**：`h-10 w-10` 圆块，背景色按状态硬切（ok=secondary, error=primary, offline=accent, syncing=muted with spin）
7. **添加按钮**：从右下角 FAB **迁移到菜单最右** Primary Button：`h-14 bg-primary text-white rounded-md font-semibold tracking-wider uppercase text-sm flex items-center gap-2 hover:bg-blue-600 hover:scale-105 transition-all duration-200`，图标 lucide `plus`
8. **响应式**：`< 768px` 折叠为"汉堡菜单"：把所有次要控件收进 lucide `menu` 触发的抽屉 `fixed inset-0 z-50`

**事件改造**（在 [src/js/app.js](file:///workspace/src/js/app.js)）：

- 把 `add-btn` click 监听保留，但删除原 `bottom-right fixed` 的 CSS 位置
- 把 `timeline-actions` 中三个按钮（创建/加入/管理）的事件**重定向**到新下拉中的对应菜单项点击
- 视图切换从 `data-view` 改为 `[data-view-toggle="timeline|month"]`
- 用户菜单展开/收起：纯 CSS（`<details>` / `<summary>`）或 JS 类切换

### 3.4 Auth 页面海报化

- 左右分栏（移动端上下堆叠）：
  - 左侧：海报式 hero `bg-primary text-white p-12`，含大字标语 `font-extrabold text-6xl tracking-[-0.02em]`，装饰大圆 `bg-white/10 absolute -top-20 -right-20 h-80 w-80 rounded-full`，旋转方块 `bg-accent/20 absolute bottom-10 left-10 h-32 w-32 rotate-12`
  - 右侧：登录表单 `bg-white p-12`
- 标题 "VEX-Timeline" 用 `font-extrabold text-4xl tracking-[-0.02em]`
- 副标题用 `text-sm uppercase tracking-wider text-fg/60`
- 三个按钮（登录 / 注册 / 离线）改为：
  - 登录 = Primary `h-14 bg-primary text-white rounded-md hover:scale-105`
  - 注册 = Outline `h-14 border-4 border-fg text-fg hover:bg-fg hover:text-white`
  - 离线 = Secondary `h-14 bg-muted text-fg hover:bg-gray-200`
- 输入框：`bg-muted rounded-md px-4 h-14 border-0`，focus `bg-white border-2 border-primary`
- 诊断条：保留 `diagnostic-bar` 位置，但视觉改为 `bg-muted border-2 border-border rounded-md`

### 3.5 时间轴视图重设计

- 移除时间轴竖线 `.timeline::before`（设计规范不鼓励细线分隔）
- 日期分组头部：从 `border-bottom: 1px solid` 改为大色块 `bg-fg text-white px-6 py-4 rounded-md`（白底反白） + 大字 `font-extrabold text-2xl tracking-[-0.02em]`
- 卡片：替换为**色块卡**，按 importance 切换背景：
  - high = `bg-red-50 border-l-8 border-primary`（蓝条对应高优先级突出）
  - medium = `bg-white border-l-8 border-accent`
  - low = `bg-muted border-l-8 border-secondary`
  - 移除 `border: 2px solid #E8E8E8`
  - 加 `rounded-lg p-6 group cursor-pointer transition-all duration-200 hover:scale-[1.02]`
- 卡片内图标：lucide `circle-dot` / `alert-circle` / `check-circle`，放在 `h-14 w-14 bg-white text-primary rounded-full` 圆块，`group-hover:scale-110 transition-transform duration-200`
- 卡片右上角 edit/delete 按钮：lucide `pencil` / `trash-2`，hover 时颜色硬切 `hover:text-primary` / `hover:text-red-500`，不依赖边框

### 3.6 月历视图重设计

- 月份导航：`h-14 w-14 bg-white border-2 border-border rounded-md`，内含 lucide `chevron-left` / `chevron-right`，hover `bg-fg text-white`
- 月份标签：`font-extrabold text-3xl tracking-[-0.02em] uppercase`
- 单元网格：去掉 `border-right / border-bottom: 2px`；改为：
  - `aspect-square bg-white border-2 border-border`（粗犷方格）
  - 今日：`bg-primary text-white`
  - 有记录：`relative` + 角落色块 `absolute top-2 right-2 h-3 w-3 bg-secondary`
  - 高 importance 日期：单元整体 `bg-red-50`
  - hover：`hover:bg-muted`
- 周末列：底色 `bg-muted`（用 `nth-child` 着色）

### 3.7 模态框重设计

- 背景遮罩：黑色 `bg-fg/80`（硬切透明度，不模糊）
- 容器：`bg-white rounded-lg max-w-2xl w-full`，**无边框**
- 头部：色块 `bg-primary text-white px-8 py-6 rounded-t-lg`，标题 `font-extrabold text-2xl tracking-[-0.02em] uppercase`
- 主体：白底 `p-8`
- 底部：`bg-muted px-8 py-6 rounded-b-lg flex justify-end gap-4`
- 按钮：
  - 取消 = Secondary `bg-white border-2 border-border`
  - 保存 = Primary `bg-primary text-white hover:scale-105`
- 重要性选择器：三个色块按钮，active = `bg-fg text-white`，非 active = `bg-muted text-fg/60`

### 3.8 过滤器 + 邀请码 UI 调整

- 过滤器条：`bg-muted p-6 rounded-lg`，按钮 = 色块 `bg-white border-0`，active `bg-fg text-white`
- 邀请码展示：大色块 `bg-primary text-white p-8 rounded-lg`，邀请码 `font-extrabold text-5xl tracking-[0.2em]`
- 复制按钮 = Outline `border-4 border-white text-white hover:bg-white hover:text-primary`

### 3.9 装饰几何

在以下位置加入低透明度几何图形（`absolute pointer-events-none`）：

- 顶部菜单下方 hero 区：右上大圆 `bg-primary/5 h-96 w-96 rounded-full -mr-48 -mt-48`
- 时间轴区域背景：旋转方块 `bg-secondary/5 h-72 w-72 rotate-12 absolute -left-20 top-40`
- 月历区域背景：渐变蒙层 `bg-gradient-to-br from-muted to-transparent`
- 登录页 hero 已有大圆+方块（见 3.4）

> 所有装饰元素 `pointer-events-none`，不阻挡交互。

### 3.10 业务逻辑适配（[src/js/app.js](file:///workspace/src/js/app.js)）

仅修改 DOM 选择器与少量状态机：

- `view-toggle-btn` 改为 `[data-view-toggle]`，事件委托
- 把 `cloud-status` 元素 className 重写为 Tailwind：`h-10 w-10 rounded-full flex items-center justify-center bg-secondary/...`
- 赛队操作按钮 click 监听改为委托到 `#user-menu` 内 `[data-team-action]`
- 用户菜单展开/收起：监听 `document` click 关闭逻辑
- 移动端汉堡菜单：监听 `#mobile-menu-btn` toggle `#mobile-menu`
- 维持 `authManager.isLoggedIn()` / `currentView` / `currentFilter` 状态

### 3.11 配套微调

- [manifest.json](file:///workspace/manifest.json) `theme_color: "#3B82F6"`, `background_color: "#FFFFFF"`
- 移除 `box-shadow`、移除 `backdrop-blur`、移除渐变按钮的全局影响
- 修复所有 `transition: all 0.2s` 为"必要属性白名单"（color/background/transform）

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | Tailwind Play CDN（开发）+ 不引入 PostCSS 构建步骤 | 与现状"无构建工具"一致；首屏略增 ~300KB 换取零配置，符合重设计项目的过渡期定位 |
| D2 | lucide 用全局 CDN（`unpkg.com/lucide@latest`），不用 `lucide-react` | 项目无 React；CDN 版 `lucide.createIcons()` 自动扫描 `[data-lucide]` 替换为 SVG |
| D3 | 业务逻辑（db.js / cloud-db.js / supabase.js）零改动 | 风险隔离，UI 重写不影响数据流 |
| D4 | DOM ID 尽量保留，仅在新结构不可避免时改 ID | 减少 [app.js](file:///workspace/src/js/app.js) 改动量；改一处则同步改 JS |
| D5 | 不引入新依赖、不改 [package.json](file:///workspace/package.json) 依赖 | 与现状一致；Tailwind/lucide 走 CDN，不走 npm |
| D6 | `corePlugins.boxShadow: false` 在 tailwind config 中关掉阴影类 | 防止后续误用 `shadow-md` 等违反规范 |
| D7 | 时间轴卡片"按 importance 切换底色"用 `bg-red-50/blue-50/…` 柔和色（非强烈色） | 平衡"高对比"与"色块温和"——高优先级用左侧 8px 蓝条 + 浅红底做强提示 |
| D8 | 移动端 < 768px 把次要控件收进汉堡菜单 | 单行菜单在窄屏会拥挤；汉堡符合移动端标准 |
| D9 | 团队操作从浮动按钮组迁移到用户菜单内 | 减少屏幕底部遮挡；与"高级感菜单"一致 |
| D10 | FAB（添加按钮）迁移到顶部菜单 Primary 按钮 | 不再遮挡时间轴内容；菜单本身就是"操作中心" |
| D11 | 装饰几何元素用 `pointer-events-none absolute` 防止阻挡交互 | 既保留视觉张力又不破坏可点击性 |
| D12 | 不重写 PWA / Service Worker | 与 `theme_color` 同步即可，SW 逻辑独立于 UI |
| D13 | 不重写 `auth.js`，但 ID 改了要同步改 | 减少改动面；登录流程保持原状 |
| D14 | 现有日期分隔 `.timeline::before` 竖线**移除** | 改用大色块日期标题做分隔，呼应设计规范"颜色即结构" |

## 5. File Change List

| 类型 | 路径 | 动作 |
|---|---|---|
| 新增 | [DESIGN.md](file:///workspace/DESIGN.md) | 落档设计规范 |
| 改写 | [index.html](file:///workspace/index.html) | 引入 Tailwind + lucide CDN，重写两屏结构 |
| 重写 | [src/css/styles.css](file:///workspace/src/css/styles.css) | 替换为薄 `custom.css`（仅含不能 Tailwind 化的动效 + 重要性色点） |
| 改 | [src/js/app.js](file:///workspace/src/js/app.js) | 改选择器/事件，新增菜单展开收起逻辑 |
| 改 | [src/js/auth.js](file:///workspace/src/js/auth.js) | 同步修改的元素 ID（如有） |
| 改 | [manifest.json](file:///workspace/manifest.json) | `theme_color` / `background_color` 更新 |
| 不改 | [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 业务逻辑 |
| 不改 | [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 业务逻辑 |
| 不改 | [src/js/db.js](file:///workspace/src/js/db.js) | 业务逻辑 |
| 不改 | [sw.js](file:///workspace/sw.js) | Service Worker |
| 不改 | [scripts/build-config.js](file:///workspace/scripts/build-config.js) | 构建脚本 |
| 不改 | [supabase/](file:///workspace/supabase/migrations/) | DB 迁移 |

## 6. Verification Steps

执行顺序（Phase 4 实施阶段）：

1. **静态检查**
   - `grep -r "box-shadow\|drop-shadow\|backdrop-blur" src/ index.html` → 期望空（除自定义 CSS 中的禁用注释外）
   - `grep -rE "border-(?!2\b|4\b)[0-9]" src/css/styles.css` → 期望空（除必要的 `border-2/4`）
   - `grep -rE "linear-gradient|radial-gradient" index.html` → 仅允许在装饰背景中出现，不出现在按钮/卡片

2. **DOM 一致性**
   - 用浏览器 DevTools 打开 `index.html`，运行 `document.querySelectorAll('[id]').length`，确保无重复 ID
   - 在控制台 `Array.from(document.querySelectorAll('*')).filter(e => getComputedStyle(e).boxShadow !== 'none')` → 期望空

3. **功能回归**（无构建步骤，直接 `python3 -m http.server 8000`）
   - 登录页 → 注册新用户 → 跳到主应用 ✓
   - 主应用顶部菜单渲染正确：Logo / 视图切换 / 时间轴选择器 / 云状态 / 用户菜单 / 添加按钮
   - 时间轴视图：渲染 0 条记录时空状态、>0 条时色块卡片正确
   - 月历视图：上一月 / 下一月 / 点击日期展开当日记录
   - 添加按钮 → 模态框 → 填写 → 保存 → 卡片出现
   - 创建赛队 → 邀请码模态框 → 复制按钮
   - 加入赛队 → 输入邀请码 → 成功
   - 用户菜单 → 登出 → 回到登录页
   - 移动端尺寸（DevTools 375px）→ 汉堡菜单正常
   - 云端同步状态图标（ok / error / offline / syncing）在诊断条触发切换

4. **设计系统核对**
   - 随机抽 5 个组件，对照 [DESIGN.md](file:///workspace/DESIGN.md) 检查：
     - 按钮是否符合 Primary/Secondary/Outline 规则
     - 卡片是否无 shadow 无 border，hover 是否 scale-[1.02]
     - 输入框 focus 是否为"白底 + border-2 primary"
     - 颜色是否仅来自指定 7 个 token
   - 字体：DevTools 检查 `getComputedStyle(body).fontFamily` 包含 `Outfit`

5. **A11y 抽查**
   - Tab 键能聚焦所有交互元素，焦点环 `ring-2 ring-blue-500` 可见
   - 颜色对比度：白底/蓝底文字通过 DevTools Lighthouse

6. **PWA**
   - 重新加载后离线状态可打开 app（Service Worker 缓存命中）

## 7. Out of Scope

明确**不做**的事：

- 改数据库 schema / Supabase 迁移
- 改 Service Worker 缓存策略
- 改 IndexedDB 表结构
- 改认证流程（仍 Supabase email/password）
- 引入新 npm 依赖
- 重写 React/Vue 化（项目保持 Vanilla JS）
- 暗色模式（设计规范仅浅色单色板）
- i18n（保持中文界面）
