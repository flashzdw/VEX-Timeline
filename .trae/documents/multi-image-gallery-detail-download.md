# VEX-Timeline 计划：多图导入 + 图库 + 卡片详情 + 图片下载

> **本计划执行状态**：用户在再次 `/plan` 时已确认此计划。**已实现**部分（schema 变更 / cloud-db 字段透传 / index.html DOM 注入 / app.js 工具方法 / 多图上传 / 图库视图 / 详情 modal / lightbox）都基于本计划的 3.1–3.6 / 3.8 / 3.12 节落地。本文件**新增** §9「剩余 6 步」专门列出还没做的收尾工作（bindEvents 事件、卡片点击 → 详情、卡片多图渲染、showDayRecords 多图、CSS 样式、i18n 键、SW 缓存 bump、验证）。已实现部分保留原 §1–§8 作为历史参考。

## 9. 剩余实施清单（Plan Mode 重启后）

### 9.1 状态盘点（2026-06-14）

| # | 子任务 | 状态 | 位置 |
|---|---|---|---|
| 1 | schema `010_add_image_urls_array.sql` | ✅ 完成 | [supabase/migrations/010_add_image_urls_array.sql](file:///workspace/supabase/migrations/010_add_image_urls_array.sql) |
| 2 | cloud-db `addRecord` 透传 `image_urls` | ✅ 完成 | [src/js/cloud-db.js:13-32](file:///workspace/src/js/cloud-db.js#L13-L32) |
| 3 | `index.html` 注入 JSZip CDN | ✅ 完成 | [index.html:1310](file:///workspace/index.html#L1310) |
| 4 | `index.html` view toggle 增 gallery 按钮 | ✅ 完成 | [index.html:850-853](file:///workspace/index.html#L850-L853) |
| 5 | `index.html` 注入 `<section id="gallery-container">` + 底部 action bar | ✅ 完成 | [index.html:991-1030](file:///workspace/index.html#L991-L1030) |
| 6 | `index.html` 注入 `<div id="record-detail-overlay">` | ✅ 完成 | [index.html:1032-1048](file:///workspace/index.html#L1032-L1048) |
| 7 | `index.html` 记录 modal 改多图（`#record-images` multiple + `#images-preview` 网格） | ✅ 完成 | [index.html:1107-1118](file:///workspace/index.html#L1107-L1118) |
| 8 | app.js 工具方法（`_getRecordImages` / `_getRecordMainImage` / `_downloadImage` / `_downloadBlob` / `_getGalleryItems`） | ✅ 完成 | [src/js/app.js:3574-3589](file:///workspace/src/js/app.js#L3574-L3589) |
| 9 | app.js 多图上传（`handleImagesUpload` / `_renderImagesPreview` / `_removeImageAt` / `clearAllImages` / `tempImages`） | ✅ 完成 | [src/js/app.js:954-976](file:///workspace/src/js/app.js#L954-L976)（bindEvents）+ openModal/saveRecord/deleteRecord 中 |
| 10 | app.js 图库视图（`renderGallery` / `_refreshGallerySelectionUI` / `_exitGallerySelection` / `_downloadGalleryZip`） | ✅ 完成 | [src/js/app.js:3297-3436](file:///workspace/src/js/app.js#L3297-L3436) |
| 11 | app.js 详情 modal + lightbox（`showRecordDetail` / `closeRecordDetail` / `_openLightbox` / `_lightboxStep` / `_closeLightbox` / `_refreshLightbox`） | ✅ 完成 | [src/js/app.js:3047-3284](file:///workspace/src/js/app.js#L3047-L3284) |
| 12 | app.js `bindEvents` 增 gallery 按钮、详情关闭、ESC 键、←/→ 翻图、card 卡片点击 → 详情、卡片图片 click → lightbox | ❌ **未做** | §9.2 |
| 13 | app.js `renderTimeline` + `showDayRecords` 卡片多图渲染（横向 carousel / 缩略图条 / 卡片点击 → detail） | ❌ **未做** | §9.3 |
| 14 | styles.css 增 vx-gallery / detail / lightbox / 多图 / vx-image-remove 等样式 | ❌ **未做** | §9.4 |
| 15 | i18n.js 增 zh + en key（`app.view.gallery` / `app.gallery.*` / `app.modal.images/chooseFiles/noFiles/filesSelected` / `app.detail.*` / `app.image.*`） | ❌ **未做** | §9.5 |
| 16 | sw.js 缓存 v41 → v42 | ❌ **未做** | §9.6 |
| 17 | 验证：grep + node --check + 浏览器端 5 步核心流程 | ❌ **未做** | §9.7 |

### 9.2 Task 12 — `bindEvents` 收尾（`src/js/app.js`）

**插入位置**：[src/js/app.js:1275](file:///workspace/src/js/app.js#L1275) `bindEvents()` 末尾（FAQ 手风琴后），追加：

```js
// ====== Round 42: 图库操作按钮 ======
const gallerySelectBtn = document.getElementById('gallery-select-btn');
if (gallerySelectBtn) gallerySelectBtn.addEventListener('click', () => {
  this._gallerySelectionMode = true;
  this._gallerySelected.clear();
  this.renderGallery();
});
const galleryCancelBtn = document.getElementById('gallery-cancel-btn');
if (galleryCancelBtn) galleryCancelBtn.addEventListener('click', () => this._exitGallerySelection());
const galleryDownloadBtn = document.getElementById('gallery-download-btn');
if (galleryDownloadBtn) galleryDownloadBtn.addEventListener('click', () => this._downloadGalleryZip());
const galleryDownloadAllBtn = document.getElementById('gallery-download-all-btn');
if (galleryDownloadAllBtn) galleryDownloadAllBtn.addEventListener('click', () => {
  this._gallerySelected = new Set(this._getGalleryItems().map(it => it.url));
  this._downloadGalleryZip();
});

// ====== Round 42: 详情 modal 关闭 ======
const closeDetailBtn = document.getElementById('close-record-detail');
if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => this.closeRecordDetail());
const detailOverlay = document.getElementById('record-detail-overlay');
if (detailOverlay) {
  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) this.closeRecordDetail();
  });
}

// ====== Round 42: 全局 ESC + 详情内 ←/→ 翻图 ======
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (this._lightboxOpen) { this._closeLightbox(); return; }
    const detail = document.getElementById('record-detail-overlay');
    if (detail && detail.classList.contains('active')) { this.closeRecordDetail(); return; }
  }
  // 详情 modal 打开时 ← / → 翻图
  const detail = document.getElementById('record-detail-overlay');
  if (detail && detail.classList.contains('active') && this._currentDetailRecordId) {
    const r = (this.records || []).find(x => String(x.id) === this._currentDetailRecordId);
    if (!r) return;
    const imgs = this._getRecordImages(r);
    if (imgs.length < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.showRecordDetail(r, (this._currentDetailImageIndex - 1 + imgs.length) % imgs.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.showRecordDetail(r, (this._currentDetailImageIndex + 1) % imgs.length);
    }
  }
});
```

### 9.3 Task 13 — 卡片多图渲染 + 点击 → 详情 / lightbox（`src/js/app.js`）

**A. 改 `renderTimeline` 卡片渲染**（[src/js/app.js:3502-3538](file:///workspace/src/js/app.js#L3502-L3538)）

把单图 `${imgSrc ? `<img ...>` : ''}` 替换为多图 carousel 块：

```js
// 旧:
//   const imgSrc = record.image || record.image_url || '';
//   ...
//   ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-72 ..." alt="记录图片">` : ''}

// 新:
const imgs = this._getRecordImages(record);
let cardImgsHtml = '';
if (imgs.length > 0) {
  const extra = Math.max(imgs.length - 1, 0);
  cardImgsHtml = `
    <div class="vx-card-imgs relative mt-2">
      <div class="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1">
        ${imgs.map(u => `
          <img src="${this._escapeHtml(u)}" loading="lazy"
               class="snap-start shrink-0 max-h-48 w-auto object-cover rounded-md border-2 border-border cursor-zoom-in vx-card-img"
               data-record-id="${recordIdStr}" alt="${this._escapeHtml(record.title || '')}">
        `).join('')}
      </div>
      ${extra > 0 ? `<div class="absolute top-1 right-1 px-1.5 py-0.5 bg-fg text-canvas text-[10px] font-semibold rounded">+${extra}</div>` : ''}
    </div>
  `;
}
```

**B. 改 `renderTimeline` 末尾的事件绑定**（[src/js/app.js:3549-3562](file:///workspace/src/js/app.js#L3549-L3562)）

在 edit/delete 按钮绑定后追加：

```js
// Round 42: 卡片正文点击 → 打开详情 modal（避开编辑/删除/图片按钮）
const timelineEl = document.getElementById('timeline');
if (timelineEl) {
  timelineEl.onclick = (e) => {
    // 点中编辑/删除/图片按钮 → 不开 detail
    if (e.target.closest('.vx-edit-btn, .vx-delete-btn, .vx-card-img')) return;
    const item = e.target.closest('.vx-timeline-item');
    if (!item) return;
    // 从 item 内找带 data-id 的编辑/删除按钮来取 id
    const idHolder = item.querySelector('.vx-edit-btn, .vx-delete-btn');
    if (!idHolder) return;
    const id = idHolder.dataset.id;
    const record = this.records.find(r => String(r.id) === id);
    if (record) this.showRecordDetail(record, 0);
  };
}

// Round 42: 卡片内图片点击 → 打开 lightbox（不开 detail）
document.querySelectorAll('.vx-card-img').forEach(img => {
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = img.dataset.recordId;
    const record = this.records.find(r => String(r.id) === id);
    if (record) this._openLightbox(this._getRecordImages(record), 0);
  });
});
```

**C. 改 `showDayRecords` 弹窗**（[src/js/app.js:2987-3033](file:///workspace/src/js/app.js#L2987-L3033)）

把单图 `${imgSrc ? `<img ...>` : ''}` 替换为多图 carousel 块（同 A 的 HTML 模板，但不带 `+N` 角标 —— 弹窗一般不超过 10 图，全部展开）。`vx-day-record` 的 onclick 也走 detail。

```js
// 把 showDayRecords 中:
//   const imgSrc = record.image || record.image_url || '';
//   ...
//   ${imgSrc ? `<img ...>` : ''}
// 替换为：
const imgs = this._getRecordImages(record);
let dayImgsHtml = '';
if (imgs.length > 0) {
  dayImgsHtml = `
    <div class="vx-card-imgs relative">
      <div class="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1">
        ${imgs.map(u => `
          <img src="${this._escapeHtml(u)}" loading="lazy"
               class="snap-start shrink-0 max-h-64 w-auto object-cover rounded-md border-2 border-border cursor-zoom-in vx-day-img"
               data-record-id="${String(record.id)}" alt="${this._escapeHtml(record.title || '')}">
        `).join('')}
      </div>
    </div>
  `;
}

// 内容容器 `content.innerHTML = html;` 后追加：
content.querySelectorAll('.vx-day-img').forEach(img => {
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = img.dataset.recordId;
    const record = this.records.find(r => String(r.id) === id);
    if (record) this._openLightbox(this._getRecordImages(record), 0);
  });
});
// 让 .vx-day-record 卡片点击 → 打开 detail
content.querySelectorAll('.vx-day-record').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.vx-day-img')) return;
    const id = card.querySelector('.vx-day-img')?.dataset.recordId;
    if (!id) return;
    const record = this.records.find(r => String(r.id) === id);
    if (record) {
      this.closeDayRecords();
      this.showRecordDetail(record, 0);
    }
  });
});
```

### 9.4 Task 14 — CSS 样式（`src/css/styles.css`）

在文件末尾追加：

```css
/* ============================================================
   Round 42: 多图 / 图库 / 详情 modal / lightbox
   ============================================================ */

/* 多图横向滚动：隐藏粗滚动条但保持可滚 */
.vx-card-imgs .flex::-webkit-scrollbar { height: 4px; }
.vx-card-imgs .flex::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

/* 图库项：square aspect，hover 边框变 primary */
.vx-gallery-item {
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.vx-gallery-item img { transition: transform 0.2s ease-out; }
.vx-gallery-item:hover img { transform: scale(1.02); }

/* 移动端：图库 action bar 适配安全区 */
@media (max-width: 640px) {
  #gallery-action-bar { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
}

/* 详情 modal 内 carousel 缩略图条 */
.vx-carousel-thumb { transition: border-color 0.15s ease-out; }

/* 详情 modal body 自带滚动 */
#record-detail-body { scrollbar-width: thin; }

/* 全屏 lightbox */
#vx-lightbox { padding: 1rem; }
#vx-lightbox-img { transition: opacity 0.15s ease-out; }

/* 多图预览网格的删除 X 按钮（modal 内预览） */
.vx-image-remove {
  position: absolute;
  top: -8px; right: -8px;
  height: 24px; width: 24px;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: 9999px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  z-index: 1;
}
.vx-image-remove:hover {
  background-color: var(--color-danger);
  color: var(--color-bg);
  border-color: var(--color-danger);
}

/* 卡片 hover 高亮（点卡片开 detail 的视觉提示） */
.vx-timeline-item { cursor: pointer; transition: border-color 0.15s ease-out, background-color 0.15s ease-out; }
.vx-timeline-item:hover { border-color: var(--color-primary) !important; }
```

### 9.5 Task 15 — i18n 键（`src/js/i18n.js`）

在 zh 块 [line 205-206](file:///workspace/src/js/i18n.js#L205-L206) 后追加：

```js
// Round 42: 多图 / 图库 / 详情
'app.view.gallery': '图库',
'app.gallery.title': '图片',
'app.gallery.empty': '时间轴中暂无图片',
'app.gallery.selectionMode': '选择',
'app.gallery.cancelSelection': '取消',
'app.gallery.download': '下载',
'app.gallery.downloadAll': '下载全部',
'app.gallery.selected0': '已选 0 张',
'app.gallery.selectedN': '已选 ${n} 张',
'app.modal.images': '图片',
'app.modal.chooseFiles': '选择图片',
'app.modal.noFiles': '未选择任何文件',
'app.modal.filesSelected': '已选 N 张',
'app.detail.edit': '编辑',
'app.detail.delete': '删除',
'app.detail.download': '下载图片',
'app.detail.previous': '上一条',
'app.detail.next': '下一条',
'app.detail.imageIndex': '第 ${i} / ${n} 张',
'app.image.downloadFail': '下载失败，请重试',
'app.image.zipLibMissing': '正在加载打包库，请稍后再试',
```

在 en 块 [line 549-550](file:///workspace/src/js/i18n.js#L549-L550) 后追加：

```js
// Round 42: multi-image / gallery / detail
'app.view.gallery': 'Gallery',
'app.gallery.title': 'Photos',
'app.gallery.empty': 'No images in this timeline',
'app.gallery.selectionMode': 'Select',
'app.gallery.cancelSelection': 'Cancel',
'app.gallery.download': 'Download',
'app.gallery.downloadAll': 'Download all',
'app.gallery.selected0': '0 selected',
'app.gallery.selectedN': '${n} selected',
'app.modal.images': 'Images',
'app.modal.chooseFiles': 'Choose images',
'app.modal.noFiles': 'No files chosen',
'app.modal.filesSelected': 'N files selected',
'app.detail.edit': 'Edit',
'app.detail.delete': 'Delete',
'app.detail.download': 'Download image',
'app.detail.previous': 'Previous',
'app.detail.next': 'Next',
'app.detail.imageIndex': 'Image ${i} of ${n}',
'app.image.downloadFail': 'Download failed, please retry',
'app.image.zipLibMissing': 'Packer loading, please try again',
```

### 9.6 Task 16 — SW 缓存 bump（`sw.js`）

[sw.js:10](file:///workspace/sw.js#L10) `const CACHE_NAME = 'vex-timeline-cache-v41';` → 改为 `vex-timeline-cache-v42`，注释里追加 v42 说明：

```js
// Bump CACHE_NAME version whenever JS/CSS changes are deployed.
// v42 (2026-06-14) — Round 42: 多图导入 + 图库 + 详情 modal + lightbox + 图片下载
const CACHE_NAME = 'vex-timeline-cache-v42';
```

### 9.7 Task 17 — 验证

```bash
# A. 静态检查
cd /workspace
# 1. 旧单图 DOM 节点已清除
grep -n 'id="record-image"\b\|id="image-preview"\|id="preview-img"\|id="remove-image-btn"' index.html   # 期望：无输出
# 2. 新 DOM 节点就位
grep -n 'record-images\|images-preview\|gallery-container\|gallery-grid\|gallery-action-bar\|record-detail-overlay\|vx-lightbox' index.html   # 期望：全找到
# 3. 工具方法存在
grep -n '_getRecordImages\|_getGalleryItems\|renderGallery\|showRecordDetail\|_openLightbox\|_downloadImage\|_downloadGalleryZip' src/js/app.js   # 期望：全找到
# 4. bindEvents 收尾
grep -n 'gallery-select-btn\|close-record-detail\|ArrowLeft\|ArrowRight' src/js/app.js   # 期望：全找到
# 5. i18n 键
for k in 'app.view.gallery' 'app.gallery.empty' 'app.gallery.selectionMode' 'app.gallery.downloadAll' 'app.modal.images' 'app.modal.chooseFiles' 'app.detail.download' 'app.image.downloadFail' 'app.image.zipLibMissing'; do
  grep -q "'$k':" src/js/i18n.js || echo "MISSING: $k"
done   # 期望：无输出
# 6. SW bump
grep -n 'vex-timeline-cache-v42' sw.js   # 期望：找到
# 7. 迁移文件
test -f supabase/migrations/010_add_image_urls_array.sql && echo "MIG OK"
# 8. JSZip CDN
grep -n 'jszip' index.html   # 期望：找到
# 9. JS 语法
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done   # 期望：全过
# 10. CSS 关键字
grep -n 'vx-gallery-item\|vx-image-remove\|vx-carousel-thumb\|#vx-lightbox' src/css/styles.css   # 期望：全找到

# B. 浏览器端核心验证（5 步）
# 1. 多图导入：选择 3 张图 → 预览 3 张 → 删中间 → 剩 2 张 → 保存 → 卡片显示 2 张 + 无 +N
# 2. 图库视图：切到「图库」→ 网格 → 点击 → detail → 「选择」→ 选 2 张 → 底部 bar → 下载 → 浏览器下 ZIP
# 3. 卡片详情：点卡片正文（非按钮）→ detail；点大图 → lightbox；ESC 关；←/→ 翻图；点「编辑」→ 关闭 detail 打开 edit modal
# 4. 离线无回归：断网 → 添加 2 图 → 卡片显示 2 张 base64；在线 → 自动 upload → URL 变 https
# 5. 兼容性：旧记录（只有 image_url）→ 卡片显示 1 张；编辑 → 弹 modal 预填 1 张
```

## 10. Assumptions & Decisions（与原 §4 保持一致；新增项如下）

| # | 决策 | 理由 |
|---|---|---|
| D26 | 卡片图片点击 → 打开 lightbox，**不**打开 detail | 用户原话"在单独窗口中展示时间轴"= 详情；点图应看大图 |
| D27 | 卡片正文（非按钮）点击 → 打开 detail | 与"点图看大图"互不冲突；按钮 stopPropagation 已被 `.vx-edit-btn, .vx-delete-btn, .vx-card-img` 排除 |
| D28 | 月历弹窗（showDayRecords）内点卡片 → 关闭弹窗 + 打开 detail | 与时间轴一致 |
| D29 | 月历弹窗内点图片 → 打开 lightbox | 与时间轴一致 |
| D30 | 卡片 hover 边框变 primary | 视觉提示"可点击" |
| D31 | SW 缓存 v41→v42 | 与新增功能配套；用户首次打开会从云端拉新 shell |

## 11. File Change List（最终版）

| 文件 | 动作 | 状态 |
|---|---|---|
| [supabase/migrations/010_add_image_urls_array.sql](file:///workspace/supabase/migrations/010_add_image_urls_array.sql) | 新增 | ✅ 完成 |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 改 | ✅ 完成 |
| [src/js/db.js](file:///workspace/src/js/db.js) | **不改** | — IndexedDB schemaless |
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | ⏳ 剩 3 处（§9.2 / §9.3） |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | ❌ §9.4 |
| [index.html](file:///workspace/index.html) | 改 | ✅ 完成 |
| [src/js/i18n.js](file:///workspace/src/js/i18n.js) | 改 | ❌ §9.5 |
| [sw.js](file:///workspace/sw.js) | 改 | ❌ §9.6 |

## 12. 风险评估

| 风险 | 缓解 |
|---|---|
| bindEvents 加 keydown → 全局 → 可能在其他 modal 内误触发 | 加 `record-detail-overlay active` 守卫；其他 modal 不受影响 |
| 卡片点击 → 详情 与 编辑/删除/图片按钮冲突 | 三类按钮 `.vx-edit-btn, .vx-delete-btn, .vx-card-img` 已被事件委托 guard |
| 月历弹窗点卡片关弹窗开 detail → 双 modal 闪烁 | 先 `closeDayRecords()` 再 `showRecordDetail()`，自然过渡 |
| 卡片 hover 边框变 primary → 整体风格突兀 | 仅边框色 + 过渡 0.15s；与"可点击"一致 |
| 移动端点卡片误触详情 | 卡片区域较大（~120px+），误触率低；图片 / 按钮 stopPropagation 保护 |
| i18n 键缺失导致 fallback 显示 key 名 | grep 验证 9 个 key；en + zh 全补 |
| SW bump → 老用户首次打开有空白闪 | 设计：旧壳仍可用，新 shell 加载后即生效；与现状一致 |

---

## 1. Summary（原计划保留）

四件新功能 + 一条 schema 变更：

1. **多图导入**：在添加/编辑记录 modal 中，文件输入改为 `multiple`，支持一次选 N 张图；记录在云端新增 `image_urls TEXT[]` 字段；卡片与详情都用轮播 / 网格展示多图；保留旧记录（`image_url` 单图）的向下兼容。
2. **图库视图**：在顶栏「时间轴 / 月历」后面加第 3 个 toggle「图库」。新视图以 **iOS Photos 风格** 的方形缩略图网格展示**当前时间轴内所有有图的记录**；可进入选择模式 → 批量下载 ZIP。
3. **卡片详情 modal**：点击时间轴卡片正文（避开编辑/删除/图片按钮）打开一个**全屏 detail overlay**，展示：时间、重要性、标题、内容、多图轮播、创建者、上一条/下一条导航、编辑/删除/下载按钮。
4. **图片下载**：单图下载用 `<a download>` 触发；批量下载用 JSZip（CDN）打包为 ZIP 触发下载。三个入口：图库选中态、详情 modal 单图、图库「下载全部」。

数据层：新增 1 条 migration (`010_add_image_urls_array.sql`)；前端 storage 与 `cloudDBManager` 适配；IndexedDB 因是 schemaless 自由字段，**无需** IndexedDB 升级。

## 2. Current State Analysis

### 2.1 图片存储现状

- **云端存储 bucket**：`record-images`（[supabase/migrations/002_storage_and_functions.sql:6-38](file:///workspace/supabase/migrations/002_storage_and_functions.sql#L6-L38)）。RLS：
  - SELECT：公开（bucket 是 public）
  - INSERT：登录用户
  - UPDATE：仅 owner
  - DELETE：owner **或** timeline owner
- **上传函数**：`cloudDBManager.uploadImage(file, timelineId)`（[src/js/cloud-db.js:295-308](file:///workspace/src/js/cloud-db.js#L295-L308)）返回 `publicUrl`。
- **删除函数**：`cloudDBManager.deleteImage(imageUrl)`（[src/js/cloud-db.js:310-321](file:///workspace/src/js/cloud-db.js#L310-L321)）从 URL 解析 path 再 remove。
- **图片字段**：`records.image_url TEXT`（[supabase/migrations/001_initial_schema.sql:42](file:///workspace/supabase/migrations/001_initial_schema.sql#L42)），**只 1 个**。
- **前端写入路径**：[src/js/app.js:2611-2628](file:///workspace/src/js/app.js#L2611-L2628) 把 dataURL → file → upload → URL；离线时降级保存 base64。
- **前端读取路径**：`record.image || record.image_url || ''`（多处，`vx-day-record`/`vx-timeline-item`）。
- **本地 IndexedDB**（[src/js/db.js:23-27](file:///workspace/src/js/db.js#L23-L27)）：records store 无字段约束，自由存。

### 2.2 视图切换现状

- 当前 `currentView ∈ {'timeline', 'month'}`（[src/js/app.js:11](file:///workspace/src/js/app.js#L11)）。
- 切换按钮：`<button data-view-toggle="…">`（[index.html:841-848](file:///workspace/index.html#L841-L848)）。
- `renderView()` 路由（[src/js/app.js:2746-2770](file:///workspace/src/js/app.js#L2746-L2770)）按 `currentView` 决定显示 `#timeline-container` 还是 `#calendar-container`。
- `syncViewToggleState()`（[src/js/app.js:1284-1300](file:///workspace/src/js/app.js#L1284-L1300)）负责按钮高亮态。

**新加 `'gallery'` 视图**：同模式。

### 2.3 modal 现有结构

- `vx-modal-overlay` / `vx-modal`（[src/css/styles.css:161-184](file:///workspace/src/css/styles.css#L161-L184)）通用全屏模态。
- 记录 modal（[index.html:1007-1074](file:///workspace/index.html#L1007-L1074)）：表单 + 重要性选择器 + 标题 + 内容 + 图片（单 input + 单 preview）。
- 图片 input 路径：`<input id="record-image" type="file" accept="image/*">` + `<button id="record-image-trigger">` + 隐藏 sr class（[index.html:1047-1058](file:///workspace/index.html#L1047-L1058)）。
- 处理函数：`handleImageUpload` / `removeImage`（[src/js/app.js:2490-2516](file:///workspace/src/js/app.js#L2490-L2516)），**只支持 1 张**。

### 2.4 卡片点击现状

- 卡片结构（[src/js/app.js:3031-3054](file:///workspace/src/js/app.js#L3031-L3054)）：`vx-timeline-item` 容器内有 `vx-rail-dot` + 可选 `vx-timeline-actions`（编辑/删除）+ `vx-item-time` + `vx-item-title-row` + 内容 + 单图 `<img>`。
- **当前无任何点击卡片打开详情的逻辑**；只有 edit/delete 按钮单独绑定。
- 详情 modal 完全没有，需要新建一个 `#record-detail-overlay`。

### 2.5 i18n 现状

- 已有 [app.view.timeline, app.view.month](file:///workspace/src/js/i18n.js#L153-L154) / [app.view.timeline, app.view.month](file:///workspace/src/js/i18n.js#L498-L499)。
- 已有 `app.modal.image / chooseFile / noFile / fileSelected / preview`（zh 194-197, 345; en 540-543, 690）。
- **完全没有图库 / 详情 / 下载 / 多图相关 key**，需补。

### 2.6 依赖现状

- 当前 CDN 依赖：Tailwind Play CDN、lucide、Supabase JS、Outfit 字体。
- **无 JSZip**，需新增 CDN。

## 3. Proposed Changes

### 3.1 Schema 变更

**新文件**：[supabase/migrations/010_add_image_urls_array.sql](file:///workspace/supabase/migrations/010_add_image_urls_array.sql)

```sql
-- 010_add_image_urls_array.sql
-- 让一条记录支持 1~N 张图。原 image_url 保留作为"主图"（向下兼容）。

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT NULL;

-- 不强制 NOT NULL：保留 image_url 的同时，image_urls 用来装 1~N 张
-- 读时: 优先 image_urls；为空时回退 image_url 单图
-- 写时: 多图存 image_urls；如果只有 1 张也写 image_url = images[0] 兼容老客户端

COMMENT ON COLUMN public.records.image_urls IS '1..N 张图 URL 数组；为空时回退 image_url 单图';
```

### 3.2 数据层适配

**[src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js)**：

```js
// addRecord (line 13-32) → 增 image_urls 字段
.insert({
  timeline_id: timelineId,
  user_id: userId,
  date: record.date,
  time: record.time,
  title: record.title,
  content: record.content,
  importance: record.importance,
  image_url: record.image_url,        // 主图（第一张），保留兼容
  image_urls: record.image_urls || null  // 多图数组
})
```

`updateRecord` 已经传 `updates` 对象，调用方传什么写什么，无需改方法体。

**[src/js/db.js](file:///workspace/src/js/db.js)**：IndexedDB 是 schemaless 对象存储，**无需改 schema**；`addRecord`/`updateRecord` 已经 spread record 字段（[src/js/db.js:54-57](file:///workspace/src/js/db.js#L54-L57)），新字段自动落库。

### 3.3 App 工具方法

**[src/js/app.js](file:///workspace/src/js/app.js)** 新增 3 个工具（放在 `class App` 内，`_escapeHtml` 附近）：

```js
/**
 * 从 record 提取所有图片 URL（统一入口）
 * - 优先 image_urls 数组
 * - 回退到 image_url / image 单图（兼容老数据）
 * - 自动过滤空 / 非 http+data 协议
 */
_getRecordImages(record) {
  if (!record) return [];
  const out = [];
  if (Array.isArray(record.image_urls)) out.push(...record.image_urls.filter(Boolean));
  if (out.length === 0) {
    const single = record.image || record.image_url;
    if (single) out.push(single);
  }
  return out.filter(u => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:')));
}

/** 主图（第一张），用于 timeline 卡片 / day-record 标题旁的图标等 */
_getRecordMainImage(record) {
  const imgs = this._getRecordImages(record);
  return imgs.length > 0 ? imgs[0] : '';
}

/** 触发单图下载（浏览器原生）；含文件名清理 */
_downloadImage(url, filename) {
  try {
    const safeName = String(filename || 'image')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'image';
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName + (/\.[a-z0-9]+$/i.test(safeName) ? '' : '.png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.warn('[VEX-Timeline] downloadImage failed:', e);
    alert(this._i18n('app.image.downloadFail', '下载失败，请重试'));
  }
}

/** 时间轴内所有有图的 record（去重 by imageUrl）—— 图库用 */
_getGalleryItems() {
  const seen = new Set();
  const items = [];
  (this.records || []).forEach(r => {
    const imgs = this._getRecordImages(r);
    imgs.forEach((url, idx) => {
      if (seen.has(url)) return; // 同一图只展示一次（去重：dataURL 不参与去重）
      seen.add(url);
      items.push({
        url,
        record: r,
        imageIndex: idx,
        isPrimary: idx === 0
      });
    });
  });
  // 按记录日期 + 时间倒序（最新在前）
  items.sort((a, b) => {
    const ad = a.record.date || '';
    const bd = b.record.date || '';
    if (ad !== bd) return bd.localeCompare(ad);
    return (b.record.time || '').localeCompare(a.record.time || '');
  });
  return items;
}
```

### 3.4 多图导入（modal 重构）

**[index.html](file:///workspace/index.html)**（line 1044-1060）：把单个 image 块改为多图块：

```html
<div class="flex flex-col gap-2">
  <label class="text-xs font-semibold uppercase tracking-wider text-fg/60" data-i18n="app.modal.images">图片</label>
  <div class="flex items-center gap-3 flex-wrap">
    <input id="record-images" type="file" accept="image/*" multiple class="vx-file-input-sr">
    <button type="button" id="record-images-trigger"
            class="h-10 px-4 bg-fg text-canvas rounded-md font-semibold tracking-wider uppercase text-xs hover:bg-primary transition-all duration-200 cursor-pointer"
            data-i18n="app.modal.chooseFiles">选择图片</button>
    <span id="record-images-name" class="text-xs font-medium text-fg/60 truncate max-w-[14rem]" data-i18n="app.modal.noFiles">未选择任何文件</span>
  </div>
  <!-- 多图网格预览（每图右上角 X 删除） -->
  <div id="images-preview" class="hidden mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2"></div>
</div>
```

**删除旧的** `record-image` / `record-image-trigger` / `image-preview` / `preview-img` / `remove-image-btn` / `#record-image-name` 单图 DOM 节点。

**[src/js/app.js](file:///workspace/src/js/app.js)**：

- 把 `tempImageData`（单）→ 改为 `this.tempImages = []`（数组）；每项 `{ url: dataURL|https, file: File|null, fileName: string|null }`。
- 替换 `handleImageUpload`（[src/js/app.js:2490-2504](file:///workspace/src/js/app.js#L2490-L2504)）→ `handleImagesUpload(e)`：遍历 `e.target.files`（FileList），逐个 `FileReader.readAsDataURL` 入 `this.tempImages`，全部 read 完后再 render 一次。
- 新增 `_renderImagesPreview()`：渲染到 `#images-preview`，每张缩略图右上角带删除 X。
- 新增 `_removeImageAt(index)`：从 `this.tempImages` 删除并重渲。
- 替换 `removeImage`（[src/js/app.js:2506-2516](file:///workspace/src/js/app.js#L2506-L2516)）→ `clearAllImages()`。
- 替换 `_updateRecordImageName` → `_updateRecordImagesName()`：显示「N 张已选」/「未选择任何文件」。
- 修改 `openModal`（[src/js/app.js:2540-2585](file:///workspace/src/js/app.js#L2540-L2585)）：编辑时把现有 record 的 `_getRecordImages(record)` 全部填进 `this.tempImages`（base64 没法恢复原 file，置 `file: null`、但保留 `fileName`），`url` 字段填原 URL。
- 修改 `bindEvents`（[src/js/app.js:944-952](file:///workspace/src/js/app.js#L944-L952)）：
  - 改监听 `#record-images` 的 `change` → `handleImagesUpload`
  - 改监听 `#record-images-trigger` 的 click → 触发 `record-images` input
  - 改监听 `#images-preview` 的 click（事件委托）→ 找 `.vx-image-remove` 按钮 → `_removeImageAt(index)`
- 修改 `saveRecord`（[src/js/app.js:2596-2666](file:///workspace/src/js/app.js#L2596-L2666)）：
  - 遍历 `this.tempImages`：
    - 若是 data URL → 上传 → 拿到 https URL
    - 若是 https URL → 沿用
    - 失败时回退 data URL（与现状一致）
  - 最后构造 `imageUrls = [url1, url2, …]`、`image_url = imageUrls[0] || null`
  - `recordData = { date, time, title, content, importance, image: imageUrls[0] || null, image_urls: imageUrls, timeline_id }`（`image` 字段保留向下兼容本地读）
  - 云端 addRecord / updateRecord 的 payload 同步改为 `{ ..., image_url, image_urls }`
- 删除记录时（[src/js/app.js:2668-2700](file:///workspace/src/js/app.js#L2668-L2700)）：删除 record 时调 `deleteImage(url)` **对每张**而不是单图。

### 3.5 图库视图（新 view）

**[index.html](file:///workspace/index.html)**：

**A. 视图切换按钮**（line 841-848）追加第 3 个：

```html
<button data-view-toggle="gallery"
        class="h-10 px-2 sm:px-4 inline-flex items-center justify-center rounded-md text-sm font-semibold tracking-wider uppercase text-fg/60 hover:text-fg transition-all duration-200">
  <i data-lucide="images" class="w-4 h-4 sm:mr-1"></i><span class="hidden sm:inline" data-i18n="app.view.gallery">图库</span>
</button>
```

**B. 图库容器**（紧跟 `<section id="calendar-container">` 之后，line 984 之后）：

```html
<section id="gallery-container" class="relative z-10 hidden">
  <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <div>
      <div class="text-xs font-semibold uppercase tracking-wider text-fg/60" data-i18n="app.gallery.title">图片</div>
      <h2 class="font-extrabold text-3xl tracking-[-0.02em] uppercase" data-i18n="app.view.gallery">图库</h2>
    </div>
    <div class="flex items-center gap-2">
      <button id="gallery-select-btn" type="button"
              class="h-10 px-4 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-muted transition-all duration-200"
              data-i18n="app.gallery.selectionMode">选择</button>
      <button id="gallery-download-all-btn" type="button"
              class="h-10 px-4 bg-primary text-canvas rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-primary-hover transition-all duration-200 hidden">
        <i data-lucide="download" class="w-4 h-4 sm:mr-1"></i><span data-i18n="app.gallery.downloadAll">下载全部</span>
      </button>
    </div>
  </div>
  <div id="gallery-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"></div>
  <div id="gallery-empty" class="hidden text-center py-16 text-fg/60">
    <i data-lucide="image-off" class="w-12 h-12 mx-auto mb-3 text-fg/40"></i>
    <p class="text-sm font-semibold uppercase tracking-wider" data-i18n="app.gallery.empty">时间轴中暂无图片</p>
  </div>
</section>
```

**C. 图库底部操作栏**（选择模式下显示）：

```html
<div id="gallery-action-bar" class="hidden fixed bottom-0 inset-x-0 z-50 bg-canvas border-t-2 border-border px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-4px_0_0_var(--color-fg)]">
  <span id="gallery-selected-count" class="text-xs font-semibold uppercase tracking-wider text-fg/60" data-i18n="app.gallery.selected0">已选 0 张</span>
  <div class="flex items-center gap-2">
    <button id="gallery-cancel-btn" type="button"
            class="h-10 px-4 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-muted transition-all duration-200"
            data-i18n="app.gallery.cancelSelection">取消</button>
    <button id="gallery-download-btn" type="button"
            class="h-10 px-4 bg-primary text-canvas rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-primary-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled>
      <i data-lucide="download" class="w-4 h-4 mr-1"></i><span data-i18n="app.gallery.download">下载</span>
    </button>
  </div>
</div>
```

**[src/js/app.js](file:///workspace/src/js/app.js)** 新增：

```js
// 类内：选择态
this._gallerySelectionMode = false;
this._gallerySelected = new Set(); // url 集合

/** 渲染图库 */
async renderGallery() {
  await this._ensureCreatorMap();
  this._refreshAddButtonByRole();
  const grid = document.getElementById('gallery-grid');
  const emptyEl = document.getElementById('gallery-empty');
  const actionBar = document.getElementById('gallery-action-bar');
  if (!grid) return;

  const items = this._getGalleryItems();
  if (items.length === 0) {
    grid.innerHTML = '';
    emptyEl.classList.remove('hidden');
    actionBar.classList.add('hidden');
    if (window.lucide && lucide.createIcons) lucide.createIcons();
    return;
  }
  emptyEl.classList.add('hidden');

  let html = '';
  items.forEach((it, idx) => {
    const selected = this._gallerySelected.has(it.url);
    const creatorHtml = this._creatorHtmlForRecord(it.record);
    const mainTitle = this._escapeHtml(it.record.title || '');
    const date = it.record.date || '';
    const time = it.record.time || '';
    html += `
      <div class="vx-gallery-item relative aspect-square overflow-hidden rounded-md border-2 ${selected ? 'border-primary' : 'border-border'} bg-muted cursor-pointer hover:border-primary transition-all duration-200"
           data-url="${this._escapeHtml(it.url)}" data-record-id="${String(it.record.id)}" data-image-index="${it.imageIndex}">
        <img src="${this._escapeHtml(it.url)}" alt="${mainTitle}" loading="lazy"
             class="absolute inset-0 w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 pointer-events-none"></div>
        <div class="absolute bottom-0 left-0 right-0 p-2 text-canvas pointer-events-none">
          <div class="text-[10px] font-semibold uppercase tracking-wider opacity-90">${this._escapeHtml(date)} ${this._escapeHtml(time)}</div>
          ${mainTitle ? `<div class="text-xs font-semibold truncate">${mainTitle}</div>` : ''}
          ${creatorHtml ? `<div class="text-[10px] opacity-80 truncate">${creatorHtml.replace(/<span[^>]*>|<\/span>/g,'')}</div>` : ''}
        </div>
        ${this._gallerySelectionMode ? `
          <div class="absolute top-2 right-2 h-6 w-6 rounded-full border-2 ${selected ? 'bg-primary border-primary' : 'bg-canvas/30 border-canvas'} flex items-center justify-center">
            ${selected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-canvas"></i>' : ''}
          </div>
        ` : ''}
      </div>
    `;
  });
  grid.innerHTML = html;
  if (window.lucide && lucide.createIcons) lucide.createIcons();

  // 事件委托：点击 → 选择态则 toggle / 否则打开详情
  grid.onclick = (e) => {
    const item = e.target.closest('.vx-gallery-item');
    if (!item) return;
    const url = item.dataset.url;
    const recordId = item.dataset.recordId;
    const imageIndex = parseInt(item.dataset.imageIndex, 10);
    if (this._gallerySelectionMode) {
      if (this._gallerySelected.has(url)) this._gallerySelected.delete(url);
      else this._gallerySelected.add(url);
      this._refreshGallerySelectionUI();
      return;
    }
    // 找到 record 打开 detail
    const record = this.records.find(r => String(r.id) === recordId);
    if (record) this.showRecordDetail(record, imageIndex);
  };

  this._refreshGallerySelectionUI();
}

/** 选择态 UI 重渲染（不重画整个 grid，只更新边框与按钮） */
_refreshGallerySelectionUI() {
  const items = document.querySelectorAll('.vx-gallery-item');
  items.forEach(el => {
    const url = el.dataset.url;
    const selected = this._gallerySelected.has(url);
    el.classList.toggle('border-primary', selected);
    el.classList.toggle('border-border', !selected);
    // 顶部圆点
    const dot = el.querySelector('.absolute.top-2.right-2');
    if (dot) {
      dot.className = `absolute top-2 right-2 h-6 w-6 rounded-full border-2 ${selected ? 'bg-primary border-primary' : 'bg-canvas/30 border-canvas'} flex items-center justify-center`;
      dot.innerHTML = selected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-canvas"></i>' : '';
    }
  });
  if (window.lucide && lucide.createIcons) lucide.createIcons();

  const actionBar = document.getElementById('gallery-action-bar');
  const downloadBtn = document.getElementById('gallery-download-btn');
  const countSpan = document.getElementById('gallery-selected-count');
  if (this._gallerySelectionMode) {
    actionBar.classList.remove('hidden');
    const n = this._gallerySelected.size;
    downloadBtn.disabled = n === 0;
    countSpan.textContent = this._i18n('app.gallery.selectedN', `已选 ${n} 张`).replace('${n}', String(n));
  } else {
    actionBar.classList.add('hidden');
  }
}

/** 退出选择模式 */
_exitGallerySelection() {
  this._gallerySelectionMode = false;
  this._gallerySelected.clear();
  this.renderGallery();
}

/** 批量下载 ZIP */
async _downloadGalleryZip() {
  const urls = Array.from(this._gallerySelected);
  if (urls.length === 0) return;
  if (typeof JSZip === 'undefined') {
    alert(this._i18n('app.image.zipLibMissing', '正在加载打包库，请稍后再试'));
    return;
  }
  const zip = new JSZip();
  const used = new Set();
  // 给每张图生成去重文件名：<日期>_<时间>_<记录id短>_<idx>.<ext>
  const items = this._getGalleryItems().filter(it => this._gallerySelected.has(it.url));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const r = it.record;
    const base = `${r.date || 'unknown'}_${(r.time || '00-00').replace(':','-')}`;
    let ext = 'png';
    const m = /\.([a-z0-9]{2,5})(\?.*)?$/i.exec(it.url);
    if (m) ext = m[1].toLowerCase();
    let name = `${base}_${i + 1}.${ext}`;
    let n = 1;
    while (used.has(name)) name = `${base}_${i + 1}_${n++}.${ext}`;
    used.add(name);

    try {
      const blob = await (await fetch(it.url)).blob();
      zip.file(name, blob);
    } catch (e) {
      console.warn('[VEX-Timeline] zip fetch failed for', it.url, e);
    }
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  this._downloadBlob(zipBlob, `vex-timeline-gallery-${ts}.zip`);
  this._exitGallerySelection();
}

/** Blob → 下载 */
_downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  this._downloadImage(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

**[src/js/app.js](file:///workspace/src/js/app.js)** 改 `renderView`（[src/js/app.js:2746-2770](file:///workspace/src/js/app.js#L2746-L2770)）：

```js
async renderView() {
  const timelineContainer = document.getElementById('timeline-container');
  const calendarContainer = document.getElementById('calendar-container');
  const galleryContainer = document.getElementById('gallery-container');
  if (!timelineContainer || !calendarContainer || !galleryContainer) return;
  this.syncViewToggleState();
  this._refreshAddButtonByRole();
  if (!authManager.isLoggedIn() || !this.currentTimelineId) {
    timelineContainer.classList.add('hidden');
    calendarContainer.classList.add('hidden');
    galleryContainer.classList.add('hidden');
    return;
  }
  // 退出选择态（避免残留）
  if (this._gallerySelectionMode) this._exitGallerySelection();

  if (this.currentView === 'month') {
    timelineContainer.classList.add('hidden');
    calendarContainer.classList.add('hidden');
    galleryContainer.classList.remove('hidden');
    await this.renderCalendar();
  } else if (this.currentView === 'gallery') {
    timelineContainer.classList.add('hidden');
    calendarContainer.classList.add('hidden');
    galleryContainer.classList.remove('hidden');
    await this.renderGallery();
  } else {
    timelineContainer.classList.remove('hidden');
    calendarContainer.classList.add('hidden');
    galleryContainer.classList.add('hidden');
    await this.renderTimeline();
  }
}
```

**[src/js/app.js](file:///workspace/src/js/app.js)** 新增 `renderView`-级初始默认值（[src/js/app.js:11](file:///workspace/src/js/app.js#L11)）保持 `this.currentView = 'timeline'` 不变；用户通过顶栏按钮切到 gallery。

**[src/js/app.js](file:///workspace/src/js/app.js)** 在 `bindEvents`（[src/js/app.js:849](file:///workspace/src/js/app.js#L849)）追加：

```js
// 图库选择模式
const selBtn = document.getElementById('gallery-select-btn');
if (selBtn) selBtn.addEventListener('click', () => {
  this._gallerySelectionMode = true;
  this.renderGallery();
});
const cancelSel = document.getElementById('gallery-cancel-btn');
if (cancelSel) cancelSel.addEventListener('click', () => this._exitGallerySelection());
const dlBtn = document.getElementById('gallery-download-btn');
if (dlBtn) dlBtn.addEventListener('click', () => this._downloadGalleryZip());
const dlAll = document.getElementById('gallery-download-all-btn');
if (dlAll) dlAll.addEventListener('click', () => {
  this._gallerySelected = new Set(this._getGalleryItems().map(it => it.url));
  this._downloadGalleryZip();
});
```

### 3.6 卡片详情 modal

**[index.html](file:///workspace/index.html)** 在 `day-records-overlay` 附近（line 988 之后）新增：

```html
<div id="record-detail-overlay" class="vx-modal-overlay">
  <div class="vx-modal max-w-3xl p-0 overflow-hidden">
    <div class="bg-fg text-canvas px-6 sm:px-8 py-5 flex items-center justify-between">
      <h3 id="record-detail-title" class="font-extrabold text-xl sm:text-2xl tracking-[-0.02em] uppercase truncate">—</h3>
      <button id="close-record-detail" type="button"
              class="h-10 w-10 flex items-center justify-center bg-canvas/10 hover:bg-canvas/20 rounded-md transition-all duration-200"
              aria-label="Close">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>
    <!-- 主体 -->
    <div id="record-detail-body" class="p-6 sm:p-8 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
      <!-- 由 JS 动态填充：时间、重要性、标题、内容、图轮播、创建者、prev/next、按钮 -->
    </div>
  </div>
</div>
```

**[src/js/app.js](file:///workspace/src/js/app.js)** 新增：

```js
this._currentDetailRecordId = null;
this._currentDetailImageIndex = 0;

/** 显示记录详情 modal */
async showRecordDetail(record, imageIndex = 0) {
  if (!record) return;
  await this._ensureCreatorMap();
  this._currentDetailRecordId = String(record.id);
  this._currentDetailImageIndex = imageIndex;

  const overlay = document.getElementById('record-detail-overlay');
  const titleEl = document.getElementById('record-detail-title');
  const body = document.getElementById('record-detail-body');

  titleEl.textContent = record.title || '—';

  const imgs = this._getRecordImages(record);
  const importanceBadgeColors = { high: 'bg-danger text-canvas', medium: 'bg-accent text-canvas', low: 'bg-secondary text-canvas' };
  const importanceLabel = { high: this._i18n('app.importance.high','高'), medium: this._i18n('app.importance.medium','中'), low: this._i18n('app.importance.low','低') };
  const imp = record.importance || 'medium';
  const creatorHtml = this._creatorHtmlForRecord(record);
  const canEdit = this.canEditRecord(record);
  const canDelete = this.canEditRecord(record); // 复用同权限

  // 轮播：当前图 + 缩略图条（多图时）+ 上下张按钮
  const carouselHtml = imgs.length > 0 ? `
    <div class="vx-image-carousel relative bg-canvas rounded-md border-2 border-border overflow-hidden">
      <img id="detail-current-img" src="${this._escapeHtml(imgs[imageIndex] || imgs[0])}" alt=""
           class="block w-full max-h-[60vh] object-contain mx-auto bg-fg/5 cursor-zoom-in"
           data-index="${imageIndex}">
      ${imgs.length > 1 ? `
        <button class="vx-carousel-prev absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-canvas/80 border-2 border-border rounded-md flex items-center justify-center hover:bg-canvas transition-all duration-200" type="button">
          <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </button>
        <button class="vx-carousel-next absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-canvas/80 border-2 border-border rounded-md flex items-center justify-center hover:bg-canvas transition-all duration-200" type="button">
          <i data-lucide="chevron-right" class="w-5 h-5"></i>
        </button>
        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-canvas/80 rounded-md text-[10px] font-semibold uppercase tracking-wider">
          <span data-i18n="app.detail.imageIndex">${(imageIndex + 1)} / ${imgs.length}</span>
        </div>
      ` : ''}
    </div>
    ${imgs.length > 1 ? `
      <div class="flex gap-2 overflow-x-auto pb-1">
        ${imgs.map((u, i) => `
          <button type="button" class="vx-carousel-thumb shrink-0 w-16 h-16 rounded-md border-2 ${i === imageIndex ? 'border-primary' : 'border-border'} overflow-hidden hover:border-primary transition-all duration-200" data-index="${i}">
            <img src="${this._escapeHtml(u)}" class="w-full h-full object-cover" alt="">
          </button>
        `).join('')}
      </div>
    ` : ''}
  ` : '';

  // 上一条 / 下一条（按 date+time 排序，在同 timeline 中）
  const allSorted = (this.records || []).slice().sort((a,b) => {
    const ad = `${a.date || ''}T${a.time || '00:00'}`;
    const bd = `${b.date || ''}T${b.time || '00:00'}`;
    return ad.localeCompare(bd);
  });
  const idx = allSorted.findIndex(r => String(r.id) === this._currentDetailRecordId);
  const prev = idx > 0 ? allSorted[idx - 1] : null;
  const next = idx < allSorted.length - 1 ? allSorted[idx + 1] : null;

  body.innerHTML = `
    <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg/60">
      <span>${this._escapeHtml(record.date || '')}</span>
      <span>·</span>
      <span>${this._escapeHtml(record.time || '')}</span>
      <span>·</span>
      <span class="inline-flex items-center justify-center text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${importanceBadgeColors[imp]}">${importanceLabel[imp]}</span>
    </div>
    ${creatorHtml ? `<div>${creatorHtml}</div>` : ''}
    ${carouselHtml}
    ${record.content ? `<p class="text-base text-fg/80 whitespace-pre-wrap leading-relaxed">${this._escapeHtml(record.content)}</p>` : ''}
    <div class="flex items-center justify-between flex-wrap gap-2 pt-2 border-t-2 border-border">
      <div class="flex items-center gap-2">
        <button id="detail-prev-btn" type="button" ${prev ? '' : 'disabled'}
                class="h-10 px-3 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-muted transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
          <i data-lucide="chevron-left" class="w-4 h-4 sm:mr-1"></i><span class="hidden sm:inline" data-i18n="app.detail.previous">上一条</span>
        </button>
        <button id="detail-next-btn" type="button" ${next ? '' : 'disabled'}
                class="h-10 px-3 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-muted transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
          <span class="hidden sm:inline" data-i18n="app.detail.next">下一条</span><i data-lucide="chevron-right" class="w-4 h-4 sm:ml-1"></i>
        </button>
      </div>
      <div class="flex items-center gap-2">
        ${imgs.length > 0 ? `
          <button id="detail-download-btn" type="button"
                  class="h-10 px-3 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-primary hover:text-canvas hover:border-primary transition-all duration-200">
            <i data-lucide="download" class="w-4 h-4 sm:mr-1"></i><span class="hidden sm:inline" data-i18n="app.detail.download">下载图片</span>
          </button>
        ` : ''}
        ${canEdit ? `
          <button id="detail-edit-btn" type="button"
                  class="h-10 px-3 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-primary hover:text-canvas hover:border-primary transition-all duration-200">
            <i data-lucide="pencil" class="w-4 h-4 sm:mr-1"></i><span class="hidden sm:inline" data-i18n="app.detail.edit">编辑</span>
          </button>
          <button id="detail-delete-btn" type="button"
                  class="h-10 px-3 bg-canvas border-2 border-border rounded-md font-semibold text-xs uppercase tracking-wider hover:bg-danger hover:text-canvas hover:border-danger transition-all duration-200">
            <i data-lucide="trash-2" class="w-4 h-4 sm:mr-1"></i><span class="hidden sm:inline" data-i18n="app.detail.delete">删除</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;
  if (window.lucide && lucide.createIcons) lucide.createIcons();

  // 事件
  const curImg = body.querySelector('#detail-current-img');
  curImg.addEventListener('click', () => this._openLightbox(imgs, imageIndex));
  const prevBtn = body.querySelector('#detail-prev-btn');
  if (prev && prevBtn) prevBtn.addEventListener('click', () => this.showRecordDetail(prev));
  const nextBtn = body.querySelector('#detail-next-btn');
  if (next && nextBtn) nextBtn.addEventListener('click', () => this.showRecordDetail(next));

  const carPrev = body.querySelector('.vx-carousel-prev');
  const carNext = body.querySelector('.vx-carousel-next');
  if (carPrev) carPrev.addEventListener('click', () => {
    const ni = (imageIndex - 1 + imgs.length) % imgs.length;
    this._currentDetailImageIndex = ni;
    this.showRecordDetail(record, ni);
  });
  if (carNext) carNext.addEventListener('click', () => {
    const ni = (imageIndex + 1) % imgs.length;
    this._currentDetailImageIndex = ni;
    this.showRecordDetail(record, ni);
  });
  body.querySelectorAll('.vx-carousel-thumb').forEach(b => {
    b.addEventListener('click', () => {
      this.showRecordDetail(record, parseInt(b.dataset.index, 10));
    });
  });

  const dl = body.querySelector('#detail-download-btn');
  if (dl) dl.addEventListener('click', () => {
    const url = imgs[imageIndex] || imgs[0];
    const fname = `${record.date || 'img'}_${(record.time || '00-00').replace(':','-')}_${String(record.id).slice(0,6)}`;
    this._downloadImage(url, fname);
  });
  const editBtn = body.querySelector('#detail-edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => {
    this.closeRecordDetail();
    this.openModal(record);
  });
  const delBtn = body.querySelector('#detail-delete-btn');
  if (delBtn) delBtn.addEventListener('click', async () => {
    if (!confirm(this._i18n('app.modal.confirmDelete', '确定要删除这条记录吗？'))) return;
    this.closeRecordDetail();
    await this.deleteRecord(String(record.id));
  });

  overlay.classList.add('active');
}

closeRecordDetail() {
  const overlay = document.getElementById('record-detail-overlay');
  if (overlay) overlay.classList.remove('active');
  this._currentDetailRecordId = null;
  this._currentDetailImageIndex = 0;
}
```

### 3.7 卡片点击 → 详情

**[src/js/app.js](file:///workspace/src/js/app.js)** 在 `renderTimeline` 末尾（[src/js/app.js:3060-3080](file:///workspace/src/js/app.js#L3060-L3080)）追加事件委托：

```js
// 点击卡片正文 → 打开详情 modal（编辑/删除/图片按钮自己拦截 stopPropagation）
const timelineEl = document.getElementById('timeline');
timelineEl.onclick = (e) => {
  if (e.target.closest('.vx-edit-btn, .vx-delete-btn')) return; // 按钮不触发
  const item = e.target.closest('.vx-timeline-item');
  if (!item) return;
  const idStr = item.querySelector('.vx-edit-btn, .vx-delete-btn')?.dataset.id;
  if (!idStr) return;
  const record = this.records.find(r => String(r.id) === idStr);
  if (record) this.showRecordDetail(record, 0);
};
```

> **关键**：edit/delete 按钮本身有 `e.currentTarget.dataset.id` 的 handler，**且** 在 detail modal 自身也有独立按钮。这里通过**事件委托**给 timeline 容器加 click，凡点中按钮（`.vx-edit-btn` / `.vx-delete-btn`）就 `return`，**不**触发详情。

### 3.8 关闭按钮 + 全屏图片 lightbox

**[src/js/app.js](file:///workspace/src/js/app.js)** 在 `bindEvents` 追加：

```js
const closeDetail = document.getElementById('close-record-detail');
if (closeDetail) closeDetail.addEventListener('click', () => this.closeRecordDetail());
// 点 overlay 背景关闭（不点中 modal 自身）
const detailOverlay = document.getElementById('record-detail-overlay');
if (detailOverlay) {
  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) this.closeRecordDetail();
  });
}
// ESC 关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (this._lightboxOpen) this._closeLightbox();
    else if (document.getElementById('record-detail-overlay')?.classList.contains('active')) this.closeRecordDetail();
  }
  // 详情打开时 ← / → 翻图
  if (document.getElementById('record-detail-overlay')?.classList.contains('active') && this._currentDetailRecordId) {
    const r = (this.records || []).find(x => String(x.id) === this._currentDetailRecordId);
    if (!r) return;
    if (e.key === 'ArrowLeft') {
      const imgs = this._getRecordImages(r);
      if (imgs.length > 1) this.showRecordDetail(r, (this._currentDetailImageIndex - 1 + imgs.length) % imgs.length);
    } else if (e.key === 'ArrowRight') {
      const imgs = this._getRecordImages(r);
      if (imgs.length > 1) this.showRecordDetail(r, (this._currentDetailImageIndex + 1) % imgs.length);
    }
  }
});
```

新增 lightbox（点击 detail modal 里的图时打开全屏大图 + 左右切换）：

```js
_openLightbox(images, startIndex = 0) {
  if (!images || images.length === 0) return;
  this._lightboxOpen = true;
  this._lightboxImages = images;
  this._lightboxIndex = startIndex;
  // 动态创建 overlay（如已存在则复用）
  let lb = document.getElementById('vx-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'vx-lightbox';
    lb.className = 'vx-modal-overlay';
    lb.style.backgroundColor = 'rgba(0,0,0,0.92)';
    lb.innerHTML = `
      <button id="vx-lightbox-close" type="button"
              class="absolute top-4 right-4 h-10 w-10 bg-canvas/10 hover:bg-canvas/20 text-canvas rounded-md flex items-center justify-center z-10">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
      <button id="vx-lightbox-prev" type="button"
              class="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-canvas/10 hover:bg-canvas/20 text-canvas rounded-md flex items-center justify-center">
        <i data-lucide="chevron-left" class="w-6 h-6"></i>
      </button>
      <button id="vx-lightbox-next" type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-canvas/10 hover:bg-canvas/20 text-canvas rounded-md flex items-center justify-center">
        <i data-lucide="chevron-right" class="w-6 h-6"></i>
      </button>
      <img id="vx-lightbox-img" alt="" class="max-w-[95vw] max-h-[90vh] object-contain">
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-canvas/10 text-canvas rounded-md text-xs font-semibold uppercase tracking-wider" id="vx-lightbox-counter"></div>
    `;
    document.body.appendChild(lb);
  }
  this._refreshLightbox();
  lb.classList.add('active');
  if (window.lucide && lucide.createIcons) lucide.createIcons();
  // 事件（一次性，挂 on overlay）
  lb.onclick = (e) => {
    if (e.target.id === 'vx-lightbox-close' || e.target.closest('#vx-lightbox-close')) this._closeLightbox();
    else if (e.target.id === 'vx-lightbox-prev' || e.target.closest('#vx-lightbox-prev')) this._lightboxStep(-1);
    else if (e.target.id === 'vx-lightbox-next' || e.target.closest('#vx-lightbox-next')) this._lightboxStep(1);
  };
}

_refreshLightbox() {
  const img = document.getElementById('vx-lightbox-img');
  const counter = document.getElementById('vx-lightbox-counter');
  if (!img || !this._lightboxImages) return;
  img.src = this._lightboxImages[this._lightboxIndex];
  if (this._lightboxImages.length > 1) {
    counter.textContent = `${this._lightboxIndex + 1} / ${this._lightboxImages.length}`;
  } else {
    counter.textContent = '';
  }
}

_lightboxStep(delta) {
  if (!this._lightboxImages || this._lightboxImages.length < 2) return;
  this._lightboxIndex = (this._lightboxIndex + delta + this._lightboxImages.length) % this._lightboxImages.length;
  this._refreshLightbox();
}

_closeLightbox() {
  this._lightboxOpen = false;
  this._lightboxImages = null;
  this._lightboxIndex = 0;
  const lb = document.getElementById('vx-lightbox');
  if (lb) lb.classList.remove('active');
}
```

### 3.9 卡片与日历视图的多图渲染

**[src/js/app.js](file:///workspace/src/js/app.js)** 改 `renderTimeline` 卡片渲染（[src/js/app.js:3052](file:///workspace/src/js/app.js#L3052)）：

```js
// 旧: ${imgSrc ? `<img src="..." ...>` : ''}
// 新: 多图：横向滚动 + 小角标「+N」
const imgs = this._getRecordImages(record);
const primaryImg = imgs[0] || '';
const extraCount = Math.max(imgs.length - 1, 0);
const cardImgHtml = primaryImg ? `
  <div class="vx-card-imgs relative">
    <div class="flex gap-1 overflow-x-auto snap-x snap-mandatory pb-1">
      ${imgs.map(u => `<img src="${this._escapeHtml(u)}" loading="lazy"
              class="snap-start shrink-0 max-h-48 w-auto object-cover rounded-md border-2 border-border cursor-zoom-in"
              data-record-id="${recordIdStr}" alt="${this._escapeHtml(record.title)}">`).join('')}
    </div>
    ${extraCount > 0 ? `<div class="absolute top-1 right-1 px-1.5 py-0.5 bg-fg text-canvas text-[10px] font-semibold rounded">+${extraCount}</div>` : ''}
  </div>
` : '';
html += `... ${cardImgHtml} ...`;
```

**点击卡片内图片 → 不打开 detail，而是打开 lightbox**（详情由卡片正文触发）。但用户可能希望点图也看大图。新加图片 click handler：

```js
// 在 renderTimeline 末尾追加
body.querySelectorAll('.vx-card-imgs img').forEach(img => {
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    const recordId = img.dataset.recordId;
    const record = this.records.find(r => String(r.id) === recordId);
    if (record) {
      const imgs = this._getRecordImages(record);
      this._openLightbox(imgs, 0);
    }
  });
});
```

**改 `showDayRecords` 弹窗**（[src/js/app.js:2895-2940](file:///workspace/src/js/app.js#L2895-L2940)）：原单图 `<img>` 改为多图横向滚动（用同样 `_getRecordImages`）。

### 3.10 CSS

**[src/css/styles.css](file:///workspace/src/css/styles.css)** 追加：

```css
/* ============================================================
   Round 42: 多图 / 图库 / 详情 modal / lightbox
   ============================================================ */

/* 多图横向滚动：隐藏滚动条但保持可滚 */
.vx-card-imgs .flex::-webkit-scrollbar { height: 4px; }
.vx-card-imgs .flex::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

/* 图库项：3-6 列网格，square aspect，hover 边框变 primary */
.vx-gallery-item { user-select: none; -webkit-tap-highlight-color: transparent; }
.vx-gallery-item img { transition: transform 0.2s ease-out; }
.vx-gallery-item:hover img { transform: scale(1.02); }

/* 图库底部 action bar：固定在底 */
@media (max-width: 640px) {
  #gallery-action-bar { padding-bottom: max(0.75rem, env(safe-area-inset-bottom)); }
}

/* 详情 modal 内 carousel 缩略图选中态 */
.vx-carousel-thumb.active,
.vx-carousel-thumb[data-active="true"] { border-color: var(--color-primary) !important; }

/* 详情 modal：max-h 滚动 */
#record-detail-body { scrollbar-width: thin; }

/* 全屏 lightbox：图片允许缩小以适应 */
#vx-lightbox { padding: 1rem; }
#vx-lightbox-img { transition: opacity 0.15s ease-out; }

/* 多图预览网格的删除 X 按钮 */
.vx-image-remove {
  position: absolute; top: -8px; right: -8px;
  height: 24px; width: 24px;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: 9999px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.vx-image-remove:hover { background-color: var(--color-danger); color: var(--color-bg); border-color: var(--color-danger); }

/* 暗色模式：lightbox overlay 背景已用 rgba(0,0,0,0.92)，无需 token */
```

### 3.11 i18n

**[src/js/i18n.js](file:///workspace/src/js/i18n.js)** 在 zh 块 [line 204-205](file:///workspace/src/js/i18n.js#L204-L205) 后、en 块 [line 549-550](file:///workspace/src/js/i18n.js#L549-L550) 后追加：

**zh (line 205 之后)**：

```js
'app.view.gallery': '图库',
'app.gallery.title': '图片',
'app.gallery.empty': '时间轴中暂无图片',
'app.gallery.selectionMode': '选择',
'app.gallery.cancelSelection': '取消',
'app.gallery.download': '下载',
'app.gallery.downloadAll': '下载全部',
'app.gallery.selected0': '已选 0 张',
'app.gallery.selectedN': '已选 ${n} 张',
'app.modal.images': '图片',
'app.modal.chooseFiles': '选择图片',
'app.modal.noFiles': '未选择任何文件',
'app.modal.filesSelected': '已选 N 张',
'app.detail.edit': '编辑',
'app.detail.delete': '删除',
'app.detail.download': '下载图片',
'app.detail.previous': '上一条',
'app.detail.next': '下一条',
'app.detail.imageIndex': '第 ${i} / ${n} 张',
'app.image.downloadFail': '下载失败，请重试',
'app.image.zipLibMissing': '正在加载打包库，请稍后再试',
```

**en (line 550 之后)**：同样 key + 英文值（`Gallery / No images / Select / Cancel / Download / Download all / Selected 0 / Selected ${n} / Images / Choose images / No images selected / N selected / Edit / Delete / Download / Previous / Next / Image ${i} of ${n} / Download failed / Loading packer, try again`）。

### 3.12 JSZip 引入

**[index.html](file:///workspace/index.html)** `<head>` 段（紧跟 Supabase CDN 之后）加：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" defer></script>
```

> `defer` 让它不阻塞首屏；运行时 `typeof JSZip === 'undefined'` 时降级为「单图下载 + 提示稍后再试」。

### 3.13 SW cache

**[sw.js](file:///workspace/sw.js)** line 6：v41 → v42。注释追加 v42 说明。

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | 多图采用 `image_urls TEXT[]` 新字段 + 保留 `image_url` 兼容 | 用户已选"数组字段"；老客户端读 `image_url` 仍可见主图，零数据迁移 |
| D2 | 写时同时写 `image_url = images[0] || null` 与 `image_urls = images` | 双向兼容：老前端取 `image_url` 仍能渲染主图；新前端取 `image_urls` 取全部 |
| D3 | IndexedDB 不动 schema | IndexedDB 是 schemaless 对象存，自由字段自动落库 |
| D4 | 详情 modal 复用 `vx-modal-overlay` 体系 | 与全站统一，无新动画 / 样式机制 |
| D5 | 详情 modal 内嵌 lightbox（点击大图打开） | 单条记录多图需要大图浏览；iOS 风格 |
| D6 | 图库视图 = 当前 timeline 内**有图**的所有记录，按日期/时间倒序 | 用户原话"只预览上传的时间轴中的照片" |
| D7 | 图库同 URL 去重（避免同张图在多条记录中重复显示） | 同张图（URL 相同）展示一次为佳；data URL 不去重（每次 base64 都不同） |
| D8 | 选择模式长按进入 → 改为显式「选择」按钮 | 长按需要更多交互，移动端易误触；显式按钮更清晰 |
| D9 | 批量下载用 JSZip（CDN） | 用户已选"ZIP 批量"；JSZip 是事实标准、3.10.1 稳定版 |
| D10 | JSZip 用 `defer` 加载；运行时未就绪则降级 | 避免阻塞首屏；用户初次打开图库时可能下载 JSZip（约 100KB） |
| D11 | 卡片点击区域排除编辑/删除/图片按钮 | 按钮自己拦截 stopPropagation；用户点图片看大图、点正文看详情 |
| D12 | 详情 modal 内 prev/next 按同 timeline 排序后切换 | 用户希望"在单独窗口中展示"是单条详情，prev/next 是导航辅助 |
| D13 | 单图下载文件名 `<date>_<time>_<id前6位>.<ext>` | 含语义、可追溯、不重复 |
| D14 | ZIP 文件名 `vex-timeline-gallery-<ISO 时间戳>.zip` | 明确来源、时间精确到秒 |
| D15 | 多图导入不上传每张后立即 render，而是最后一次性 upload + save | 性能：避免 N 次同步进度；失败处理：任一失败都回退 data URL |
| D16 | 删除 record 时**对每张图**调 `deleteImage` | 与现状一致（单图删除同样实现） |
| D17 | 删除单张图（保留 record）暂不实现 | 范围聚焦：先把 4 大功能落地；如需后续可加「从记录移除单图」 |
| D18 | 暗色模式无需特殊处理（`--color-*` token 自动适配 + lightbox 用 rgba(0,0,0,0.92) 在两种模式都暗） | 与全站策略一致 |
| D19 | 不修 PWA 缓存（v41→v42 bump 即可） | 与现状一致 |
| D20 | 不修 mockup / 首页 hero | 用户没要求 |
| D21 | 月历格子内不显示图库入口 | 保持月历聚焦"日历"，与现状一致 |
| D22 | 详情 modal 不需要在新窗口打开（用户已选 modal） | 用户选择；不引入 hash 路由 |
| D23 | 图库视图**退出**自动取消选择模式（切 timeline 也退出） | 避免残留选择态 |
| D24 | 添加 / 编辑记录时图片可全部移除 | `_removeImageAt` 走索引删除；保留 record 本身 |
| D25 | 不实现「回收站」「软删除」 | 范围外 |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [supabase/migrations/010_add_image_urls_array.sql](file:///workspace/supabase/migrations/010_add_image_urls_array.sql) | 新增 | ALTER TABLE records ADD COLUMN image_urls TEXT[] |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 改 | addRecord 增 image_urls 字段透传 |
| [src/js/db.js](file:///workspace/src/js/db.js) | **不改** | IndexedDB schemaless |
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (1) 工具：`_getRecordImages` / `_getRecordMainImage` / `_downloadImage` / `_downloadBlob` / `_getGalleryItems`；(2) 多图：`tempImages` 数组、`handleImagesUpload` / `_renderImagesPreview` / `_removeImageAt` / `clearAllImages`；(3) view：`renderView` 新增 gallery 分支；新 `renderGallery` / `_refreshGallerySelectionUI` / `_exitGallerySelection` / `_downloadGalleryZip`；(4) 详情：`showRecordDetail` / `closeRecordDetail` / `_openLightbox` / `_lightboxStep` / `_closeLightbox` / `_refreshLightbox`；(5) 卡片点击 → 详情的事件委托；(6) `bindEvents` 增图库按钮、详情关闭、ESC 键监听；(7) `saveRecord` / `deleteRecord` 改多图；`openModal` 改多图预填 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | 追加 vx-card-imgs / vx-gallery-item / vx-image-remove / vx-carousel-thumb / vx-lightbox 等样式 |
| [index.html](file:///workspace/index.html) | 改 | (1) 顶栏 view toggle 增 gallery 按钮；(2) 增 `<section id="gallery-container">` 与底部 action bar；(3) 记录 modal 改多图（删除旧的单图 DOM，替换为 `#record-images` 多选 + `#images-preview` 网格）；(4) 增 `<div id="record-detail-overlay">`；(5) `<head>` 增 JSZip CDN |
| [src/js/i18n.js](file:///workspace/src/js/i18n.js) | 改 | zh + en 各增 ~20 个 key |
| [sw.js](file:///workspace/sw.js) | 改 | CACHE_NAME v41 → v42，注释同步 |

## 6. Verification Steps

### 6.1 静态检查

```bash
# 1. 旧单图 DOM 已清除
grep -n "record-image\b\|image-preview\b\|preview-img\b" /workspace/index.html
# 期望：仅可能剩尾部 .css 注释；UI 元素应已替换

# 2. 多图 + 图库 + 详情 DOM 已就位
grep -n "record-images\b\|images-preview\b\|gallery-container\|gallery-grid\|gallery-action-bar\|record-detail-overlay\|vx-lightbox" /workspace/index.html /workspace/src/js/app.js

# 3. 工具方法存在
grep -n "_getRecordImages\|_getRecordMainImage\|_getGalleryItems\|renderGallery\|showRecordDetail\|closeRecordDetail\|_openLightbox\|_downloadImage\|_downloadGalleryZip" /workspace/src/js/app.js

# 4. i18n key 完备
for k in "app.view.gallery" "app.gallery.empty" "app.gallery.selectionMode" "app.gallery.downloadAll" "app.modal.images" "app.modal.chooseFiles" "app.detail.download" "app.image.downloadFail" "app.image.zipLibMissing"; do
  grep -q "'$k':" /workspace/src/js/i18n.js || echo "MISSING: $k"
done
# 期望：无输出

# 5. 迁移文件存在
test -f /workspace/supabase/migrations/010_add_image_urls_array.sql && echo "MIG OK"

# 6. JSZip 引入
grep -n "jszip" /workspace/index.html /workspace/sw.js

# 7. JS 语法
cd /workspace && for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.2 浏览器端核心验证（5 步）

1. **多图导入**：
   - 打开记录 modal，点击"选择图片"，多选 3 张本地图
   - 预览区应出现 3 张缩略图，每张右上角带 X 删除
   - 删除中间一张 → 剩 2 张
   - 保存记录 → 卡片应显示横滑轮播（3 张全显示），右上角无 `+N`（已全显）
   - 再次编辑该记录 → 应能加载回 3 张图

2. **图库视图**：
   - 顶栏点「图库」→ 切到 gallery 视图
   - 当前 timeline 所有有图的记录以 3-6 列方形网格展示（iOS 风格）
   - 点击缩略图 → 打开 detail modal 显示该记录
   - 点「选择」→ 进入选择模式，点击若干缩略图（边框变蓝 + 圆点打勾）
   - 底部 action bar 出现「已选 N 张」+ 取消/下载
   - 点「下载」→ 浏览器下载 ZIP 文件，解压后含 N 张图
   - 切回「时间轴」→ 选择模式自动退出

3. **卡片详情**：
   - 在时间轴视图下，点击任一卡片正文（非按钮）→ 打开 detail modal
   - 显示：时间、重要性、标题、创建者（团队）、多图轮播、内容、prev/next、编辑/删除/下载
   - 多图记录：左/右箭头 + 缩略图条 + 「第 i / N 张」
   - 点大图 → 全屏 lightbox；ESC 关闭
   - 点「上一条」→ 跳到按 date+time 排序的上一条记录
   - 点「下载图片」→ 下载当前显示的图
   - 点「编辑」→ 关闭 detail，打开编辑 modal
   - 点「删除」→ 关闭 detail，弹确认，删除后回到时间轴

4. **离线无回归**：
   - 断网 → 添加 1 条 2 图记录 → 保存应成功（图片保存为 base64）
   - 卡片渲染应显示 2 张图
   - 图库视图应能浏览
   - 详情 modal 打开正常
   - 在线后 sync → 图片应自动上传到 storage，URL 切换为 https

5. **兼容性**：
   - 给一个**只有 image_url** 的旧记录（手动 SQL 写一条）→ 卡片应显示 1 张图（image_url），无 `+N`
   - 编辑该记录 → 弹 modal 应预填 1 张图
   - 再加 1 张新图保存 → 变成 2 张图

### 6.3 边界情况

- 离线新建 0 图记录 → 卡片无图区块
- 云端返回的 `image_urls` 含 `null` / 空串 → `_getRecordImages` 过滤掉
- 同一 image 在两条不同记录中被引用 → 图库去重（不重复显示）
- data URL 的 image 同步到云端前 → gallery 也能显示（base64 渲染）
- 删除 0 图记录 → 正常删除，无 storage 调用
- 详情 modal 在删除最后一张图后 → 自动隐藏 carousel 区
- ZIP 打包时 fetch 某张图失败 → 跳过该张（console.warn）继续打包其他图
- ZIP 库未加载完成时点下载 → 提示「正在加载打包库」并降级为单图下载

## 7. Out of Scope

- 不改现有 vx-timeline-item 内部结构（除多图 carousel）
- 不改 record 索引（仍按 date / createdAt / timeline_id）
- 不改 supabase RLS（policy 已支持 SELECT/INSERT/DELETE 多图）
- 不改首页 / mockup / i18n 现有 100+ keys
- 不实现「从记录删除单图」（只支持添加时一次选多张、保存时上传）
- 不实现图库「按时间分组」/ 「按重要性筛选」（暂只按日期倒序）
- 不实现「图库 → 跳到对应日期」/「图库 → 跳到对应时间轴」
- 不实现 lightbox 缩放 / 旋转 / 双指放大
- 不实现图库按用户筛选
- 不实现 ZIP 内的目录结构（平铺）
- 不实现「分享图库」（只下载）
- 不实现图库搜索
- 不改 record modal 的 date / time / importance / title / content 字段结构
- 不改月历格子内显示
- 不动现有 `getFullDisplayName` / 角色判断 / 成员管理

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 多图上传 N 张 → 一次同步 N 次 storage 调用，慢/超时 | 顺序 await，每张独立 try/catch，单张失败不影响其他；显示 loading 态 |
| IndexedDB 旧记录无 image_urls 字段 → 读取时为 undefined | `_getRecordImages` 优先 image_urls 数组；回退 image_url 单图（与现状一致） |
| `image_urls` 在 RLS 下能否被新前端写？ | RLS 用 `USING / WITH CHECK` 限定 `auth.uid()`，不限制字段；新字段默认允许 |
| 图库同图去重误判：data URL 相同 file 不同 reader 后不同 | 已用 `if (seen.has(url)) return;`，data URL 也参与去重；data URL 重复少见（每次 FileReader 都生成完整 base64） |
| JSZip CDN 失败 / 慢 / 被墙 | 100KB + cdnjs 全球 CDN；fallback：单图下载 + 提示；`typeof JSZip === 'undefined'` 兜底 |
| ZIP 文件名冲突 → zip.file() 会自动去重 | 已加 `used` Set 保证去重 |
| 详情 modal 在窄屏（< 640px）下 carousel 太挤 | 缩略图条横向 scroll，CSS 已加 snap；prev/next 按钮 sm 隐藏文字只留图标 |
| 编辑/删除按钮在卡片内的事件冒泡导致详情打开 | 事件委托时 `if (e.target.closest('.vx-edit-btn, .vx-delete-btn')) return` |
| 详情 modal 内点 prev/next 切换 → url 图片可能未缓存 → lightbox 出错 | lightbox 直接用 `img.src = url`，浏览器自动 fetch |
| 月历弹窗（showDayRecords）多图与卡片不一致 | 同步改用 `_getRecordImages` + 横向 carousel |
| 切 timeline 残留 gallery 选择态 | `renderView` 顶部 `if (this._gallerySelectionMode) this._exitGallerySelection();` |
| 图库空态没图时 `gallery-grid` 是空 div 占 0 高 → 上下不居中 | 显式 `gallery-empty` 占位块 + `py-16` |
| 详情 modal 的 prev/next 在只有 1 条记录时按钮 disabled | HTML `disabled` 属性 + CSS `disabled:opacity-40` |
| `getRecordsForCurrentTimeline` 缓存了 records → 详情 modal 直接读 `this.records` | 已确认用 `this.records.find(...)` |
| 同步冲突：本地编辑 record 加图 + 云端旧版本无图 → last-write-wins 仍是当前现状 | 不在本轮范围 |
