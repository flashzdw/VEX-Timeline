# VEX-Timeline Round 6 修复计划（时间轴布局重构）

## 1. Summary

Round 5 修复了 7 个核心 bug。本轮聚焦**时间轴卡片内部布局微调**：

1. **重要性标签放到大标题前面**（行内），不再独占一行 → 省空间
2. **日期移到卡片外（上方）**：每天共用一个日期 header，卡片内部只显示时间
3. **保留** Round 5 的"跨天连贯"：单一 `.vx-timeline-rail` 容器 + 贯穿竖线
4. **减少上方留白**：item 顶部 padding + rail 容器 gap 同步缩

> 关键变化：Round 4-5 之间摇摆——Round 4 用了大日期 section header，Round 5 删了用小日期内联；现在 Round 6 折中：日期**大但在外**（每个 day 一个），卡片内部只显示时间。

## 2. Current State Analysis

### 2.1 Round 1-5 全部修复在位

- 取消本地/离线模式 ✓
- CACHE_NAME v5 ✓
- 重要性 data-selected + 三重 fallback ✓
- saveRecord 图片上传 Storage ✓
- 时间轴连贯（单一 rail 容器）✓
- 月历 dots 容器（每记录 1 个点）✓
- 视图切换 / 筛选语义色 ✓
- 5 分钟自动刷新 ✓
- 云状态刷新按钮 ✓

### 2.2 Round 6 用户截图当前布局

```html
<div class="vx-timeline-item">
  <div class="vx-rail-dot">...</div>
  <div class="edit/delete">...</div>
  <div class="text-[10px] text-fg/60">2026年06月07日 周日 · 14:30</div>  ← 日期+时间 内联
  <div class="mb-1.5"><span class="bg-accent">中</span></div>              ← 重要性 独占行
  <div class="font-semibold text-lg">Test</div>                          ← 大标题
  <div class="text-fg/60 text-sm">Test</div>                             ← 内容
</div>
```

**问题**：
- 每个 item 内部都有日期（重复，浪费空间）
- 重要性独占一行（与标题分离）
- 标题行 `text-lg` 之前有 `mb-1.5` + 上面的 importance 也有 `mb-1.5` → 累计大空白
- `vx-timeline-rail` 用 `gap-6`（24px）→ 卡片间空隙大

### 2.3 期望新布局（按用户描述）

```html
<div class="vx-timeline-rail">       <!-- 连续竖线容器 -->
  <section class="vx-day-section">   <!-- 每天一个 section -->
    <h3 class="vx-day-header">2026年06月07日 周日</h3>  <!-- 大日期，在卡片外、上方 -->
    <div class="vx-timeline-item">   <!-- 卡片 -->
      <div class="vx-rail-dot">...</div>
      <div class="edit/delete">...</div>
      <div class="vx-item-time">14:30</div>            <!-- 只显示时间 -->
      <div class="flex items-center gap-2">            <!-- 重要性 + 标题 行内 -->
        <span class="bg-accent">中</span>
        <h4 class="title">Test</h4>
      </div>
      <div class="content">Test</div>
      <img>
    </div>
    <div class="vx-timeline-item">...</div>
  </section>
  <section class="vx-day-section">...</section>
</div>
```

**关键**：
- 日期**大字号粗体** `text-xl font-extrabold`，但**没有大黑色块**（Round 4 旧版用过 `border-b-2 border-border` 横条，要避免）
- 重要性 inline 在标题**前**（`flex items-center gap-2`）
- item padding 缩小到 `0.75rem`（12px）
- rail gap 缩到 `gap-3`（12px）

## 3. Proposed Changes

### 3.1 `renderTimeline` 重写（按日期分组 + 卡片内部精简）

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L1411-L1489)

