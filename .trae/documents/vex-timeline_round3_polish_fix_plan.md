# VEX-Timeline Round 3 修复计划（视觉打磨 + 关键 bug）

## 1. Summary

Round 2 已修复 5 个核心对接 bug。本轮聚焦**视觉打磨**与**3 个新发现的具体问题**：

1. **月历"今天+高重要性"对比度崩塌**（截图证据）：today 类强制白色文字，叠加 has-high 浅红底 → 完全看不清
2. **时间轴设计无视觉串联**：需要一根竖线把所有内容连接起来（时间轴的语义）
3. **日期分组头部是大黑色块**：违反"连贯性"，应改为简洁文字行
4. **重要性（高/中/低）颜色与网站蓝撞色**：应使用语义色（红/黄/绿），按钮和标签均生效
5. **管理赛队按钮点击无效果**：需修复点击链路 / 显示状态
6. **控制台 3 个报错**：
   - **`db.js:145 DataError: ... parameter is not a valid key`**（致命）—— `parseInt` 把 UUID 转成 NaN
   - `cdn.tailwindcss.com should not be used in production`（警告）
   - `[VEX-Timeline] Auth state changed: SIGNED_IN` × 6（订阅重复触发）

## 2. Current State Analysis

### 2.1 Round 1+2 修复全部在位

通过静态检查确认：
- `lucide@0.378.0` 固定 ✓
- `getTimelinesForUser` 3 步独立查询 ✓
- 月历扁平 grid + 单边 1px 边框 + `vx-calendar-row-last` 末行类 ✓
- `processSyncQueue` 失败项 continue ✓
- `_waitForUserProfile(3000)` 兜底 ✓
- `_loadUserProfile` 3 次重试 + 退避 ✓
- `.vx-mobile-drawer` `overflow-y: auto` ✓
- `.vx-cloud-status.is-ok` `#059669` 深绿 ✓
- CACHE_NAME v3 ✓

### 2.2 本轮 6 个新问题根因

#### 根因 ① ：月历 today + has-high 文字不可见

