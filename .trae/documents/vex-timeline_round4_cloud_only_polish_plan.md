# VEX-Timeline Round 4 修复计划（云端强制 + 视觉精修）

## 1. Summary

Round 3 已修 11 个细节。本轮聚焦**强制云端 + 视觉精修**：

1. **取消本地时间轴和离线模式**（硬性要求）：
   - 删除"离线使用"按钮 / `onGuestMode` / `currentTimelineId === 'local'` 概念
   - 未登录只能看登录页；登录后才能进应用
   - 防止"本地+云端"两种状态错乱
2. **顶部视图切换按钮**：月历模式时月历按钮**没有黑色强调**（截图 1）
3. **时间轴视觉颜色仍不满意**：3 重色彩（边框 + 圆点 + 标签）过载，需简化
4. **时间轴每条记录的"高/中/低"标签太大**：缩小到最小可读
5. **重要性筛选按钮无颜色强调**："高/中/低"选中态应使用对应语义色
6. **月历点重叠**：当前 1 个点表示 has-records，应改为**每个记录 1 个点**，按重要性着色
7. **月历格框太大**：加 max-width 约束，让单格紧凑

## 2. Current State Analysis

### 2.1 Round 1+2+3 全部修复在位

- lucide@0.378.0 ✓
- 3 步独立查询 getTimelinesForUser ✓
- 月历扁平 grid + 单边 1px + 末行类 ✓
- processSyncQueue 失败项 continue ✓
- _waitForUserProfile(3000) ✓
- _loadUserProfile 3 次重试 ✓
- .vx-mobile-drawer overflow-y ✓
- .vx-cloud-status.is-ok #059669 ✓
- CACHE_NAME v3 ✓
- 月历 today.has-high 白底蓝边 + 蓝点 ✓
- 时间轴 rail + 圆点 + 简洁日期行 ✓
- 重要性 badge 红/黄/绿 ✓
- parseInt UUID bug 修复（String 比较）✓
- handleManageTeam toast ✓
- showToast + vx-toast ✓
- Auth unsubscribe 旧订阅 + debug 模式日志 ✓
- Tailwind CDN 警告抑制 ✓

### 2.2 本轮 7 个问题根因

#### 根因 ① ：本地/离线模式残留导致错乱