**关键逻辑**：
```js
async renderTimeline() {
  // ... (filtering logic unchanged)

  // Round 6：按日期分组（每一天共用一个大日期 header）
  // 但仍然用单一 .vx-timeline-rail 容器包裹（保留跨天连贯竖线）
  const groups = {};
  sortedRecords.forEach(r => {
    (groups[r.date] = groups[r.date] || []).push(r);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  let html = `<div class="vx-timeline-rail">`;  // 不再用 flex gap-6（改用 .vx-day-section 控制间距）

  sortedDates.forEach(dateStr => {
    const dayRecords = groups[dateStr].sort((a, b) =>
      (b.time || '00:00').localeCompare(a.time || '00:00')
    );
    const dayLabel = this.formatDateDisplay(dateStr);

    html += `
      <section class="vx-day-section">
        <h3 class="vx-day-header">${this._escapeHtml(dayLabel)}</h3>
    `;

    dayRecords.forEach(record => {
      const time = record.time || '—';
      const importance = record.importance || 'medium';
      const imgSrc = record.image || record.image_url || '';
      const canEdit = this.canEditRecord(record);
      const recordIdStr = String(record.id);

      // Round 6：卡片内部只显示时间；重要性 inline 在标题前
      html += `
        <div class="vx-timeline-item" data-importance="${importance}">
          <div class="vx-rail-dot">
            <i data-lucide="${importanceIcons[importance]}"></i>
          </div>
          ${canEdit ? `
            <div class="flex gap-2 justify-end mb-2">
              <button class="vx-action-btn h-7 w-7 bg-muted text-fg rounded-md flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-200 vx-edit-btn" data-id="${recordIdStr}" title="编辑">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>
              <button class="vx-action-btn h-7 w-7 bg-muted text-fg rounded-md flex items-center justify-center hover:bg-danger hover:text-white transition-all duration-200 vx-delete-btn" data-id="${recordIdStr}" title="删除">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          ` : ''}
          <div class="vx-item-time">${this._escapeHtml(time)}</div>
          <div class="vx-item-title-row">
            <span class="inline-flex items-center justify-center text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
            <h4 class="vx-item-title">${this._escapeHtml(record.title)}</h4>
          </div>
          ${record.content ? `<div class="vx-item-content">${this._escapeHtml(record.content)}</div>` : ''}
          ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-72 object-cover rounded-md border-2 border-border" alt="记录图片">` : ''}
        </div>
      `;
    });

    html += `</section>`;
  });

  html += `</div>`;
  timeline.innerHTML = html;
  // ... (lucide + edit/delete 事件绑定 保持不变)
}
```

### 3.2 CSS：新增 `.vx-day-section` / `.vx-day-header` / 调整 item 间距

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css#L420-L445)

```css
/* Round 6：日期分组 + 跨天连贯（折中方案） */
.vx-timeline-rail {
  position: relative;
  padding-left: 32px;
  /* 删除 gap-6 → 改用 .vx-day-section 控制间距 */
}
.vx-timeline-rail::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 8px;          /* Round 6：缩小顶部留白（从 28px → 8px） */
  bottom: 8px;       /* 缩小底部留白（从 28px → 8px） */
  width: 2px;
  background-color: var(--color-border);
}

/* 每天一个 section，包含一个大日期 header + 该日所有 items */
.vx-day-section {
  display: flex;
  flex-direction: column;
  gap: 8px;          /* Round 6：同一天内 item 之间紧凑 */
}
.vx-day-section + .vx-day-section {
  margin-top: 24px;  /* Round 6：每天之间留 24px（比 Round 5 的 gap-6 小一些） */
}

/* 大日期 header（外部、上方） */
.vx-day-header {
  font-size: 1.125rem;   /* text-lg → text-xl 中间值；用 rem 精确 */
  font-weight: 800;      /* font-extrabold */
  letter-spacing: -0.01em;
  color: var(--color-fg);
  margin-bottom: 4px;
  /* 不加 border-b-2 横条（避免 Round 4 旧版黑色块） */
}

/* 卡片样式（紧凑） */
.vx-timeline-item {
  position: relative;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.625rem 0.875rem;   /* Round 6：缩小到 10px/14px（原 1rem=16px） */
  transition: border-color 0.2s, transform 0.2s;
}
.vx-timeline-item:hover {
  border-color: var(--color-fg);
}

/* 卡片内部各元素 */
.vx-item-time {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(17, 24, 39, 0.6);  /* text-fg/60 */
  margin-bottom: 4px;
}
.vx-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;            /* Round 6：标题与下方内容紧凑 */
}
.vx-item-title {
  font-size: 1.0625rem;          /* 17px，比 text-lg(18px) 略小 */
  font-weight: 600;
  color: var(--color-fg);
  flex: 1;
  min-width: 0;
}
.vx-item-content {
  font-size: 0.875rem;           /* text-sm */
  color: rgba(17, 24, 39, 0.6);
  margin-top: 4px;
  margin-bottom: 8px;
}
```

### 3.3 `.vx-rail-dot` 微调（配合 padding 缩小）

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css#L450-L463)

```css
.vx-timeline-item .vx-rail-dot {
  position: absolute;
  left: -32px;
  top: 6px;                  /* Round 6：圆点上移（原 top: 8px，配合更小的 padding） */
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
```

### 3.4 响应式：移动端日期 header 字号缩小

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css)

