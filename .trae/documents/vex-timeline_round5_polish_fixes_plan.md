# VEX-Timeline Round 5 修复计划（月历/重要性/连贯时间轴/图片/刷新）

## 1. Summary

Round 4 已修 7 项（云端强制 + 视觉精修）。本轮聚焦 **7 个新问题**：

1. **月历单元背景色干扰**：`.has-high` / `.has-medium` 把整格染成淡红/淡黄；用户希望"只用小点切换颜色"（点已经在做这件事了，背景多余）
2. **添加记录全部被覆盖为高重要性**（Round 4 引入/遗留的严重 bug）：`saveRecord` 选择器 `[data-importance].bg-fg` 永远 null，fallback 到第一个按钮（高）
3. **时间轴按日期分块、日期作为大标题**：用户希望**日期作为小标题**且**时间轴上下连贯**（跨天也串在一起，竖线不中断）
4. **图片上传后消失**：base64 dataURL 直接塞进 `image_url` 字段，超过 Supabase 列长度限制 → 写入失败/截断 → 下次同步后图片丢失
5. **切换时间轴不会第一时间刷新云端**：需要点云端重试才同步
6. **云状态指示器（绿色小圆块）改为刷新按钮**：点击触发云端同步
7. **每 5 分钟自动重新连接云端，刷新数据**

## 2. Current State Analysis

### 2.1 Round 1+2+3+4 全部修复在位

- CACHE_NAME v4 ✓
- 视图切换 classList 显式管理 ✓
- 时间轴 4px 语义色 border-left 已移除（保留 8px 边框 + rail 圆点 + 标签）✓
- 筛选按钮语义色 ✓
- 月历 dots 容器（每记录 1 个点）✓
- 月历格框 min-height + max-w-3xl ✓
- 取消本地/离线模式 ✓
- onGuestMode no-op ✓
- parseInt UUID 修复 ✓
- Auth 重复订阅修复 ✓

### 2.2 本轮 7 个问题根因

#### 根因 ①：月历单元背景色

