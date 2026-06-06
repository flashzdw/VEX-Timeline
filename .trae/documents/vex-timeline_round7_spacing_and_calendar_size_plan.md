# VEX-Timeline Round 7 微调计划（时间轴上方间距 + 月历尺寸）

## 1. Summary

Round 6 完成了时间轴布局重构（日期外置、重要性 inline）。本轮聚焦 2 个微调：

1. **时间轴卡片上方留白缩**：当前 `gap + margin-bottom + padding-top` 累计 ~22px，缩到 ~10px
2. **月历放大但保持单屏**：当前默认 90px / lg 100px（用户感觉"还是不够大"），加大到 110px / 120-130px 同时确保一屏可见

## 2. Current State Analysis

### 2.1 Round 1-6 全部修复在位

- CACHE_NAME v6 ✓
- 月历 dots 容器（每记录 1 个点）✓
- 月历 max-w-3xl 容器 ✓
- 重要性 data-selected + 三重 fallback ✓
- 时间轴按日期分组 + 单一 rail 容器 ✓
- 图片 Storage 上传 ✓
- 云状态刷新按钮 + 5 分钟自动刷新 ✓
- 视图切换 / 筛选语义色 ✓

### 2.2 问题根因

#### 根因 ①：时间轴标签上方留白过大

**当前累积间距**（从 day-header 到第一行内容）：
- `.vx-day-section { gap: 8px }` — day-header 与首个 item 之间
- `.vx-day-header { margin-bottom: 4px }` — header 自带下边距
- `.vx-timeline-item { padding: 0.625rem 0.875rem }` — item 顶部 10px
- **合计约 22px**

**视觉问题**：从截图可见，day-header "2026年06月07日 周日" 与第一张卡片的黑边框之间有明显空隙。

**修复**：
- `.vx-day-section { gap: 4px }`（8 → 4）
- `.vx-day-header { margin-bottom: 0 }`（4 → 0）
- `.vx-timeline-item { padding: 0.5rem 0.75rem }`（10/14px → 8/12px）
- `.vx-rail-dot { top: 4px }`（6 → 4，配合新 padding）
- **合计约 8px**（节省 ~14px）

#### 根因 ②：月历偏小，需要放大