**位置**：
- [src/js/app.js:174-185](file:///workspace/src/js/app.js#L174-L185) — `onGuestMode()`
- [src/js/app.js:534](file:///workspace/src/js/app.js#L534) — `auth-guest-btn` 绑定
- [src/js/app.js:16](file:///workspace/src/js/app.js#L16) — `currentTimelineId = _loadStoredTimelineId() || 'local'`
- [src/js/app.js:30, 36, 37](file:///workspace/src/js/app.js#L30-L37) — `_loadStoredTimelineId` / `_saveStoredTimelineId` 含 `'local'` 分支
- [src/js/app.js:216](file:///workspace/src/js/app.js#L216) — `loadTimelines` 检测 `'local'` 切换
- [src/js/app.js:394, 1029, 1045, 1067, 1141, 1231, 1399](file:///workspace/src/js/app.js) — 多处 `=== 'local'` 检查
- [index.html:151-155](file:///workspace/index.html#L151-L155) — `<button id="auth-guest-btn">离线使用</button>`

**问题**：
- 用户登录后可以选"离线使用"进入**只有本地 IndexedDB** 的应用
- 本地+云端两套数据来源，导致：
  - 同一时间轴可能存在"本地有 / 云端无"的不一致
  - 添加/删除/编辑的提示可能走云端也可能走本地
  - 错误恢复时 `currentTimelineId === 'local'` 不会被云端覆盖
- 用户明确要求**取消本地/离线**，所有功能必须云端

**修复**：
- 删除 `onGuestMode()`
- 删除 `auth-guest-btn` HTML + click handler
- 删除 auth 页中"或"分隔线
- `currentTimelineId` 默认值改为 `null`（或存储的 id），**移除 `'local'` 兜底**
- `loadTimelines` 检测 `!currentTimelineId` 替代 `=== 'local'`
- `renderView` 改为 if `!authManager.isLoggedIn() || !currentTimelineId` 则 return（不渲染）
- `getRecordsForCurrentTimeline` / `saveRecord` / `deleteRecord` / `canEditRecord` 删除 `=== 'local'` 分支，**统一走云端**（`saveRecord` 中云端失败时记录到 syncQueue，UI 立即用本地数据更新；不再有"纯本地"路径）

#### 根因 ② ：视图切换按钮月历态无黑色

**位置**：[src/js/app.js:652-665](file:///workspace/src/js/app.js#L652-L665) `syncViewToggleState`

**问题**：当前实现用 `className.replace(/bg-(white|muted|fg) text-(fg|fg\/60|white)/g, '')` 正则替换，**但初始 HTML 中月历按钮没有 `bg-` 类**（只有 `text-fg/60 hover:text-fg`）：
```html
<button data-view-toggle="month"
        class="h-10 px-4 ... text-fg/60 hover:text-fg transition-all">
```
切换到月历时，正则不匹配 → 残留旧类 + 加 `bg-fg text-white` → **类冲突**，`bg-fg` 视觉上不一定能胜过 Tailwind 源序靠后的类。

**修复**：用 classList 显式添加/移除，不依赖正则：
```js
syncViewToggleState() {
  document.querySelectorAll('[data-view-toggle]').forEach(btn => {
    const isActive = btn.dataset.viewToggle === this.currentView;
    // 显式清理所有可能的背景/文字类
    btn.classList.remove('bg-fg', 'text-white', 'bg-muted', 'text-fg/60', 'bg-white', 'text-fg', 'hover:text-fg');
    if (isActive) {
      btn.classList.add('bg-fg', 'text-white');
    } else {
      btn.classList.add('text-fg/60', 'hover:text-fg');
    }
  });
}
```

#### 根因 ③ ：时间轴色彩过载

**位置**：
- [src/css/styles.css:419-422](file:///workspace/src/css/styles.css#L419-L422) — `border-left: 4px solid` 颜色
- [src/css/styles.css:403-417](file:///workspace/src/css/styles.css#L403-L417) — rail-dot 颜色
- [src/js/app.js:1365](file:///workspace/src/js/app.js#L1365) — 标签 badge 红/黄/绿

**问题**：当前每条记录有 3 重颜色：
1. 左侧 4px 边框（红/黄/绿）
2. 圆点边框 + 图标颜色（红/黄/绿）
3. 标签背景（红/黄/绿）

**视觉过载**，"时间轴的颜色设计还是不太行"。

**修复**：
- **保留** rail 圆点的颜色（最有识别度）
- **保留** 标签的语义色（信息密度高）
- **移除** 左侧 4px 边框（重复信息）
- 改为统一的细左边线 `border-left: 2px solid var(--color-border)`，item 整体更"扁平"和连贯

#### 根因 ④ ：时间轴标签太大

**位置**：[src/js/app.js:1365](file:///workspace/src/js/app.js#L1365)

**当前**：
```html
<span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
```

`text-xs` (12px) + `px-2 py-0.5` + `font-bold` + `tracking-wider` → 视觉占 ~20px 高度

**修复**：
```html
<span class="inline-block text-[10px] font-semibold uppercase px-1.5 py-px rounded ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
```
- `text-[10px]` 缩小
- `font-semibold` 替代 `font-bold`
- `px-1.5 py-px` 紧凑
- 移除 `tracking-wider` 减少字距

#### 根因 ⑤ ：重要性筛选按钮无颜色强调

**位置**：
- [index.html:270-273](file:///workspace/index.html#L270-L273) — 4 个按钮 HTML
- [src/js/app.js:667-678](file:///workspace/src/js/app.js#L667-L678) — `syncFilterState`

**当前**：
```js
syncFilterState() {
  document.querySelectorAll('#filter-bar [data-filter]').forEach(btn => {
    const isActive = btn.dataset.filter === this.currentFilter;
    if (isActive) {
      btn.classList.remove('bg-white', 'text-fg');
      btn.classList.add('bg-fg', 'text-white');   // ← 全部用黑色
    } else {
      btn.classList.remove('bg-fg', 'text-white');
      btn.classList.add('bg-white', 'text-fg');
    }
  });
}
```

**问题**：无论选"高/中/低"，都显示黑色背景，没有语义色。

**修复**：
```js
syncFilterState() {
  const filterClasses = {
    all:    ['bg-fg',        'text-white'],
    high:   ['bg-danger',    'text-white'],
    medium: ['bg-accent',    'text-white'],
    low:    ['bg-secondary', 'text-white']
  };
  document.querySelectorAll('#filter-bar [data-filter]').forEach(btn => {
    const f = btn.dataset.filter;
    const isActive = f === this.currentFilter;
    // 清理所有可能的背景/文字类
    btn.classList.remove('bg-fg', 'bg-danger', 'bg-accent', 'bg-secondary', 'text-white', 'bg-white', 'text-fg');
    if (isActive) {
      filterClasses[f].forEach(c => btn.classList.add(c));
    } else {
      btn.classList.add('bg-white', 'text-fg');
    }
  });
}
```

**同时更新 HTML 移除 hover 颜色**（避免状态混乱）：
```html
<button data-filter="all"    class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-fg text-white transition-all duration-200">全部</button>
<button data-filter="high"   class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">高</button>
<button data-filter="medium" class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">中</button>
<button data-filter="low"    class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">低</button>
```

#### 根因 ⑥ ：月历点重叠

**位置**：
- [src/css/styles.css:227-240](file:///workspace/src/css/styles.css#L227-L240) — `::after` 单点
- [src/js/app.js:1192-1203](file:///workspace/src/js/app.js#L1192-L1203) — `hasRecords` 单一判断

**当前**：
```css
.vx-calendar-cell.has-records::after {
  content: '';
  position: absolute;
  top: 6px; right: 6px;
  width: 8px; height: 8px;
  background-color: var(--color-secondary);  /* 绿色 */
  border-radius: 999px;
}
```

每格只 1 个点（绿色或蓝色），多日多条记录看不出差异。

**修复**：在 cell 内部加一个 dots 容器，渲染 N 个小点（每个点 5×5px），每个点按记录重要性着色：
- 高 → 红
- 中 → 黄
- 低 → 绿

**HTML**（在 app.js 中改 renderCalendar）：
```html
<div class="vx-calendar-cell" data-date="2026-06-06">
  <span class="vx-calendar-day-number">6</span>
  <div class="vx-calendar-dots">
    <span class="vx-calendar-dot high"></span>
    <span class="vx-calendar-dot medium"></span>
    <span class="vx-calendar-dot low"></span>
  </div>
</div>
```

**CSS**（替换 `::after` 单点）：
```css
/* 删除 .has-records::after 规则 */
.vx-calendar-dots {
  position: absolute;
  bottom: 4px;
  left: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  align-items: center;
}
.vx-calendar-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  flex-shrink: 0;
}
.vx-calendar-dot.high   { background-color: var(--color-danger); }
.vx-calendar-dot.medium { background-color: var(--color-accent); }
.vx-calendar-dot.low    { background-color: var(--color-secondary); }
```

**JS 改动**：
```js
// 在 renderCalendar 中
const recordsByDate = {};
allRecords.forEach(r => {
  (recordsByDate[r.date] = recordsByDate[r.date] || []).push(r.importance || 'medium');
});

// 在循环每个日期时
const dateImportances = recordsByDate[dateStr] || [];
// 上限 5 个点（避免溢出）
const dotsHTML = dateImportances.slice(0, 5).map(imp => 
  `<span class="vx-calendar-dot ${imp}"></span>`
).join('') + (dateImportances.length > 5 ? `<span class="text-[8px] text-fg/60">+${dateImportances.length - 5}</span>` : '');

// 在 cell HTML 中插入
const classes = ['vx-calendar-cell'];
// ... 保留 today / weekend / has-high / has-medium 视觉
if (dateImportances.length > 0) {
  // 移除 has-records::after 机制
}
```

#### 根因 ⑦ ：月历格框太大

**位置**：[src/css/styles.css:153-176](file:///workspace/src/css/styles.css#L153-L176)

**问题**：当前 `.vx-calendar-cell` 有 `aspect-ratio: 1`，在 1280px 视口 + 7 列布局下，每格约 170×170px — 太大（截图 2 可见）。

**修复**：
1. 给月历容器加 `max-w-3xl mx-auto` 限制整体宽度（约 768px → 每格 100px）
2. 改用 `min-h-[90px]` 替代 `aspect-ratio: 1`，让方格有更可控的高度

```html
<!-- index.html 中月历容器 -->
<div id="calendar-grid" class="grid grid-cols-7 gap-0 border-2 border-border rounded-lg overflow-hidden max-w-3xl mx-auto"></div>
```

```css
/* styles.css */
.vx-calendar-cell {
  /* 删除 aspect-ratio: 1; */
  min-height: 90px;
  background-color: var(--color-bg);
  ...
}
```

**响应式**：
- 桌面 (`md:`) 110px
- 移动 70px

## 3. Proposed Changes

### 3.1 删除本地/离线模式

**文件**：[src/js/app.js](file:///workspace/src/js/app.js)

```js
// 删除 onGuestMode() 方法（174-185 行全部）

// 改 currentTimelineId 默认值（第 16 行）
this.currentTimelineId = this._loadStoredTimelineId() || null;  // 不再有 'local' 兜底

// 改 _loadStoredTimelineId
_loadStoredTimelineId() {
  try { return localStorage.getItem('vex_current_timeline_id'); }
  catch (e) { return null; }
}

// 改 _saveStoredTimelineId（不再过滤 'local'，因为根本不会有这个值）
_saveStoredTimelineId(id) {
  try {
    if (id) localStorage.setItem('vex_current_timeline_id', id);
    else localStorage.removeItem('vex_current_timeline_id');
  } catch (e) { /* ignore */ }
}

// 改 bindEvents 中删除 auth-guest-btn 绑定（第 534 行）

// 改 loadTimelines 中检测 'local' 的逻辑
if (this.timelines.length > 0 && (!this.currentTimelineId || !this.timelines.find(t => t.id === this.currentTimelineId))) {
  const personal = this.timelines.find(t => t.type === 'personal');
  this.currentTimelineId = personal ? personal.id : this.timelines[0].id;
  this._saveStoredTimelineId(this.currentTimelineId);
}

// 改 renderView 中 local 守卫
if (this.currentView === 'month') {
  if (!authManager.isLoggedIn() || !this.currentTimelineId) {
    this.renderEmptyState('请先登录并选择时间轴');
    return;
  }
  await this.renderCalendar();
  return;
}

// 改 saveRecord / deleteRecord 中删除 === 'local' 分支
// 改为：if (this.currentTimelineId && authManager.isLoggedIn()) { 云端写入；else { syncQueue + 本地 }
// 之前已经有 syncQueue 机制，所以保留；只是不再有"纯本地"路径

// 改 getRecordsForCurrentTimeline
async getRecordsForCurrentTimeline() {
  if (!this.currentTimelineId) return [];
  return await dbManager.getRecordsByTimeline(this.currentTimelineId);
}

// 改 canEditRecord 删除 'local' 短路径
canEditRecord(record) {
  if (!this.currentTimelineId) return false;
  const current = this.timelines.find(t => t.id === this.currentTimelineId);
  if (!current) return true;  // 个人视角下都是 owner
  if (current.type === 'personal') return true;
  if (current.owner_id === authManager.getCurrentUser()?.id) return true;
  return record.created_by === authManager.getCurrentUser()?.id;
}
```

**文件**：[index.html](file:///workspace/index.html)

删除 `<button id="auth-guest-btn">...</button>` 和分隔线 "或"
```html
<!-- 删除 145-155 行的 "或" 分隔线 + 离线按钮 -->
```

### 3.2 视图切换按钮修复

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L652-L665)

```js
syncViewToggleState() {
  document.querySelectorAll('[data-view-toggle]').forEach(btn => {
    const isActive = btn.dataset.viewToggle === this.currentView;
    // 显式清理所有可能的背景/文字类
    btn.classList.remove(
      'bg-fg', 'text-white',
      'bg-muted', 'text-fg/60',
      'bg-white', 'text-fg',
      'hover:text-fg'
    );
    if (isActive) {
      btn.classList.add('bg-fg', 'text-white');
    } else {
      btn.classList.add('text-fg/60', 'hover:text-fg');
    }
  });
}
```

### 3.3 时间轴色彩简化

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css)

```css
/* 删除这些块（border-left 4px 颜色）： */
/* .vx-timeline-item[data-importance="high"]   { border-left: 4px solid var(--color-danger); } */
/* .vx-timeline-item[data-importance="medium"] { border-left: 4px solid var(--color-accent); } */
/* .vx-timeline-item[data-importance="low"]    { border-left: 4px solid var(--color-secondary); } */

/* 替换为统一的细左边线 */
.vx-timeline-item {
  position: relative;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  border-left: 2px solid var(--color-border);  /* 同其他边 */
  border-radius: var(--radius-md);
  padding: 1rem;
  transition: border-color 0.2s, transform 0.2s;
}
```

### 3.4 标签缩小

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L1365)

```js
// 改前
<span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>

// 改后
<span class="inline-block text-[10px] font-semibold uppercase px-1.5 py-px rounded ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
```

### 3.5 重要性筛选按钮语义色

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L667-L678)

```js
syncFilterState() {
  const filterClasses = {
    all:    ['bg-fg',        'text-white'],
    high:   ['bg-danger',    'text-white'],
    medium: ['bg-accent',    'text-white'],
    low:    ['bg-secondary', 'text-white']
  };
  document.querySelectorAll('#filter-bar [data-filter]').forEach(btn => {
    const f = btn.dataset.filter;
    const isActive = f === this.currentFilter;
    btn.classList.remove('bg-fg', 'bg-danger', 'bg-accent', 'bg-secondary', 'text-white', 'bg-white', 'text-fg');
    if (isActive) {
      filterClasses[f].forEach(c => btn.classList.add(c));
    } else {
      btn.classList.add('bg-white', 'text-fg');
    }
  });
}
```

**文件**：[index.html](file:///workspace/index.html#L270-L273)

```html
<!-- 删除 hover 颜色，让 syncFilterState 完全控制 -->
<button data-filter="all"    class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-fg text-white transition-all duration-200">全部</button>
<button data-filter="high"   class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">高</button>
<button data-filter="medium" class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">中</button>
<button data-filter="low"    class="h-10 px-4 rounded-md text-sm font-semibold tracking-wider uppercase bg-white text-fg transition-all duration-200">低</button>
```

### 3.6 月历每记录一点 + 语义色

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css)

```css
/* 删除旧的 has-records::after */
.vx-calendar-dots {
  position: absolute;
  bottom: 4px;
  left: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  align-items: center;
}
.vx-calendar-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  flex-shrink: 0;
}
.vx-calendar-dot.high   { background-color: var(--color-danger); }
.vx-calendar-dot.medium { background-color: var(--color-accent); }
.vx-calendar-dot.low    { background-color: var(--color-secondary); }
```

**文件**：[src/js/app.js](file:///workspace/src/js/app.js) renderCalendar

```js
// 在 renderCalendar 中先聚合 records by date
const recordsByDate = {};
allRecords.forEach(r => {
  (recordsByDate[r.date] = recordsByDate[r.date] || []).push(r.importance || 'medium');
});

// 在 for 循环中：
const dateImportances = recordsByDate[dateStr] || [];
const dotsHTML = dateImportances.length > 0
  ? `<div class="vx-calendar-dots">${dateImportances.slice(0, 5).map(imp =>
      `<span class="vx-calendar-dot ${imp}"></span>`
    ).join('')}${dateImportances.length > 5 ? `<span class="text-[8px] text-fg/60">+${dateImportances.length - 5}</span>` : ''}</div>`
  : '';

// cell HTML:
cellsHTML += `
  <div class="${classes.join(' ')}" data-date="${dateStr}">
    <span class="vx-calendar-day-number">${day}</span>
    ${dotsHTML}
  </div>
`;

// prev/next month 也加 dotsHTML (虽然 importances 是 medium 之类，但保持视觉一致)
cellsHTML += `<div class="vx-calendar-cell other-month">...<span class="vx-calendar-day-number">${day}</span>${dotsHTML}</div>`;
```

### 3.7 月历格框大小

**文件**：[index.html](file:///workspace/index.html) 中月历容器

```html
<!-- 改前 -->
<div id="calendar-grid" class="grid grid-cols-7 gap-0 border-2 border-border rounded-lg overflow-hidden"></div>

<!-- 改后 -->
<div id="calendar-grid" class="grid grid-cols-7 gap-0 border-2 border-border rounded-lg overflow-hidden max-w-3xl mx-auto"></div>
```

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css#L150-L160)

```css
.vx-calendar-cell {
  /* 删除 aspect-ratio: 1; */
  min-height: 90px;
  background-color: var(--color-bg);
  ...
}
```

**响应式**：
```css
@media (max-width: 768px) {
  .vx-calendar-cell { min-height: 70px; }
}
@media (min-width: 1024px) {
  .vx-calendar-cell { min-height: 100px; }
}
```

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | **完全删除**离线模式 / 本地时间轴 / `onGuestMode` / `auth-guest-btn` | 用户硬性要求"取消本地时间轴和离线模式" |
| D2 | 未登录时**只显示 auth 页**，主应用不可访问 | 防止本地/云端状态错乱 |
| D3 | 删除离线按钮后 auth 页**只剩"登录/注册"两个按钮**（去掉"或"分隔线） | UI 更干净 |
| D4 | 视图切换按钮改用 classList 显式管理，不依赖正则 | 解决月历态无强调 bug |
| D5 | 时间轴 item 移除 4px 语义色 border-left（保留 rail 圆点 + 标签） | 避免 3 重色彩过载 |
| D6 | 标签从 `text-xs font-bold px-2 py-0.5` 缩到 `text-[10px] font-semibold px-1.5 py-px` | 紧凑但仍可读 |
| D7 | 筛选按钮选中态用对应语义色（红/黄/绿） | 视觉强化筛选状态 |
| D8 | 月历每格 dots 容器底部对齐，**最多 5 个点 + "+N"** 溢出指示 | 显示条数同时防止溢出 |
| D9 | 月历 `aspect-ratio: 1` → `min-height: 90px` + `max-w-3xl mx-auto` | 缩小整体宽度，让单格紧凑 |
| D10 | 移除 `has-records::after` 旧单点机制 | 改用 dots 容器更精确表达 |
| D11 | 不改 syncQueue 机制（saveRecord 失败仍入队） | 已有逻辑 OK |
| D12 | 保留 cloud-status 的"离线"指示（网络断） | 那是浏览器网络状态，不是"离线模式" |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (a) 删除 `onGuestMode`；(b) 删除 `auth-guest-btn` 绑定；(c) 移除 `=== 'local'` 路径；(d) `syncViewToggleState` classList 重写；(e) 标签缩小；(f) `syncFilterState` 语义色；(g) renderCalendar 加 dots |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | (a) 月历 cell `min-height` + 移除 `aspect-ratio`；(b) 移除 `border-left: 4px` 颜色块；(c) 加 `.vx-calendar-dots` / `.vx-calendar-dot`；(d) 移除 `has-records::after` 块 |
| [index.html](file:///workspace/index.html) | 改 | (a) 删除 `auth-guest-btn` + "或" 分隔线；(b) 筛选按钮 HTML 移除 hover 颜色；(c) 月历容器加 `max-w-3xl mx-auto` |
| [sw.js](file:///workspace/sw.js) | 不改 | CACHE_NAME v3 仍有效，bump 到 v4 触发刷新 |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 不改 | OK |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 不改 | OK |
| [src/js/db.js](file:///workspace/src/js/db.js) | 不改 | OK |
| [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 不改 | OK |

## 6. Verification Steps

### 6.1 静态检查
```bash
# 1. 本地/离线相关代码消失
grep -n "onGuestMode\|auth-guest-btn\|=== 'local'\|'local'" /workspace/src/js/app.js /workspace/index.html
# 应只剩 _saveStoredTimelineId 的 else 分支 localStorage.removeItem

# 2. 月历 dots 容器类
grep -n "vx-calendar-dots\|vx-calendar-dot" /workspace/src/css/styles.css /workspace/src/js/app.js

# 3. 筛选语义色
grep -nA2 "filterClasses = {" /workspace/src/js/app.js

# 4. 标签缩小
grep -n "text-\[10px\]" /workspace/src/js/app.js

# 5. 视图切换 classList
grep -nA2 "syncViewToggleState" /workspace/src/js/app.js
```

### 6.2 JS 语法
```bash
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.3 浏览器端核心验证 8 步
1. **打开应用（未登录）**：
   - 只看到**登录/注册两个按钮**（没有"离线使用"）
   - 主应用**完全不可见**
2. **登录** → 进入主应用：
   - 时间轴下拉**只有云端时间轴**（不会出现"本地时间轴"）
   - 添加/删除/编辑都走云端
3. **顶部视图切换**：
   - 点击"时间轴"→ 时间轴按钮**黑色背景**
   - 点击"月历"→ **月历按钮变黑色**（截图 1 的问题已修）
4. **时间轴视觉**：
   - 标签尺寸明显**更紧凑**（高度从 ~20px 降到 ~14px）
   - item 左边线是普通灰色（非红/黄/绿 4px）
   - 圆点保持红/黄/绿边框
5. **重要性筛选**：
   - 默认"全部"= 黑色
   - 点击"高"= **红色** / "中"= **黄色** / "低"= **绿色**
6. **月历 dots**：
   - 每天格**有 N 个小点**（N=记录数）
   - 点颜色：高=红 / 中=黄 / 低=绿
   - 超过 5 个显示 "+N"
7. **月历格框大小**：
   - 整体宽度被 `max-w-3xl` 约束
   - 单格紧凑（90-100px）
8. **控制台**：
   - 离线模式 API 不再被调用
   - `IndexedDB.deleteRecord(NaN)` 不再触发
   - 没有重复 SIGNED_IN

### 6.4 验证离线按钮删除完整
- 搜索全文件：`onGuestMode` / `auth-guest-btn` / `'local'` / `离线使用` 都应消失
- `localStorage` 中 `vex_current_timeline_id` 不应再存 `'local'`

## 7. Out of Scope

- 不重写为 React / Vue
- 不改 Supabase 迁移 / RLS 策略
- 不改 7 色 token（继续复用 danger/accent/secondary）
- 不做暗色模式 / 国际化
- 不做 Tailwind CLI 转换
- 不改 RLS / Storage

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 删除本地模式后，已用"离线使用"的用户无法进入 | 这是用户硬性要求；如有需要可让用户先登录 |
| `currentTimelineId = null` 时多处代码崩 | 加 `if (!this.currentTimelineId) return [];` 守卫 |
| 月历 dots 太多撑爆格子 | `slice(0, 5)` 上限 + `+N` 提示 |
| 视图切换改 classList 后样式错乱 | 显式 remove + add 顺序；`hover:text-fg` 移到非选中态 |
| 筛选按钮无 hover 反馈 | 选中态用语义色已提供强反馈；非选中态保持 `text-fg` |
| 移动端 max-w-3xl 可能太宽 | 移动端 `max-w-full` 替代 |