```css
@media (max-width: 640px) {
  .vx-day-header { font-size: 1rem; }   /* text-base on mobile */
  .vx-item-title { font-size: 1rem; }
}
```

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | **重新按日期分组**（每个 day 一个 `.vx-day-section`） | 用户明确要求"每一天共用一个日期标签" |
| D2 | **保留单一 `.vx-timeline-rail` 容器**（贯穿竖线） | Round 5 跨天连贯要求；分组用 section 而非分裂 rail |
| D3 | **大日期 header 在外（section 上方）**，不在卡片内 | 用户明确要求"展示在标签外边的上边" |
| D4 | **大日期不加黑色横条** | 避免 Round 4 旧版 `border-b-2 border-border` 视觉负担 |
| D5 | 重要性 inline 在标题**前**（不是后），紧凑一行 | 用户明确要求"在标题前面" |
| D6 | item 顶部 padding 1rem → 0.625rem（10px） | 减小上方留白 |
| D7 | item 之间 gap 24px → 8px（同日）；24px（跨日） | 同日紧凑、跨日略分 |
| D8 | rail 容器 `::before` top/bottom 28px → 8px | 让首末圆点更靠边（视觉连贯） |
| D9 | 圆点 `top: 8px` → `top: 6px` | 配合更小的 item padding |
| D10 | 标题字号 18px（text-lg）→ 17px | 略小更紧凑，但视觉仍主导 |
| D11 | 移除卡片内"日期+时间"合并行 | 时间单独显示更小；日期在外 |
| D12 | 移动端日期/标题字号缩小 | 响应式 |
| D13 | 移动端 edit/delete 按钮 `h-8 w-8` → `h-7 w-7`，icon `w-4 h-4` → `w-3.5 h-3.5` | 配合整体缩小 |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | `renderTimeline` 重写：按日期分组生成 `.vx-day-section` + 大日期 header；item 内部只显示时间 + 行内重要性+标题 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | (a) 新增 `.vx-day-section` / `.vx-day-header` / `.vx-item-time` / `.vx-item-title-row` / `.vx-item-title` / `.vx-item-content` 样式；(b) `.vx-timeline-rail::before` 调整 `top/bottom`；(c) `.vx-timeline-item` padding 缩小；(d) `.vx-rail-dot` top 缩小；(e) 响应式 |
| [sw.js](file:///workspace/sw.js) | 改 | Bump v5 → v6 触发 SW 刷新 |
| 其他 | 不改 | Round 5 全部修复保留 |

## 6. Verification Steps

### 6.1 静态检查
```bash
# 1. 大日期 header 类已加入
grep -n "vx-day-section\|vx-day-header\|vx-item-time\|vx-item-title" /workspace/src/css/styles.css /workspace/src/js/app.js

# 2. 单一 rail 容器仍保留
grep -n "vx-timeline-rail" /workspace/src/js/app.js
# 应只有 1 处（单一容器 + 内部多个 .vx-day-section）

# 3. item padding 缩小
grep -nA1 ".vx-timeline-item {" /workspace/src/css/styles.css
# 应有 padding: 0.625rem 0.875rem

# 4. SW bump
grep -n "CACHE_NAME" /workspace/sw.js
```

### 6.2 JS 语法
```bash
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.3 浏览器端核心验证 5 步
1. **跨 3 天各 2-3 条记录**：
   - 看到 **3 个大日期 header**（每个 day-section 顶部）
   - 卡片**不再**有日期显示
   - 卡片内只显示**时间**（如 `14:30`）
2. **每个卡片**：
   - **重要性 badge 在前**（红/黄/绿）+ **标题在后**（同行）
   - 内容在下方
3. **视觉连贯**：
   - 单一竖线**贯穿**所有 day-section（包括 day-header 区域）
   - 同日 item 之间紧凑（8px）
   - 跨日 section 之间略宽（24px）
4. **上方留白减少**：
   - item 顶部 padding 明显比 Round 5 小
   - rail 顶部/底部留白从 28px 缩到 8px
5. **移动端**：
   - 日期 header 缩小到 text-base
   - 标题缩小到 1rem
   - 整体仍可读、不挤

### 6.4 截图对比
- 对比 Round 5 截图：日期从"卡片内小字 + 时间" → 移到"section 顶部大字"
- 重要性从"独占一行" → "行内标题前"
- 顶部留白明显减少

## 7. Out of Scope

- 不改重要性颜色 / 样式
- 不改筛选逻辑
- 不改时间排序
- 不改 7 色 token
- 不改月历
- 不改 vx-timeline-rail 整体位置/宽度
- 不动 day-records-overlay（点击月历小点弹出的浮层）
- 不做暗色模式

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 单一 rail + 多 section 导致竖线穿过头部文字 | 日期 header 文字在 32px 之后，竖线在 14px → 不重叠 |
| 重要性 inline 后视觉重量变轻 | badge 仍用语义色（红/黄/绿）+ uppercase 突出 |
| 移动端 item padding 过紧（10px）| 响应式调整为 0.75rem |
| `gap-3` 太紧凑导致卡片粘连 | 用 `border-2` + `border-radius` 视觉分隔 |
| Rail 顶部留白 8px 可能让第一个圆点"露半边" | 圆点 z-index: 1 + bg-color 覆盖竖线 |
| 老的 day-records-overlay（点月历小点弹出）用了不同的 vx-day-record 类 | 保持不动，那个浮层有独立的渲染函数 |