**当前尺寸**（[src/css/styles.css:155-181](file:///workspace/src/css/styles.css#L155-L181)）：
- 默认 `min-height: 90px`
- `< 640px` 移动端 `64px`
- `>= 1024px` lg `100px`
- 容器 `max-w-3xl` = 768px

**6 行总高度**（按桌面 100px 计算）：
- 6 × 100 = **600px** 网格
- + 月历头导航 ~50px
- + 页面 top bar ~80px
- = 730px — 1080p 屏幕（960px 可用）有富余，**说明可以放大**

**修复**（保持一屏可见，目标总高 ≤ 800px）：
- 默认 `min-height: 110px`（90 → 110，+22%）
- `< 640px` 移动端 `min-height: 80px`（64 → 80，+25%）
- `>= 1024px` lg `min-height: 130px`（100 → 130，+30%）
- 容器宽度可稍微加宽：`max-w-3xl` (768px) → `max-w-4xl` (896px) — 让每格更宽

**6 行总高度**（按桌面 110px 计算）：
- 6 × 110 = **660px** 网格
- + 头 ~50px
- + top bar ~80px
- = 790px — **1080p 屏幕（960px 可用）内可放下**
- lg 屏幕 6 × 130 = 780px，+ 头 50 + top 80 = 910px — **仍能放得下**（960px 余量 50px）

## 3. Proposed Changes

### 3.1 时间轴上方留白缩

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css#L442-L518)

```css
/* 每天一个 section */
.vx-day-section {
  display: flex;
  flex-direction: column;
  gap: 4px;          /* Round 7：8px → 4px */
}
.vx-day-section + .vx-day-section {
  margin-top: 24px;  /* 每天之间留 24px（不变） */
}

/* 大日期 header */
.vx-day-header {
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--color-fg);
  margin-bottom: 0;   /* Round 7：4px → 0 */
}

/* 卡片样式（更紧凑） */
.vx-timeline-item {
  position: relative;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;   /* Round 7：10/14px → 8/12px */
  transition: border-color 0.2s, transform 0.2s;
}

/* 圆点上移（配合更小的 padding） */
.vx-timeline-item .vx-rail-dot {
  position: absolute;
  left: -32px;
  top: 4px;           /* Round 7：6px → 4px */
  width: 28px;
  height: 28px;
  ...
}
```

### 3.2 月历放大

**文件 1**：[src/css/styles.css](file:///workspace/src/css/styles.css#L155-L181)

```css
.vx-calendar-cell {
  min-height: 110px;          /* Round 7：90px → 110px */
  background-color: var(--color-bg);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, transform 0.2s;
  position: relative;
  font-weight: 600;
  overflow: hidden;
}

/* 响应式 */
@media (max-width: 640px) {
  .vx-calendar-cell { min-height: 80px; }    /* Round 7：64px → 80px */
}
@media (min-width: 1024px) {
  .vx-calendar-cell { min-height: 130px; }   /* Round 7：100px → 130px */
}
```

**文件 2**：[index.html](file:///workspace/index.html#L296)

```html
<!-- 改前 -->
<div id="calendar" class="grid grid-cols-7 gap-0 border-2 border-border rounded-lg overflow-hidden max-w-3xl mx-auto"></div>

<!-- 改后 -->
<div id="calendar" class="grid grid-cols-7 gap-0 border-2 border-border rounded-lg overflow-hidden max-w-4xl mx-auto"></div>
```

容器宽度从 `max-w-3xl`（768px）→ `max-w-4xl`（896px）：
- 7 列 / 896px ≈ 128px / 格（横向更大）
- 与 lg 桌面 130px 高度正方形更协调

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | day-section gap 8px → 4px | 节省 4px |
| D2 | day-header margin-bottom 4px → 0 | 节省 4px（Tailwind 默认 `<h3>` 有 margin，用 `0` 覆盖） |
| D3 | item padding 10/14px → 8/12px | 节省 2px 顶部 |
| D4 | rail-dot top 6px → 4px | 与新 padding 对齐 |
| D5 | 月历默认 min-height 90 → 110 | +22%，响应"再加大一点" |
| D6 | 月历移动端 64 → 80 | 移动屏也放大 |
| D7 | 月历 lg 100 → 130 | 大屏更大更舒展 |
| D8 | 月历容器 max-w-3xl → max-w-4xl | 与新 cell 高度比例协调 |
| D9 | 1080p 屏（960px 可用）一屏可见 | 6×110=660 + 头 50 + top 80 = 790 < 960 ✓ |
| D10 | 不改 dots 容器、today.has-high 等 | Round 5 修复保留 |
| D11 | 不改 vx-day-section +.vx-day-section margin-top 24px | 每天之间分隔保持 |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | (a) `.vx-day-section gap: 8 → 4`；(b) `.vx-day-header margin-bottom: 4 → 0`；(c) `.vx-timeline-item padding: 0.625rem/0.875rem → 0.5rem/0.75rem`；(d) `.vx-rail-dot top: 6 → 4`；(e) `.vx-calendar-cell min-height: 90 → 110`；(f) `@media (max-width: 640px) min-height: 64 → 80`；(g) `@media (min-width: 1024px) min-height: 100 → 130` |
| [index.html](file:///workspace/index.html#L296) | 改 | 月历容器 `max-w-3xl` → `max-w-4xl` |
| [sw.js](file:///workspace/sw.js) | 改 | Bump v6 → v7 触发 SW 刷新 |
| 其他 | 不改 | Round 1-6 全部保留 |

## 6. Verification Steps

### 6.1 静态检查
```bash
# 1. 时间轴间距调整
grep -nA1 "vx-day-section\|vx-day-header {\|vx-rail-dot" /workspace/src/css/styles.css

# 2. 月历尺寸调整
grep -nA1 "min-height: 110\|min-height: 80\|min-height: 130\|max-w-4xl" /workspace/src/css/styles.css /workspace/index.html

# 3. SW bump
grep -n "CACHE_NAME" /workspace/sw.js
```

### 6.2 JS 语法
```bash
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.3 浏览器端核心验证 5 步
1. **时间轴间距缩**：
   - 切换到时间轴视图
   - day-header 与第一张卡片的距离**明显减小**（视觉上更紧凑）
   - 卡片内部 padding 更小
2. **圆点位置对齐**：
   - 圆点 top 4px，仍骑在 rail 竖线上
   - 圆点与卡片第一行内容（time）垂直居中感保留
3. **月历放大**：
   - 切到月历视图
   - 单格**明显变大**（桌面 110px / lg 130px）
   - 数字 + dots + 视图信息更舒展
4. **月历一屏可见**（1080p）：
   - 浏览器窗口高度 ~960px（去掉 chrome）
   - 页面 top bar ~80px + 月历头 ~50px + 6 行 × 110px = **790px**
   - **无需垂直滚动**
5. **移动端**：
   - 月历单格 80px（比之前 64px 大）
   - 数字、dots 仍清晰

### 6.4 视觉对比
- Round 6 截图：day-header 与 item 间距大（~22px）
- Round 7 截图：间距缩到 ~8px
- Round 6 月历：单格偏小（90-100px）
- Round 7 月历：单格变大（110-130px）

## 7. Out of Scope

- 不改日期 header 字号
- 不改时间轴重要性颜色
- 不改月历 dots 数量 / 大小
- 不改月历响应式断点（保持 640 / 1024）
- 不改月历 today 高亮
- 不做 4K / 超大屏适配（lg 130px 已足够）
- 不做暗色模式
- 不压缩图片

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 1080p 屏月历超出可视区 | 计算：6×110=660 + 130=820，余量 60-140px ✓ |
| 卡片 padding 缩到 8px 太紧 | 配合 `font-size: 1.0625rem` 标题仍可读；圆点 top 4px 对齐 |
| 容器 max-w-3xl → 4xl 后窄屏（< 896px）不会变宽 | Tailwind max-w-4xl 是上限，窄屏会按可用宽度收缩 |
| 圆点 top 4px 接近 border 可能被遮 | 圆点 z-index: 1 + bg-color 已设 |
| day-header margin-bottom 0 后视觉太贴 | day-section gap 4px 提供缓冲 |
