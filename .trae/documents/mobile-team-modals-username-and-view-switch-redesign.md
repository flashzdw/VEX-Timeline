# 手机端 UI/UX 优化：团队模态框、用户名胶囊、视图切换上移

## Summary

针对手机端（< 1024px）UI/UX 的三项优化，**电脑端（≥ lg）布局完全不变**：

1. **手机端团队模态框（管理/创建/加入）底部按钮优化**：把"退出"按钮（关闭/取消）做成全宽、垂直堆叠的明显动作区，符合手机端单手拇指可达性
2. **取消用户名胶囊在 mobile 上的展示**：修复 [app.js:107](file:///workspace/src/js/app.js#L107) 的 bug——`classList.remove('hidden')` 后 `#user-info` 在 < lg 视口下没有 display 规则，元素以默认 `display: block` 误显示；删除该 JS 调用即可，HTML 上的 `hidden lg:flex` 仍能正确控制 desktop 显示
3. **视图切换按钮从二级菜单（移动端抽屉）上移到主菜单栏**：放到"切换队伍"按钮（`#timeline-selector`）的左边，与桌面端布局对齐

桌面端（≥ lg）所有视觉与交互完全保留。

## Current State Analysis

### 1. 团队模态框现状

| 模态框 | 文件位置 | 底部按钮 | 移动端问题 |
| --- | --- | --- | --- |
| `#create-team-modal`（创建赛队） | [index.html:385-407](file:///workspace/index.html#L385-L407) | "取消" + "创建" 横向排列 (`flex justify-end gap-3`) | 按钮在右下角，移动端小屏触摸目标不突出 |
| `#invite-modal`（管理赛队/邀请） | [index.html:410-437](file:///workspace/index.html#L410-L437) | "关闭" 单独右对齐 | 截图显示按钮在底部但视觉权重弱（h-12 边框白按钮） |
| `#join-team-modal`（加入赛队） | [index.html:440-462](file:///workspace/index.html#L440-L462) | "取消" + "加入" 横向排列 | 同上 |

> 用户截图 ([image attached]) 反映 `#invite-modal` 在 mobile 上"关闭"按钮仅在右下角，不够明显。

### 2. 用户名胶囊 bug 根因

**当前 HTML**：[index.html:196](file:///workspace/index.html#L196)
```html
<div id="user-info" class="hidden lg:flex relative items-center">
```

**当前 JS**：[app.js:107](file:///workspace/src/js/app.js#L107)
```js
document.getElementById('user-info').classList.remove('hidden');
```

**bug 分析**：
- `hidden` 是 Tailwind 的 `display: none`（基础类，**始终生效**）
- `lg:flex` 是 `@media (min-width: 1024px)` 下的 `display: flex`（响应式变体，在 CSS 中排在基础类之后）
- 当 JS 移除 `hidden` 后，class 变成 `lg:flex relative items-center`：
  - < 1024px：`lg:flex` 不生效，无 display 规则 → 默认 `display: block` → **元素误显示**
  - ≥ 1024px：`lg:flex` 生效 → 正常显示

**为什么 JS 移除 `hidden` 原本意图**：开发者可能想"登录后强制显示"。但 HTML 已经带 `lg:flex`，在 ≥ lg 视口下会自动覆盖 `hidden`，所以**该 JS 调用是冗余且有害的**。

### 3. 移动端抽屉 vs Header 现状

**移动端 Header 可见元素**（< 1024px）：
- ❌ Logo（`hidden lg:flex`）
- ❌ 视图切换组（`hidden md:flex`）— [index.html:163](file:///workspace/index.html#L163)
- ❌ 时间轴选择器（`hidden lg:block`）— [index.html:175](file:///workspace/index.html#L175)
- ✅ Cloud status
- ✅ Mobile menu button

**移动端抽屉内容**（[index.html:467-539](file:///workspace/index.html#L467-L539)）：
- 视图（时间轴/月历切换）— 用户希望**移到 Header**
- 快捷操作（添加记录、刷新云端）
- 时间轴列表
- 赛队操作
- 登出

**Desktop 布局参考**：[index.html:153-228](file:///workspace/index.html#L153-L228) Header 元素顺序为 `Logo | View | TimelineSelector | (spacer) | Cloud | UserMenu`，其中 View 在 TimelineSelector 左边。这正是用户想要的 mobile 布局。

## Proposed Changes

### Change #1：删除 JS 中冗余的 `classList.remove('hidden')`

**File**：[src/js/app.js](file:///workspace/src/js/app.js#L107)

```diff
  async onLoginSuccess() {
    this.hideAuthPage();
-   document.getElementById('user-info').classList.remove('hidden');
    const username = authManager.getUsername() || 'User';
    document.getElementById('user-name').textContent = username;
    ...
  }
```

**效果**：
- 登录后 `#user-info` 仍保留 `hidden lg:flex` 类
- < 1024px：`hidden` 生效 → `display: none`（mobile 不显示）
- ≥ 1024px：`lg:flex` 覆盖 `hidden` → `display: flex`（desktop 正常显示用户名胶囊）
- 桌面端**完全不变**

### Change #2：视图切换按钮上移到 Header

**File**：[index.html](file:///workspace/index.html)

**2.1 视图切换组在 mobile 可见**（[index.html:163-172](file:///workspace/index.html#L163-L172)）

```diff
- <!-- 视图切换（桌面） -->
- <div class="hidden md:flex bg-muted rounded-md p-1 gap-1">
-   <button data-view-toggle="timeline"
-           class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">
+ <!-- 视图切换（桌面 + 移动） -->
+ <div class="flex bg-muted rounded-md p-1 gap-1">
+   <button data-view-toggle="timeline"
+           class="h-10 px-2 sm:px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">
      <i data-lucide="list" class="w-4 h-4 inline-block -mt-0.5 mr-1"></i>
      <span class="hidden sm:inline">时间轴</span>
    </button>
-   <button data-view-toggle="month"
-           class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase text-fg/60 hover:text-fg transition-all duration-200">
+   <button data-view-toggle="month"
+           class="h-10 px-2 sm:px-4 rounded-md text-sm font-semibold tracking-wider uppercase text-fg/60 hover:text-fg transition-all duration-200">
      <i data-lucide="calendar" class="w-4 h-4 inline-block -mt-0.5 mr-1"></i>
      <span class="hidden sm:inline">月历</span>
    </button>
  </div>
```

| 改动 | 原 | 新 | 理由 |
| --- | --- | --- | --- |
| 容器类 | `hidden md:flex` | `flex` | mobile 可见 |
| 按钮水平内边距 | `px-4` | `px-2 sm:px-4` | mobile 紧凑（仅图标），desktop 保留文字 |
| 文字 | "时间轴" / "月历" | 保持 `<span class="hidden sm:inline">` | mobile 只显示图标，desktop 显示文字 |

**2.2 时间轴选择器在 mobile 可见**（[index.html:175-185](file:///workspace/index.html#L175-L185)）

```diff
- <!-- 时间轴选择器（自定义下拉） -->
- <div id="timeline-selector" class="hidden lg:block relative shrink-0">
-   <button id="timeline-select-btn" type="button"
-           class="h-10 px-4 bg-white border-2 border-border rounded-md font-semibold text-sm flex items-center gap-2 hover:border-primary transition-all duration-200">
+ <!-- 时间轴选择器（桌面 + 移动） -->
+ <div id="timeline-selector" class="block relative shrink-0 max-w-[160px] sm:max-w-none">
+   <button id="timeline-select-btn" type="button"
+           class="h-10 px-2 sm:px-4 bg-white border-2 border-border rounded-md font-semibold text-sm flex items-center gap-1 sm:gap-2 hover:border-primary transition-all duration-200">
      <i data-lucide="layers" class="w-4 h-4 text-primary shrink-0"></i>
-     <span id="timeline-select-label">未选择</span>
+     <span id="timeline-select-label" class="truncate">未选择</span>
      <i data-lucide="chevron-down" class="w-4 h-4 text-fg/60 shrink-0"></i>
    </button>
    <div id="timeline-menu" class="vx-timeline-menu">
      <!-- 时间轴选项由 app.js 动态插入（云端时间轴） -->
    </div>
  </div>
```

| 改动 | 原 | 新 | 理由 |
| --- | --- | --- | --- |
| 容器类 | `hidden lg:block` | `block` | mobile 可见 |
| 容器最大宽度 | 无 | `max-w-[160px] sm:max-w-none` | mobile 限制宽度（防止队名过长撑爆 header） |
| 按钮内边距 | `px-4 gap-2` | `px-2 sm:px-4 gap-1 sm:gap-2` | mobile 紧凑 |
| 标签 | `<span>` | `<span class="truncate">` | mobile 长名截断省略号 |
| 图标 | 正常 | 加 `shrink-0` | 防止图标被挤压 |

**2.3 移动端抽屉删除"视图"区块**（[index.html:479-492](file:///workspace/index.html#L479-L492)）

```diff
- <!-- 移动端视图切换 -->
- <div class="mb-6">
-     <div class="text-xs font-semibold uppercase tracking-wider text-fg/60 mb-2">视图</div>
-     <div class="grid grid-cols-2 gap-2">
-         <button data-view-toggle="timeline"
-                 class="h-12 rounded-md text-sm font-semibold tracking-wider uppercase bg-fg text-white transition-all duration-200">
-             <i data-lucide="list" class="w-4 h-4 inline-block -mt-0.5 mr-1"></i>时间轴
-         </button>
-         <button data-view-toggle="month"
-                 class="h-12 rounded-md text-sm font-semibold tracking-wider uppercase bg-muted text-fg/60 transition-all duration-200">
-             <i data-lucide="calendar" class="w-4 h-4 inline-block -mt-0.5 mr-1"></i>月历
-         </button>
-     </div>
- </div>
-
  <!-- 移动端快捷操作（云状态 + 添加记录） -->
  <div class="mb-6">
      ...
  </div>
```

**2.4 Header 容器布局微调**（[index.html:154](file:///workspace/index.html#L154)）

由于 header 新增了视图切换 + 时间轴选择器，mobile 视口下需要更紧凑：

```diff
- <div class="max-w-7xl mx-auto px-3 sm:px-6 h-14 md:h-20 flex items-center justify-between gap-2 sm:gap-4">
+ <div class="max-w-7xl mx-auto px-2 sm:px-6 h-14 md:h-20 flex items-center justify-between gap-1.5 sm:gap-4">
```

| 改动 | 原 | 新 | 理由 |
| --- | --- | --- | --- |
| 容器内边距 | `px-3 sm:px-6` | `px-2 sm:px-6` | mobile 多 4px 给按钮组让位 |
| 元素间距 | `gap-2 sm:gap-4` | `gap-1.5 sm:gap-4` | mobile 更紧凑 |

### Change #3：移动端团队模态框底部按钮优化

**File**：[src/css/styles.css](file:///workspace/src/css/styles.css)

在 `@media (max-width: 767px)` 块（[styles.css:128-155](file:///workspace/src/css/styles.css#L128-L155)）的尾部追加：

```css
/* 移动端团队模态框底部按钮：全宽 + 垂直堆叠（拇指可达） */
.vx-modal > .bg-muted {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;            /* 12px */
}
.vx-modal > .bg-muted button {
  width: 100%;
  min-height: 3rem;        /* 48px（Apple HIG 触摸目标） */
  justify-content: center;
}
.vx-modal > .bg-muted button > i {
  margin: 0;               /* 图标与文字水平排列更整齐 */
}
```

**说明**：
- `.vx-modal > .bg-muted` 选择器覆盖所有"创建赛队/管理赛队/加入赛队"模态框的 footer（三个模态框都用 `<div class="bg-muted px-8 py-6 flex justify-end gap-3">` 结构）
- 桌面端（≥ 768px）原有的 `flex justify-end gap-3` 横向排列样式**不受影响**（CSS 媒体查询隔离）
- 按钮全宽 48px 高度满足 Apple HIG 触摸目标规范

## Assumptions & Decisions

1. **「取消用户名胶囊的展示」= 修复 mobile bug**：用户截图（团队管理 modal）本身没显示用户名胶囊，但文字明确说"取消"+"在二级菜单里体现"。结合代码分析，#user-info 当前在 mobile 上**确实**有误显示 bug，最直接的修复是删除 [app.js:107](file:///workspace/src/js/app.js#L107) 的 `classList.remove('hidden')` 调用，桌面端行为完全不变。
2. **桌面端 0 改动**：所有 `lg:` `md:` `sm:` 修饰符保持原值。Change #1 不影响桌面端（`hidden lg:flex` 仍生效）。Change #2 的 `sm:px-4` / `sm:gap-2` / `sm:max-w-none` 等都明确只影响 < sm 视口。
3. **移动端抽屉的"时间轴"列表（`#mobile-timeline-list`）保留**：虽然 header 已有时间轴选择器，但抽屉中的列表作为冗余入口仍可保留，不影响功能。
4. **团队模态框按钮文案不变**："取消" / "关闭" / "创建" / "加入" 文案均不动，只优化移动端布局（全宽 + 堆叠）。"退出"是用户的统称，涵盖了"关闭"和"取消"两种语义。
5. **不删除 `desktop` 用户菜单下拉**：`#user-menu`（创建/加入/管理/登出）保留；mobile 通过抽屉访问相同功能，desktop 通过头像胶囊下拉访问。
6. **Header 元素顺序遵循桌面布局**：`View (md+) | TimelineSelector (md+) | (spacer) | Cloud | UserMenu (lg+) | MobileMenu (md-)`，确保 mobile 视觉顺序与 desktop 一致。
7. **不新增 CSS 文件**，所有改动集中在 [index.html](file:///workspace/index.html) 与 [src/css/styles.css](file:///workspace/src/css/styles.css)。
8. **不修改 service worker / CACHE_NAME**：本次只是 DOM 结构调整，不涉及缓存资源变更。

## Verification Steps

### 视觉验证（手动 + 截图）

| 视口 | 验证项 |
| --- | --- |
| **375 × 667（iPhone SE）** | ① header 4 元素：View | Timeline | Cloud | Menu 水平排开不溢出；② 移动端抽屉无"视图"区块；③ `#user-info` 不显示；④ 创建/加入/管理赛队 modal 底部按钮全宽堆叠、48px 高 |
| **390 × 844（iPhone 14）** | 同上 |
| **768 × 1024（iPad 竖屏）** | header 元素可见（View / Timeline），用户名胶囊仍隐藏（< lg），按钮布局切换为横向 |
| **1024 × 768（iPad 横屏）** | 完整 6 元素 header，含用户名胶囊，回归正常 |
| **1440 × 900（桌面）** | 完整布局无任何变化（回归） |

### 自动化检查

1. **Bug fix 验证**：登录后 375px 视口下，`getComputedStyle(document.getElementById('user-info')).display === 'none'`
2. **横向滚动检测**：`document.documentElement.scrollWidth <= 375`
3. **Header 元素检测**：所有 header 内 button 高度 ≥ 40px，主要 button ≥ 48px
4. **视图切换同步**：`[data-view-toggle]` 选中态在 header 和抽屉（删除前）之间一致
5. **JS 控制台**：无新增报错

### 回归检查

- [ ] 桌面端（≥ 1024px）header 6 元素完整显示
- [ ] 桌面端团队模态框底部按钮仍为横向排列（右对齐）
- [ ] 桌面端用户名胶囊正常显示含用户名 + 头像 + chevron
- [ ] 桌面端视图切换、月历导航正常
- [ ] 移动端抽屉的"时间轴"列表（`#mobile-timeline-list`）仍渲染
- [ ] 移动端抽屉的"添加记录"/"刷新云端"/"赛队操作"/"登出"全部正常
- [ ] 登录/注册页在前次 spec 基础上无回归

## 修改文件清单

| 文件 | 改动类型 | 预计行数 |
| --- | --- | --- |
| [index.html](file:///workspace/index.html) | 视图切换组可见性、时间轴选择器可见性、抽屉删除视图区块、Header 容器间距、按钮 class 微调 | ~10 处，约 30 行 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 移动端团队模态框底部按钮全宽堆叠 | ~10 行 |
| [src/js/app.js](file:///workspace/src/js/app.js) | 移除 `classList.remove('hidden')` 调用 | 1 行 |

总计 ~3 文件、~40 行改动。不需新增文件、不需修改 service worker / supabase / DB。