**位置**：[src/css/styles.css:186-201](file:///workspace/src/css/styles.css#L186-L201)
```css
.vx-calendar-cell.today {
  background-color: var(--color-primary);  /* 蓝底 */
  color: var(--color-bg);                  /* 白字 */
}
.vx-calendar-cell.has-high {
  background-color: #FEF2F2;               /* 浅红底 */
}
```

**问题**：当 cell 同时是 `today` + `has-high` 时，背景变浅红，但 `color: var(--color-bg)` 仍是白色 → **白字 + 浅粉底 = 完全不可读**（截图"6"号）。优先级问题：`has-high` 覆盖了 `today` 的 `background-color`，但 `color` 没被覆盖。

**修复**：让 `has-high` / `has-medium` / `has-records` 等覆盖类也覆盖 `color`。同时给 `today` 类在轻量情况下（如本身是高 importance）改用深色文字+边框/小蓝点区分"今天"。

#### 根因 ② ：时间轴无视觉串联

**位置**：[src/js/app.js:1281-1318](file:///workspace/src/js/app.js#L1281-L1318)

**问题**：当前 `.vx-timeline-item` 是独立卡片，没有视觉线索表示"这些是同一天 / 同一时间轴"。

**修复**：在 items 容器左侧加 **2px 竖线**（贯穿所有 items），每个 item 左侧的圆形图标"骑"在竖线上，类似 commit graph / GitHub / Linear 的 timeline 视觉。

```html
<div class="vx-timeline-rail relative pl-12">
  <!-- 2px 竖线，绝对定位在左侧 -->
  <!-- 每个 item 左侧圆形图标绝对定位在竖线上 -->
</div>
```

#### 根因 ③ ：日期分组用大黑色块

**位置**：[src/js/app.js:1275-1280](file:///workspace/src/js/app.js#L1275-L1280)
```html
<section class="flex flex-col gap-4">
  <div class="bg-fg text-white px-6 py-4 rounded-md flex items-center justify-between">
    <span class="font-extrabold text-2xl tracking-[-0.02em]">${...}</span>
    <span class="text-xs font-semibold uppercase tracking-wider opacity-80">${dateRecords.length} 条</span>
  </div>
  <div class="flex flex-col gap-3">  <!-- items 容器 -->
```

**问题**：用户明确说"不要用一个大黑色块放在那，就是一行小的黑色的字就行"。`bg-fg text-white` 黑色块破坏连贯性。

**修复**：改为简洁一行：
```html
<div class="flex items-baseline gap-3 px-1 pb-2 border-b-2 border-border">
  <h2 class="font-extrabold text-2xl tracking-[-0.02em] text-fg">2026-06-06</h2>
  <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">3 条</span>
</div>
```

下方 1px 边线收口，**整体是一行文字**。

#### 根因 ④ ：重要性用网站蓝（与背景同色或冲突）

**位置**：[src/js/app.js:1263-1267](file:///workspace/src/js/app.js#L1263-L1267)（timeline label）和 [src/js/app.js:680-689](file:///workspace/src/js/app.js#L680-L689)（modal selector）

```js
const importanceBadgeColors = {
  high:   'bg-primary text-white',     // 蓝 ← 错误
  medium: 'bg-accent text-white',      // 黄 ← 正确
  low:    'bg-secondary text-white'    // 绿 ← 正确
};
```

**问题**：
- high 用了 `bg-primary`（网站蓝 = `--color-primary` = `#3B82F6`），与其他 UI 冲突
- 用户希望：**高=红 / 中=黄 / 低=绿** 语义色（使用已存在的 `--color-danger`/`--color-accent`/`--color-secondary`）

**修复**：
```js
const importanceBadgeColors = {
  high:   'bg-danger text-white',      // 红 #EF4444
  medium: 'bg-accent text-white',      // 黄 #F59E0B
  low:    'bg-secondary text-white'    // 绿 #10B981
};
const importanceSelectedClasses = {
  high:   ['bg-danger', 'text-white', 'border-danger'],
  medium: ['bg-accent', 'text-white', 'border-accent'],
  low:    ['bg-secondary', 'text-white', 'border-secondary']
};
```

模态框选择器：选中态直接显示对应颜色（红/黄/绿），未选中态是 `bg-muted text-fg/60`。

#### 根因 ⑤ ：管理赛队点击无效果

**位置**：[src/js/app.js:822-861](file:///workspace/src/js/app.js#L822-L861)
```js
async handleManageTeam() {
  const current = this.timelines.find(t => t.id === this.currentTimelineId);
  if (!current || current.type !== 'team') return;  // ← 静默 return
  ...
  this.openModalById('invite-modal');
}
```

**问题 5a**：用户是赛队 owner（按钮显示），点击后：
1. `getTimelineMembers` 抛错（成员查询 RLS 失败 / 网络抖动）→ catch 吞错
2. `openModalById('invite-modal')` 仍执行 → 模态框应打开
3. **但如果 `current` 不在 `this.timelines` 中**（数据竞态）→ 静默 return

**问题 5b**：在个人时间轴上时，按钮仍可能在 user menu 中可见（mobile drawer），用户期望点击"管理赛队"应给出反馈（"你不在任何赛队中"），而不是无反应。

**修复**：
- `handleManageTeam` 不再静默 return；如果 `current` 不是 team，**显示提示 toast**（"请先选择赛队"）
- 用 `cloudDBManager.getTimelineMembers` 时增加防御性：传 timeline id 后再做 try/catch，错误时给模态框显示错误
- 模态框内容（`#members-list`）为空时显示"暂无成员"而不是空白

#### 根因 ⑥ ：控制台 3 个错误

##### 6a：`db.js:145 DataError: ... parameter is not a valid key`（致命）

**位置**：[src/js/app.js:1326-1338](file:///workspace/src/js/app.js#L1326-L1338)
```js
document.querySelectorAll('.vx-edit-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const id = parseInt(e.currentTarget.dataset.id);   // ← UUID → NaN
    const record = this.records.find(r => r.id === id);
    if (record) this.openModal(record);
  });
});
document.querySelectorAll('.vx-delete-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const id = parseInt(e.currentTarget.dataset.id);   // ← UUID → NaN
    this.deleteRecord(id);                              // ← dbManager.deleteRecord(NaN) 抛错
  });
});
```

**问题**：云端同步的记录 `id` 是 **UUID 字符串**（如 `"a3f5...-7b9c"`），`parseInt("a3f5...-7b9c")` → `NaN`。
- 编辑按钮：`records.find(r => r.id === NaN)` 永远 false → 点击无反应
- 删除按钮：`dbManager.deleteRecord(NaN)` → IndexedDB `store.delete(NaN)` → "parameter is not a valid key"

**修复**：去掉 `parseInt`：
```js
const id = e.currentTarget.dataset.id;   // ← 字符串（UUID 或数字都兼容）
const record = this.records.find(r => String(r.id) === id);
```

##### 6b：Tailwind CDN 生产警告

**位置**：[index.html:570+](file:///workspace/index.html)

**问题**：`cdn.tailwindcss.com` 是开发用 JIT CDN，生产环境会有性能 + 此警告。

**修复**：
- 短期：在 console 显示一行 `[VEX-Timeline] 注：当前使用 Tailwind Play CDN，生产环境建议改用 CLI/PostCSS 构建` 让用户知道这是有意为之
- 长期（不实施，留作未来任务）：用 Tailwind CLI 预构建

##### 6c：Auth state changed: SIGNED_IN × 6

**位置**：[src/js/auth.js:38-56](file:///workspace/src/js/auth.js#L38-L56)

**问题**：`onAuthStateChange` 订阅被反复创建（每次 `init()` 调一次），加上 Supabase SDK 内部对 session 刷新的多触发。日志里"6 次 SIGNED_IN"是同一登录触发的多次回调。

**修复**：
- `init()` 中**先 unsubscribe 旧的再 subscribe 新的**（防重复）
- 减少不必要的 console.log（已有 `_DEBUG` 模式可以关闭）
- 给 console.log 加时间戳和事件计数 `[AUTH #1] INITIAL_SESSION` `[AUTH #2] SIGNED_IN`...

## 3. Proposed Changes

### 3.1 月历 today + has-high 对比度

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css)

```css
/* has-high / has-medium / has-records 也覆盖 color，避免 today 白字撞浅红 */
.vx-calendar-cell.has-high,
.vx-calendar-cell.has-medium,
.vx-calendar-cell.has-records {
  color: var(--color-fg);   /* 强制深色文字 */
}
.vx-calendar-cell.today {
  background-color: var(--color-primary);
  color: var(--color-bg);
  border: 2px solid var(--color-primary);   /* 加边框让"今天"即使叠加也清晰 */
}
/* 今天是高 importance 时：白底蓝边 + 深字 + 蓝点 */
.vx-calendar-cell.today.has-high {
  background-color: var(--color-bg);
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.vx-calendar-cell.today.has-high::before {
  content: '';
  position: absolute;
  top: 4px; right: 4px;
  width: 6px; height: 6px;
  background-color: var(--color-primary);
  border-radius: 999px;
}
```

注意：当前 `has-records` 只用 `::after` 做小蓝点。`has-high` / `has-medium` 没有小点指示，需要在 app.js 中加 class 区分。

### 3.2 时间轴竖线串联

**文件**：[src/css/styles.css](file:///workspace/src/css/styles.css) + [src/js/app.js](file:///workspace/src/js/app.js)

**新 CSS**：
```css
/* ============================================================
   时间轴竖线 + 圆形指示器
   ============================================================ */
.vx-timeline-rail {
  position: relative;
  padding-left: 28px;  /* 圆形 14px 半径 + 14px 间距 */
}
.vx-timeline-rail::before {
  content: '';
  position: absolute;
  left: 14px;          /* 圆形中心 */
  top: 28px;           /* 跳过第一个圆形上沿 */
  bottom: 28px;        /* 跳过最后一个圆形下沿 */
  width: 2px;
  background-color: var(--color-border);
}
.vx-timeline-item {
  position: relative;
  /* 圆形骑在竖线上 */
}
.vx-timeline-item .vx-rail-dot {
  position: absolute;
  left: -28px;
  top: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background-color: var(--color-bg);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
/* 不同 importance 的圆形颜色 */
.vx-timeline-item[data-importance="high"]   .vx-rail-dot { border-color: var(--color-danger); }
.vx-timeline-item[data-importance="medium"] .vx-rail-dot { border-color: var(--color-accent); }
.vx-timeline-item[data-importance="low"]    .vx-rail-dot { border-color: var(--color-secondary); }
.vx-rail-dot i { width: 14px; height: 14px; }
.vx-timeline-item[data-importance="high"]   .vx-rail-dot i { color: var(--color-danger); }
.vx-timeline-item[data-importance="medium"] .vx-rail-dot i { color: var(--color-accent); }
.vx-timeline-item[data-importance="low"]    .vx-rail-dot i { color: var(--color-secondary); }
```

**新 HTML**（在 app.js renderTimeline 中重构）：
```html
<section class="flex flex-col gap-6">
  <!-- 简洁日期行 -->
  <div class="flex items-baseline gap-3 px-1 pb-2 border-b-2 border-border">
    <h2 class="font-extrabold text-2xl tracking-[-0.02em] text-fg">2026-06-06</h2>
    <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">3 条</span>
  </div>
  <!-- 竖线 + 圆形 + 内容 -->
  <div class="vx-timeline-rail flex flex-col gap-4">
    <div class="vx-timeline-item" data-importance="high">
      <div class="vx-rail-dot">
        <i data-lucide="alert-circle"></i>
      </div>
      <div class="bg-white border-2 border-border rounded-md p-4">
        <!-- 时间 / 标签 / 标题 / 内容 / 图片 -->
      </div>
    </div>
    ...
  </div>
</section>
```

### 3.3 重要性颜色语义化

**文件**：[src/js/app.js](file:///workspace/src/js/app.js)

```js
// 替换 importBadgeColors 与 setImportance
const importanceBadgeColors = {
  high:   'bg-danger text-white',       // 红 #EF4444
  medium: 'bg-accent text-white',       // 黄 #F59E0B
  low:    'bg-secondary text-white'     // 绿 #10B981
};
const importanceSelectedClasses = {
  high:   ['bg-danger', 'text-white', 'border-danger'],
  medium: ['bg-accent', 'text-white', 'border-accent'],
  low:    ['bg-secondary', 'text-white', 'border-secondary']
};

setImportance(val) {
  document.querySelectorAll('#importance-selector [data-importance]').forEach(btn => {
    const v = btn.dataset.importance;
    const isSelected = v === val;
    // 清除所有 importance 相关类
    btn.classList.remove('bg-fg', 'text-white', 'bg-muted', 'text-fg/60',
                        'bg-danger', 'bg-accent', 'bg-secondary',
                        'border-danger', 'border-accent', 'border-secondary');
    if (isSelected) {
      importanceSelectedClasses[v].forEach(c => btn.classList.add(c));
    } else {
      btn.classList.add('bg-muted', 'text-fg/60');
    }
  });
}
```

### 3.4 管理赛队点击无效果修复

**文件**：[src/js/app.js](file:///workspace/src/js/app.js)

```js
async handleManageTeam() {
  const current = this.timelines.find(t => t.id === this.currentTimelineId);
  if (!current || current.type !== 'team') {
    // 改为可见提示而非静默 return
    this.showToast('请先在时间轴下拉中选择一个赛队', 'warning');
    return;
  }
  // ... (后续逻辑同原)
}

showToast(message, type = 'info') {
  const t = document.getElementById('vx-toast');
  if (!t) return;
  t.textContent = message;
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-md text-sm font-semibold z-[200] vx-toast-${type}`;
  t.classList.remove('hidden');
  if (window.lucide && lucide.createIcons) lucide.createIcons();
  clearTimeout(this._toastTimer);
  this._toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}
```

在 [index.html](file:///workspace/index.html) body 末尾加 `<div id="vx-toast" class="hidden ..."></div>`。

### 3.5 修复 parseInt 致命 bug

**文件**：[src/js/app.js](file:///workspace/src/js/app.js#L1326-L1338)

```js
// 改前
const id = parseInt(e.currentTarget.dataset.id);
const record = this.records.find(r => r.id === id);

// 改后
const id = e.currentTarget.dataset.id;   // 字符串（UUID 或数字）
const record = this.records.find(r => String(r.id) === id);
```

```js
// 改前
const id = parseInt(e.currentTarget.dataset.id);
this.deleteRecord(id);

// 改后
const id = e.currentTarget.dataset.id;
this.deleteRecord(id);
```

同样的修复应用到 **所有 `parseInt` 在 dataset 上的调用**（grep 一下 `parseInt.*dataset`）。

### 3.6 Auth 订阅重复触发

**文件**：[src/js/auth.js](file:///workspace/src/js/auth.js#L38-L60)

```js
async init() {
  // 清理旧订阅
  if (this._authSubscription && this._authSubscription.unsubscribe) {
    try { this._authSubscription.unsubscribe(); } catch (e) {}
  }
  // ... (其他 init 逻辑)
  this._authSubscription = this._subscribeAuthState(supabase);
}

_subscribeAuthState(supabase) {
  if (!supabase) return null;
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (window.VEX_CONFIG && window.VEX_CONFIG.debug) {
      console.log(`[VEX-Timeline] Auth state changed: ${event}`);
    }
    // ... (其他回调逻辑)
  });
  return subscription;
}
```

### 3.7 Tailwind CDN 警告抑制

**文件**：[index.html](file:///workspace/index.html) 头部

```html
<!-- Tailwind Play CDN (开发/演示用；生产环境建议切换到 Tailwind CLI / PostCSS) -->
<script>
  (function () {
    var origWarn = console.warn;
    console.warn = function () {
      if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].indexOf('cdn.tailwindcss.com should not be used in production') !== -1) {
        return;
      }
      return origWarn.apply(console, arguments);
    };
  })();
</script>
<script src="https://cdn.tailwindcss.com"></script>
```

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | `today + has-high` 用白底蓝边深字 + 蓝点，**不用"今天=蓝底白字"+"高=浅红"叠加** | 单一职责：今天只表示"今天"，has-high 只表示"重要"，不混用 |
| D2 | 时间轴竖线用 **2px solid border**（不是 1px） | 1px 在 32-40px 圆形旁边看起来过细 |
| D3 | 圆形指示器不脱离竖线（骑在竖线上） | GitHub commits / Linear timeline 范式，可读性最好 |
| D4 | 日期分组用 `border-b-2 border-border` 单边收口 | 一行黑字 + 底边线，简洁连贯 |
| D5 | 重要性高/中/低 = `--color-danger`/`--color-accent`/`--color-secondary` | 已存在的 token，不引入新色，保持 7 色体系 |
| D6 | 模态框选择器**选中态用对应色块**（红/黄/绿），未选中态 `bg-muted` | 让用户在选的时候就能感知语义色 |
| D7 | 管理赛队按钮无赛队时显示 toast 提示，**不强制隐藏按钮** | 显式反馈 > 静默无反应 |
| D8 | `parseInt(dataset.id)` → `dataset.id` 字符串直传 | 兼容 UUID 字符串和数字 id |
| D9 | Auth 订阅加 unsubscribe 保护 + debug 开关 | 不影响生产，只减少噪声 |
| D10 | Tailwind CDN 警告只抑制不修复（保留 JIT） | 重构为 CLI 超出范围；警告无害 |
| D11 | 渲染时间轴时**不修改 vx-day-record**（day-records 弹窗样式） | 弹窗已经够清楚，弹窗是横向的 grid |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | 月历 today 组合样式 + 时间轴竖线 + rail-dot 颜色 |
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (a) parseInt bug 修复；(b) 重要性颜色语义化；(c) 模态选择器 setImportance；(d) 渲染时间轴 HTML 重构（竖线 + 简洁日期）；(e) handleManageTeam 加 toast；(f) showToast 方法 |
| [index.html](file:///workspace/index.html) | 改 | (a) toast div 节点；(b) Tailwind CDN 警告抑制 |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 改 | auth 订阅 unsubscribe + debug 开关 |
| [src/js/db.js](file:///workspace/src/js/db.js) | 不改 | `store.delete(id)` 已正确，bug 在 app.js |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 不改 | OK |
| [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 不改 | OK |
| [sw.js](file:///workspace/sw.js) | 不改 | 上一轮 bump v3 仍有效 |

## 6. Verification Steps

### 6.1 静态检查
```bash
# 1. parseInt 在 dataset 上应消失
grep -n "parseInt.*dataset" /workspace/src/js/app.js    # 应为空

# 2. bg-danger / bg-accent / bg-secondary 出现在 importance 配置中
grep -nA4 "importanceBadgeColors = {" /workspace/src/js/app.js

# 3. 时间轴 rail 相关类
grep -n "vx-timeline-rail\|vx-rail-dot" /workspace/src/js/app.js /workspace/src/css/styles.css

# 4. showToast 方法存在
grep -n "showToast\|vx-toast" /workspace/src/js/app.js /workspace/index.html
```

### 6.2 JS 语法
```bash
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.3 浏览器端核心验证 8 步
1. **登录** → 跳到主应用（无 console error）
2. **添加记录**（高 importance）→ **月历对应日期**有"红角 + has-high 浅红" → 当日若是今天 → **数字深色可读**（不是白字）
3. **切到时间轴视图**：
   - 日期行是**简洁一行**（不再是黑色块）
   - 每个 item **左侧有圆形 + 竖线**把所有内容串联
   - 圆形颜色：高=红边 / 中=黄边 / 低=绿边
4. **点击时间轴 item 的删除按钮** → 控制台**无 db.js DataError** → 记录被删除
5. **点击时间轴 item 的编辑按钮** → 模态框打开记录
6. **点加号 → 添加记录模态框**：
   - 重要性选择器**高=红 / 中=黄 / 低=绿** 选中态
7. **管理赛队**：
   - 选个人时间轴 → 点管理赛队 → **弹 toast 提示"请先选择赛队"**
   - 选赛队（且是 owner）→ 点管理赛队 → 邀请码 + 成员列表模态框打开
8. **控制台错误**：
   - 登录/添加/删除后**只剩**：
     - `cdn.tailwindcss.com should not be used in production`（被抑制）
     - `ServiceWorker registration successful`（正常）
     - `Auth state changed` 最多 1-2 次（无重复）

### 6.4 月历 today 极端情况
- 今天是 6 月 6 日（截图中的 6 号）→ 添加一条 importance=high 的记录 → cell "6" 的数字**清晰可读**（深字 + 蓝点 + 蓝边）
- 今天是 6 月 11 日（普通工作日）→ cell 仍是蓝底白字（保持原 today 视觉）
- 今天是 6 月 13 日（has-medium）→ cell 浅黄 + 深字（不再撞色）

## 7. Out of Scope

- 不重写为 React / Vue
- 不改 Tailwind 编译管线（Play CDN → CLI 转换是独立大任务）
- 不改 OAuth / 第三方登录
- 不改 Supabase 迁移 / RLS 策略
- 不改 7 色 token（仅复用已存在的 danger）
- 不做暗色模式 / 国际化
- 不改 Service Worker
- 不改 db.js / cloud-db.js（业务逻辑 OK）

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 改月历 today 样式后视觉变化大 | 截图对比 before/after，确保只是"高 importance 那天"用新样式，普通 today 不变 |
| 时间轴竖线 + 圆形重构后部分 item 显示错乱 | 同步改 app.js 渲染逻辑，确保每个 item 都加 vx-rail-dot |
| parseInt 修复后 edit 仍不工作 | 同时修复 records.find 比较（用 String(r.id)） |
| Toast 在移动端可能挡到底部导航 | 用 `bottom-6` + 居中 + 自动消失 3s；与 FAB 不重叠 |
| Auth 重复订阅可能因 unsubscribe 失败 | 加 try/catch；极端情况最多 2-3 次回调（Supabase 内部多次刷新） |
| Tailwind CDN 警告抑制可能掩盖其他问题 | 只匹配 `cdn.tailwindcss.com should not be used in production` 字符串，其他 warn 仍正常 |