**位置**：
- [src/css/styles.css:230-235](file:///workspace/src/css/styles.css#L230-L235) — `.vx-calendar-cell.has-high` / `.has-medium` 背景色
- [src/css/styles.css:221-222](file:///workspace/src/css/styles.css#L221-L222) — 强制 `color: var(--color-fg)` 覆盖
- [src/css/styles.css:238-260](file:///workspace/src/css/styles.css#L238-L260) — Round 4 新增的 dots 容器（已正确实现）

**问题**：月历单元被 `has-high` 染成 `#FEF2F2`（淡红）、`has-medium` 染成 `#FFFBEB`（淡黄）。但 Round 4 已经在每格底部添加了 **dots 容器**（红/黄/绿小点），用点已经能表达重要性。背景色**双重表达 + 视觉干扰**。

**修复**：
- 删除 `.vx-calendar-cell.has-high { background-color: #FEF2F2; }` 整块
- 删除 `.vx-calendar-cell.has-medium { background-color: #FFFBEB; }` 整块
- 保留 `.vx-calendar-cell.has-high, .has-medium { color: var(--color-fg); }`（仍需避免 today 白字撞色）
- 保留 dots 容器（已是 Round 4 修复）
- 保留 `.vx-calendar-cell.weekend { background-color: var(--color-muted); }`（这是周末的浅灰，与重要性无关）
- 保留 `.vx-calendar-cell.today` 蓝色高亮（这是"今天"标识，与重要性无关）

#### 根因 ②：添加记录全部被覆盖为"高"重要性

**位置**：[src/js/app.js:1010-1011](file:///workspace/src/js/app.js#L1010-L1011) `saveRecord`

**当前代码**：
```js
const activeImportanceBtn = document.querySelector('#importance-selector [data-importance].bg-fg') ||
                             document.querySelector('#importance-selector [data-importance]');
```

**问题链**：
1. Round 3 把 `importanceSelectedClasses` 改为 `{ high: bg-danger, medium: bg-accent, low: bg-secondary }`
2. `setImportance` 用语义色做选中态，**不再用 `bg-fg`**
3. 但 `saveRecord` 的选择器仍是 `[data-importance].bg-fg` → **永远 null**
4. fallback 是 `#importance-selector [data-importance]`（第一个按钮）
5. HTML 中第一个重要性按钮是 "高"（line 327 附近）→ **永远是 high**

**修复**：
- 用 `data-selected` 属性追踪选中态，更可靠
- `setImportance` 写入 `data-selected="true"` 到选中的按钮
- `saveRecord` 选择器改为 `[data-importance][data-selected="true"]`
- 同时清理 Round 3 引入的所有重要性相关 class（含 `bg-fg` / `text-white` / `bg-muted` / `text-fg/60` / `bg-danger` / `bg-accent` / `bg-secondary` / `border-*`）

#### 根因 ③：时间轴按日期分块、跨天不连贯

**位置**：
- [src/js/app.js:1328-1396](file:///workspace/src/js/app.js#L1328-L1396) `renderTimeline` — 按 `r.date` 分组，每组独立 `<section>` + 独立 `.vx-timeline-rail`
- [src/css/styles.css:417-426](file:///workspace/src/css/styles.css#L417-L426) `.vx-timeline-rail::before` — 竖线只 span 当前 rail 容器

**当前问题**：
```js
const grouped = {};
filteredRecords.forEach(r => {
  (grouped[r.date] = grouped[r.date] || []).push(r);
});
const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

sortedDates.forEach(dateStr => {
  html += `
    <section class="flex flex-col gap-4">
      <div class="flex items-baseline gap-3 px-1 pb-2 border-b-2 border-border">
        <h2 class="font-extrabold text-2xl tracking-[-0.02em] text-fg">${this._escapeHtml(this.formatDateDisplay(dateStr))}</h2>
        <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">${dateRecords.length} 条</span>
      </div>
      <div class="vx-timeline-rail flex flex-col gap-4">
  `;
  // 每条记录
  html += `</div></section>`;
});
```

**问题**：
- 每个日期一个独立 `<section>` + 独立 `.vx-timeline-rail`
- 每段独立 `::before` 竖线 → **跨天不连续**
- 日期用 `text-2xl font-extrabold` 大标题 + `border-b-2` 黑色横条 → **太强势**

**修复**（按用户要求"日期作为小标题"+"跨天连贯"）：
1. **删除**按日期分组的 `grouped` / `sortedDates` 逻辑
2. **直接**对 `filteredRecords` 排序：`date desc, time desc`
3. **单一** `.vx-timeline-rail` 容器包裹所有记录
4. **每条记录**内嵌一个小日期标签（`text-[10px] uppercase tracking-wider text-fg/60 mb-1`），而不是 section header
5. **CSS** 调整：`.vx-timeline-rail::before` 改为贯穿整列（已 OK，但需要确认不被新结构破坏）

```js
// 新逻辑
let html = '';
html += `<div class="vx-timeline-rail flex flex-col gap-4">`;

filteredRecords
  .sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.time || '00:00').localeCompare(a.time || '00:00');
  })
  .forEach(record => {
    const time = record.time || '';
    const importance = record.importance || 'medium';
    const imgSrc = record.image || record.image_url || '';
    const canEdit = this.canEditRecord(record);
    const recordIdStr = String(record.id);
    const dateStr = record.date;
    const dateLabel = this.formatDateDisplay(dateStr);  // "2026年06月06日 周六"

    html += `
      <div class="vx-timeline-item" data-importance="${importance}">
        <div class="vx-rail-dot">
          <i data-lucide="${importanceIcons[importance]}"></i>
        </div>
        ${canEdit ? `...edit/delete buttons...` : ''}
        <div class="text-[10px] font-semibold uppercase tracking-wider text-fg/60 mb-1.5">
          ${this._escapeHtml(dateLabel)} · ${this._escapeHtml(time)}
        </div>
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-block text-[10px] font-semibold uppercase px-1.5 py-px rounded ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
        </div>
        <div class="font-semibold text-lg mb-1 text-fg">${this._escapeHtml(record.title)}</div>
        ${record.content ? `<div class="text-fg/60 text-sm mb-3">${this._escapeHtml(record.content)}</div>` : ''}
        ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-72 object-cover rounded-md border-2 border-border" alt="记录图片">` : ''}
      </div>
    `;
  });

html += `</div>`;
timeline.innerHTML = html;
```

注：日期标签 + 时间合并成一行 `2026年06月06日 周六 · 14:30`，小字灰色。

#### 根因 ④：图片上传后丢失

**位置**：
- [src/js/app.js:925-947](file:///workspace/src/js/app.js#L925-L947) `handleImageUpload` / `removeImage`
- [src/js/app.js:1018, 1032, 1046](file:///workspace/src/js/app.js#L1018) `saveRecord` 把 base64 写入 `image_url` 字段
- [src/js/cloud-db.js:237-249](file:///workspace/src/js/cloud-db.js#L237-L249) `uploadImage` 已实现但**从未被调用**

**问题链**：
1. 用户选图 → FileReader 读成 base64 dataURL（`data:image/png;base64,iVBOR...`）
2. `this.tempImageData = "data:image/png;base64,iVBOR..."`（长度可达 1-5 MB）
3. `saveRecord` 把这串巨长的 base64 塞进 `image_url: image` 字段
4. Supabase `records.image_url` 列类型可能是 `text`（限制 1GB 但单行总 8KB-1GB 看配置）— **实际表现**：base64 长度超出，**插入失败**或**返回 null/空**
5. `try-catch` 捕获到错误，进入 `addToSyncQueue`（添加占位任务），但**没有重试上传图片**
6. 本地 IndexedDB 记录有 `image`（base64），但 `syncFromCloud` 之后会被云端的空 `image_url` 覆盖
7. **结果**：图片丢失

**修复**：使用 Supabase Storage（已有 `cloudDBManager.uploadImage`）

```js
// saveRecord 中新增：上传 base64 → 公共 URL
let imageUrl = this.tempImageData;
if (imageUrl && imageUrl.startsWith('data:')) {
  try {
    const file = this._dataURLtoFile(imageUrl, 'image.png');
    imageUrl = await cloudDBManager.uploadImage(file, this.currentTimelineId);
  } catch (e) {
    console.warn('[VEX-Timeline] 图片上传失败，尝试保存原 base64', e);
    // 继续保存 base64（虽然云端可能丢失，但至少本地有）
  }
}
const image = imageUrl;  // 现在 image 是 URL 而非 base64
```

新增工具方法 `_dataURLtoFile`：
```js
_dataURLtoFile(dataURL, filename) {
  const [meta, base64] = dataURL.split(',');
  const mimeMatch = meta.match(/data:([^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new File([array], filename, { type: mime });
}
```

**删除记录时同步删除 Storage 文件**（避免孤儿）：
```js
// deleteRecord 中
if (record.image_url && record.image_url.startsWith('http')) {
  try { await cloudDBManager.deleteImage(record.image_url); } catch (e) { /* ignore */ }
}
```

#### 根因 ⑤：切换时间轴不自动刷云端

**位置**：[src/js/app.js:251-262](file:///workspace/src/js/app.js#L251-L262) `updateTimelineSelector` 内 click handler

**当前**：
```js
btn.addEventListener('click', (e) => {
  const id = e.currentTarget.dataset.timelineValue;
  this.currentTimelineId = id;
  this._saveStoredTimelineId(this.currentTimelineId);
  this.updateTimelineSelector();
  this.updateTimelineLabel(this._findTimelineName(id));
  this.updateManageButton();
  this.closeAllMenus();
  this.renderView();   // ← 只用本地 IndexedDB 渲染
});
```

**问题**：切换时间轴后，`renderView` 只读取 IndexedDB 本地缓存（来自上次同步），**不触发云端拉取**。

**修复**：
```js
btn.addEventListener('click', async (e) => {
  const id = e.currentTarget.dataset.timelineValue;
  this.currentTimelineId = id;
  this._saveStoredTimelineId(this.currentTimelineId);
  this.updateTimelineSelector();
  this.updateTimelineLabel(this._findTimelineName(id));
  this.updateManageButton();
  this.closeAllMenus();
  await this.renderView();        // 先用本地数据快速渲染
  this.syncFromCloud();           // 后台拉取云端（async，不阻塞 UI）
});
```

#### 根因 ⑥：云状态指示器改刷新按钮

**位置**：
- [index.html:194-196](file:///workspace/index.html#L194-L196) — 当前是 `<span id="cloud-status">`
- [src/js/app.js:296-321](file:///workspace/src/js/app.js#L296-L321) — `updateCloudStatusIcon` 只更新 class 和 icon
- [src/css/styles.css:362-381](file:///workspace/src/css/styles.css#L362-L381) — `.vx-cloud-status` 样式

**当前**：`<span id="cloud-status" class="vx-cloud-status" title="云端状态">`

**问题**：span 不能点击 → 用户无法主动触发同步

**修复**：
- HTML 改为 `<button id="cloud-status" type="button" class="vx-cloud-status" title="点击刷新云端">`
- `bindEvents` 中添加 click handler：
  ```js
  const cloudStatus = document.getElementById('cloud-status');
  if (cloudStatus) {
    cloudStatus.addEventListener('click', async () => {
      if (!authManager.isLoggedIn() || !this.currentTimelineId) return;
      this.showToast('正在从云端刷新…', 'info');
      try {
        await this.syncFromCloud();
        this.showToast('云端数据已同步', 'success');
      } catch (e) {
        this.showToast('刷新失败: ' + (e.message || e), 'error');
      }
    });
  }
  ```
- 移动端云状态（如果存在）也加同样 handler
- CSS：`.vx-cloud-status` 加 `cursor: pointer` + hover 态（保持视觉差异小）
- 文案更新：`title` 改为 "点击刷新云端"；status 文案可保留（"已连接"/"同步中"/"离线"）

**视觉保持不变**：仍是绿色圆块/小圆角。点击后变 `is-syncing`（旋转图标）。

#### 根因 ⑦：每 5 分钟自动刷新

**位置**：[src/js/app.js:init()](file:///workspace/src/js/app.js) `init` 方法末尾

**修复**：
```js
async init() {
  await dbManager.initDB();
  supabaseManager.init();
  await authManager.init();
  await this._waitForUserProfile(3000);

  this.bindEvents();
  this.setupNetworkListener();
  this.renderDiagnosticBar();

  // Round 5：每 5 分钟自动从云端刷新（仅登录态）
  this._startAutoRefresh();

  if (authManager.isLoggedIn()) { ... }
}

_startAutoRefresh() {
  // 清理旧 interval（避免多次启动）
  if (this._autoRefreshInterval) clearInterval(this._autoRefreshInterval);
  this._autoRefreshInterval = setInterval(async () => {
    if (!authManager.isLoggedIn() || !this.currentTimelineId || !this.isOnline) return;
    if (this.syncInProgress) return;  // 避免重叠
    if (this.cloudSyncStatus === 'error') return;  // 错误态不重试
    try {
      await this.syncFromCloud();
    } catch (e) {
      console.warn('[VEX-Timeline] Auto refresh failed:', e.message || e);
    }
  }, 5 * 60 * 1000);  // 5 分钟
}
```

**清理**：登出时清理 interval（避免内存泄漏）
```js
async handleLogout() {
  if (this._autoRefreshInterval) {
    clearInterval(this._autoRefreshInterval);
    this._autoRefreshInterval = null;
  }
  // ...existing logout logic...
}
```

## 3. Proposed Changes

### 3.1 月历单元背景色移除

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css#L230-L235)

```css
/* Round 5：移除 has-high/has-medium 背景色（避免视觉干扰，重要性由 dots 容器表达） */
/* .vx-calendar-cell.has-high { background-color: #FEF2F2; } */
/* .vx-calendar-cell.has-medium { background-color: #FFFBEB; } */
```

保留：
- `.vx-calendar-cell.has-high, .has-medium { color: var(--color-fg); }`（防 today 白字撞色）
- `.vx-calendar-cell.weekend { background-color: var(--color-muted); }`（周末浅灰，**与重要性无关**）
- `.vx-calendar-cell.today` 蓝色高亮（**与重要性无关**）
- `.vx-calendar-dots` 容器（Round 4 已就位）

### 3.2 重要性保存 bug 修复

**文件**：[src/js/app.js](file:///workspace/src/js/app.js)

修改 `setImportance` 用 `data-selected` 属性：
```js
setImportance(val) {
  document.querySelectorAll('#importance-selector [data-importance]').forEach(btn => {
    const v = btn.dataset.importance;
    const isSelected = v === val;
    btn.classList.remove(
      'bg-fg', 'text-white', 'bg-muted', 'text-fg/60',
      'bg-danger', 'bg-accent', 'bg-secondary',
      'border-danger', 'border-accent', 'border-secondary'
    );
    // Round 5：用 data-selected 属性追踪选中态（更可靠，不依赖 class）
    if (isSelected) {
      btn.setAttribute('data-selected', 'true');
      this.importanceSelectedClasses[v].forEach(c => btn.classList.add(c));
    } else {
      btn.removeAttribute('data-selected');
      btn.classList.add('bg-muted', 'text-fg/60');
    }
  });
}
```

修改 `saveRecord` 选择器：
```js
// 改前
const activeImportanceBtn = document.querySelector('#importance-selector [data-importance].bg-fg') ||
                             document.querySelector('#importance-selector [data-importance]');

// 改后
const activeImportanceBtn = document.querySelector('#importance-selector [data-importance][data-selected="true"]') ||
                             document.querySelector('#importance-selector [data-importance].bg-danger, #importance-selector [data-importance].bg-accent, #importance-selector [data-importance].bg-secondary') ||
                             document.querySelector('#importance-selector [data-importance]');
```

三重 fallback 保证向后兼容：
1. **首选**：`data-selected="true"`（新机制，最可靠）
2. **次选**：3 个语义色 class（兼容旧版可能的状态）
3. **兜底**：第一个按钮（极端情况，给 medium 也行；用户必点一下就 OK）

### 3.3 时间轴连贯 + 日期小标题

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L1328-L1396) `renderTimeline`

完整重写（删除 `grouped` / `sortedDates` 逻辑）：

```js
async renderTimeline() {
  const timeline = document.getElementById('timeline');
  this.showLoadingState();
  await new Promise(resolve => setTimeout(resolve, 100));

  this.records = await this.getRecordsForCurrentTimeline();
  let filteredRecords = this.records;
  if (this.currentFilter !== 'all') {
    filteredRecords = this.records.filter(r => r.importance === this.currentFilter);
  }

  if (filteredRecords.length === 0) {
    timeline.innerHTML = `<div class="vx-empty">暂无记录</div>`;
    return;
  }

  const importanceBadgeColors = {
    high:   'bg-danger text-white',
    medium: 'bg-accent text-white',
    low:    'bg-secondary text-white'
  };
  const importanceIcons = {
    high:   'alert-circle',
    medium: 'circle-dot',
    low:    'check-circle'
  };
  const importanceLabel = { high: '高', medium: '中', low: '低' };

  // Round 5：按 date desc, time desc 排序（不再分组）
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.time || '00:00').localeCompare(a.time || '00:00');
  });

  // Round 5：单一 .vx-timeline-rail 容器包裹所有记录（跨天连贯）
  let html = `<div class="vx-timeline-rail flex flex-col gap-6">`;

  sortedRecords.forEach(record => {
    const time = record.time || '';
    const importance = record.importance || 'medium';
    const imgSrc = record.image || record.image_url || '';
    const canEdit = this.canEditRecord(record);
    const recordIdStr = String(record.id);
    const dateLabel = this.formatDateDisplay(record.date);
    // 格式：2026年06月06日 周六 · 14:30（小标题）
    const metaLine = `${dateLabel} · ${this._escapeHtml(time) || '—'}`;

    html += `
      <div class="vx-timeline-item" data-importance="${importance}">
        <div class="vx-rail-dot">
          <i data-lucide="${importanceIcons[importance]}"></i>
        </div>
        ${canEdit ? `
          <div class="flex gap-2 justify-end mb-3">
            <button class="vx-action-btn h-8 w-8 bg-muted text-fg rounded-md flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-200 vx-edit-btn" data-id="${recordIdStr}" title="编辑">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button class="vx-action-btn h-8 w-8 bg-muted text-fg rounded-md flex items-center justify-center hover:bg-danger hover:text-white transition-all duration-200 vx-delete-btn" data-id="${recordIdStr}" title="删除">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        ` : ''}
        <div class="text-[10px] font-semibold uppercase tracking-wider text-fg/60 mb-1.5">${metaLine}</div>
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-block text-[10px] font-semibold uppercase px-1.5 py-px rounded ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
        </div>
        <div class="font-semibold text-lg mb-1 text-fg">${this._escapeHtml(record.title)}</div>
        ${record.content ? `<div class="text-fg/60 text-sm mb-3">${this._escapeHtml(record.content)}</div>` : ''}
        ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-72 object-cover rounded-md border-2 border-border" alt="记录图片">` : ''}
      </div>
    `;
  });

  html += `</div>`;
  timeline.innerHTML = html;
  if (window.lucide && lucide.createIcons) lucide.createIcons();

  // edit/delete 事件绑定（保持原样）
  document.querySelectorAll('.vx-edit-btn').forEach(btn => { ... });
  document.querySelectorAll('.vx-delete-btn').forEach(btn => { ... });
}
```

**不需要 CSS 改动**：`.vx-timeline-rail::before` 已能正确画贯穿竖线（只要容器包裹所有记录即可）。

### 3.4 图片上传到 Supabase Storage

**文件**：[src/js/app.js](file:///workspace/src/js/app.js)

新增工具方法：
```js
_dataURLtoFile(dataURL, filename = 'image.png') {
  try {
    const [meta, base64] = dataURL.split(',');
    const mimeMatch = meta.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new File([array], filename, { type: mime });
  } catch (e) {
    console.error('[VEX-Timeline] dataURL → File 转换失败:', e);
    return null;
  }
}
```

修改 `saveRecord`（图片上传 + 存储 URL 而非 base64）：
```js
const importance = activeImportanceBtn ? activeImportanceBtn.dataset.importance : 'medium';
let imageUrl = this.tempImageData;

// Round 5：如果是 base64 dataURL，先上传到 Supabase Storage
if (imageUrl && imageUrl.startsWith('data:')) {
  try {
    const file = this._dataURLtoFile(imageUrl, 'image.png');
    if (file) {
      imageUrl = await cloudDBManager.uploadImage(file, this.currentTimelineId);
      console.log('[VEX-Timeline] 图片已上传:', imageUrl);
    }
  } catch (e) {
    console.warn('[VEX-Timeline] 图片上传失败，保存原 base64（云端可能丢失）:', e);
    // 继续保存 base64（IndexedDB 还在，云端可能没图）
  }
}

const recordData = { date, time, title, content, importance, image: imageUrl, timeline_id: this.currentTimelineId };
```

修改 `deleteRecord`（删除记录时同步删 Storage 文件）：
```js
async deleteRecord(id) {
  if (!confirm('确定要删除这条记录吗？')) return;
  const record = this.records.find(r => String(r.id) === String(id));
  await dbManager.deleteRecord(id);
  // Round 5：删除云端记录 + 同步清理 Storage 图片
  if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId && record) {
    // 删除图片（如果是 URL）
    if (record.image_url && record.image_url.startsWith('http')) {
      try { await cloudDBManager.deleteImage(record.image_url); } catch (e) { /* ignore */ }
    }
    // 删除记录
    if (this.isOnline) {
      try {
        if (record.cloud_id) await cloudDBManager.deleteRecord(record.cloud_id);
      } catch (e) {
        await dbManager.addToSyncQueue('delete', { cloud_id: record.cloud_id, timeline_id: record.timeline_id });
      }
    } else {
      await dbManager.addToSyncQueue('delete', { cloud_id: record.cloud_id, timeline_id: record.timeline_id });
    }
  }
  await this.renderView();
}
```

注：`record.image_url` 可能在 IndexedDB 中叫 `image`（本地的字段名）。我需要确保 `record.image` 和 `record.image_url` 都能拿到值。Round 3 修过这个：`record.image || record.image_url` —— 用 `||` 即可。

### 3.5 切换时间轴自动刷新云端

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L251-L262)

```js
btn.addEventListener('click', async (e) => {
  const id = e.currentTarget.dataset.timelineValue;
  this.currentTimelineId = id;
  this._saveStoredTimelineId(this.currentTimelineId);
  this.updateTimelineSelector();
  this.updateTimelineLabel(this._findTimelineName(id));
  this.updateManageButton();
  this.closeAllMenus();
  await this.renderView();         // 先用本地缓存快速渲染
  this.syncFromCloud();             // 后台拉取云端最新数据
});
```

### 3.6 云状态指示器改刷新按钮

**文件**：[index.html](file:///workspace/index.html#L194-L196)

```html
<button id="cloud-status" type="button" class="vx-cloud-status" title="点击刷新云端">
  <span class="vx-cloud-icon"><i data-lucide="cloud" class="w-4 h-4"></i></span>
</button>
```

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css#L362-L381)

```css
.vx-cloud-status {
  /* ... 原有样式 ... */
  cursor: pointer;          /* 改：指示可点击 */
  border: none;             /* 改：移除默认 button border */
  padding: 0;               /* 改：button 重置 */
  outline: none;            /* 改：focus outline 由 :focus-visible 处理 */
  /* ... 已有 ... */
}

.vx-cloud-status:hover {
  transform: scale(1.05);
  border-color: var(--color-primary);
}

.vx-cloud-status:active {
  transform: scale(0.95);
}
```

**文件**：[src/js/app.js](file:///workspace/src/js/app.js) `bindEvents`

在合适位置（云端重试按钮附近）添加：
```js
// 云状态指示器 → 刷新按钮
const cloudStatusBtn = document.getElementById('cloud-status');
if (cloudStatusBtn) {
  cloudStatusBtn.addEventListener('click', async () => {
    if (!authManager.isLoggedIn() || !this.currentTimelineId) {
      this.showToast('请先登录并选择时间轴', 'warning');
      return;
    }
    if (this.syncInProgress) {
      this.showToast('正在同步中，请稍候', 'info');
      return;
    }
    this.showToast('正在从云端刷新…', 'info');
    try {
      await this.syncFromCloud();
      this.showToast('云端数据已同步', 'success');
    } catch (e) {
      this.showToast('刷新失败: ' + (e.message || e), 'error');
    }
  });
}
```

`updateCloudStatusIcon` 方法保持不变（仍更新 class 和 icon 视觉），只是容器从 span 变 button。

### 3.7 每 5 分钟自动刷新

**文件**：[src/js/app.js](file:///workspace/src/js/app.js)

新增方法：
```js
_startAutoRefresh() {
  if (this._autoRefreshInterval) clearInterval(this._autoRefreshInterval);
  this._autoRefreshInterval = setInterval(async () => {
    if (!authManager.isLoggedIn() || !this.currentTimelineId || !this.isOnline) return;
    if (this.syncInProgress) return;
    if (this.cloudSyncStatus === 'error') return;  // 错误态不重试
    try {
      await this.syncFromCloud();
      console.log('[VEX-Timeline] Auto refresh @', new Date().toLocaleTimeString());
    } catch (e) {
      console.warn('[VEX-Timeline] Auto refresh failed:', e.message || e);
    }
  }, 5 * 60 * 1000);
}

_stopAutoRefresh() {
  if (this._autoRefreshInterval) {
    clearInterval(this._autoRefreshInterval);
    this._autoRefreshInterval = null;
  }
}
```

`init` 方法末尾调用：
```js
async init() {
  await dbManager.initDB();
  supabaseManager.init();
  await authManager.init();
  await this._waitForUserProfile(3000);

  this.bindEvents();
  this.setupNetworkListener();
  this.renderDiagnosticBar();

  // Round 5：启动 5 分钟自动刷新
  this._startAutoRefresh();

  if (authManager.isLoggedIn()) { ... }
}
```

`handleLogout` 中清理：
```js
async handleLogout() {
  this._stopAutoRefresh();          // Round 5
  await authManager.logout();
  this.currentTimelineId = null;
  this._saveStoredTimelineId(null);
  this.timelines = [];
  this.showAuthPage();
  // ... 已有
}
```

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | 月历单元移除 `has-high/has-medium` 背景色 | 用户明确要求"只用小点切换颜色"；Round 4 已加 dots 容器 |
| D2 | 用 `data-selected="true"` 属性追踪重要性选中态 | 比 class 更可靠（不依赖 CSS class 名变化） |
| D3 | `saveRecord` 选择器三重 fallback（`data-selected` → 语义色 class → 第一个按钮） | 最大化向后兼容 |
| D4 | 时间轴删除日期分组，**单一 rail 容器**包裹所有记录 | 用户明确要求"跨天连贯" |
| D5 | 日期 + 时间合并成单行小标题 `text-[10px] text-fg/60` | 用户要求"小标题"；不与重要性标签冲突（两行） |
| D6 | 图片上传用 Supabase Storage（已有 `uploadImage` 但未调用） | base64 超过 text 列限制 → 必丢失；Storage 才是正路 |
| D7 | 上传失败时降级保存 base64（继续工作） | 容错：用户至少本地有图 |
| D8 | 删除记录时同步清理 Storage 图片 | 避免孤儿文件（成本高） |
| D9 | 切换时间轴用 `await renderView()` 然后 `syncFromCloud()`（不 await） | 先快速本地渲染，再后台云端；UI 不阻塞 |
| D10 | 云状态 span → button，点击触发 `syncFromCloud()` | 用户硬性要求 |
| D11 | 视觉保持绿色圆块（不变），加 `cursor: pointer` + hover scale | 用户要求"按钮样式不变" |
| D12 | 5 分钟自动刷新 interval；登录时启动，登出时清理 | 避免内存泄漏 |
| D13 | 自动刷新跳过 `cloudSyncStatus === 'error'` 态 | 错误态不重试，避免日志噪音 |
| D14 | 保留 `cloudDBManager.uploadImage` / `deleteImage`（已存在） | 复用即可 |
| D15 | `record.image` 和 `record.image_url` 兼容读取（`||`） | 兼容 IndexedDB 本地 + 云端 |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | (a) 删除 `.vx-calendar-cell.has-high/has-medium` 背景色；(b) `.vx-cloud-status` 加 `cursor: pointer` + hover/active 态 + 移除 button 默认 border/padding |
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (a) `setImportance` 改用 `data-selected` 属性；(b) `saveRecord` 选择器三重 fallback；(c) `saveRecord` 图片上传到 Storage；(d) 新增 `_dataURLtoFile` 工具方法；(e) `deleteRecord` 同步删 Storage 图片；(f) `renderTimeline` 改连贯渲染；(g) 时间轴 select click 加 `syncFromCloud()`；(h) 云状态 click 触发刷新；(i) `init` 启动自动刷新；(j) `handleLogout` 清理 interval；(k) 新增 `_startAutoRefresh` / `_stopAutoRefresh` |
| [index.html](file:///workspace/index.html) | 改 | (a) `<span id="cloud-status">` → `<button id="cloud-status">` |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 不改 | `uploadImage` / `deleteImage` 已存在 |
| [src/js/db.js](file:///workspace/src/js/db.js) | 不改 | OK |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 不改 | OK |
| [sw.js](file:///workspace/sw.js) | 改 | Bump v4 → v5 触发 SW 刷新 |
| [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 不改 | OK |

## 6. Verification Steps

### 6.1 静态检查
```bash
# 1. 月历背景色清理
grep -n "has-high.*FEF2F2\|has-medium.*FFFBEB" /workspace/src/css/styles.css
# 应为空

# 2. data-selected 引入
grep -n "data-selected" /workspace/src/js/app.js
# 应有 setAttribute + removeAttribute + selector 共 3+ 处

# 3. 单一 rail 容器
grep -n "vx-timeline-rail" /workspace/src/js/app.js
# 应只有 1 处（单一容器）

# 4. Storage 上传
grep -n "uploadImage\|deleteImage\|_dataURLtoFile" /workspace/src/js/app.js

# 5. 自动刷新
grep -n "_startAutoRefresh\|_autoRefreshInterval" /workspace/src/js/app.js

# 6. 云状态 button
grep -n "cloud-status" /workspace/index.html /workspace/src/css/styles.css
```

### 6.2 JS 语法
```bash
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.3 浏览器端核心验证 9 步
1. **月历视觉**：
   - 点击某天含 3 条记录（高/中/低）→ cell 底部有 3 个红/黄/绿点
   - cell 背景**无淡红/淡黄染色**（白色为主）
2. **添加记录 → 选择"中"重要性 → 保存**：
   - 新记录显示**黄色标签**（不是红色）
   - 控制台无 `[VEX-Timeline] Auto refresh` 之类异常
3. **时间轴视觉**：
   - 跨 2-3 天的记录 → **单一连续竖线**贯穿所有记录
   - 每条记录**内嵌**日期+时间小标题（`text-[10px] text-fg/60`）
   - 无大日期 section header
4. **图片上传**：
   - 添加记录 → 选 1 张图 → 保存
   - 记录显示图片
   - **刷新页面后图片仍存在**（关键：Storage URL 持久）
5. **切换时间轴**：
   - 切换到另一个时间轴 → 自动触发云端同步（顶部云状态显示"同步中"旋转）
   - 同步完成后显示新时间轴的云端数据
6. **云状态按钮**：
   - 点击绿色圆块 → 触发同步 → 显示"云端数据已同步"toast
   - 视觉仍是绿色圆块（不变）
7. **自动刷新**：
   - 等待 5 分钟（或临时改 interval 测一下）→ 自动触发同步
   - 控制台日志 `[VEX-Timeline] Auto refresh @ HH:MM:SS`
8. **登出清理**：
   - 登出 → 离开页面 1 分钟后无新同步（interval 已清理）
9. **控制台**：
   - 无 saveRecord 选择器 null 警告
   - 无图片 base64 截断错误
   - 离线/在线切换正常

### 6.4 删除图片验证
- 删除含图片的记录 → Supabase Storage 中 `record-images/{timelineId}/` 下文件被同步删除

## 7. Out of Scope

- 不重写为 React / Vue
- 不改 Supabase 迁移 / RLS 策略
- 不改 7 色 token
- 不做暗色模式 / 国际化
- 不做 Tailwind CLI 转换
- 不改 RLS / Storage bucket 策略（假设 `record-images` bucket 已 public read）
- 不压缩图片（接受原图上传，避免复杂度）

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 图片上传失败导致记录丢失 | 降级保存 base64（至少本地有图） |
| `record-images` bucket 不存在 | 上传时报错 → 降级 base64；UI 仍工作 |
| 自动刷新太频繁导致 Supabase 配额耗尽 | 5 分钟间隔 + 跳过 error/syncing 态 + 切换时间轴不重复触发 |
| 时间轴连贯后第 1 条/最后 1 条的圆点位置异常 | 调整 `.vx-timeline-rail::before` 的 `top/bottom` 留出 padding |
| button 元素默认样式污染 `.vx-cloud-status` | CSS 显式 `border: none; padding: 0; outline: none;` |
| data-selected 属性被其他代码误改 | 仅 `setImportance` 写入；其他选择器仍用语义色 class 兼容 |
| 删除 Storage 图片失败时记录仍在 | try-catch + log，不影响记录删除流程 |
| 切换时间轴频繁触发 syncFromCloud | 5 分钟内已有同步就跳过（syncInProgress 守卫） |
