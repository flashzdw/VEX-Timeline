# VEX-Timeline 计划：赛队时间轴显示创建者 + 暗色模式头像 hover 修复

## 1. Summary

本轮完成两件事：

1. **新功能**：赛队时间轴（team timeline）的每条记录，在显示具体时间的位置后面加一个点 `·`，再显示**该记录的创建者**的「昵称（真实姓名）」，便于区分不同队友贡献的记录。个人时间轴不变（创建者永远是当前用户，冗余）。
2. **修复**：暗色模式下，鼠标移动到顶栏用户头像 / 移动端汉堡按钮上时，背景"泛白"（变成 `bg-gray-200`，是 Tailwind 硬编码的浅灰）。改为主题感知的 hover 颜色，浅色下保持原来的微深效果，暗色下也微亮、但不再是刺眼的浅灰。

## 2. Current State Analysis

### 2.1 数据流：records 已经带 `user_id`

- 云端 `records` 表 schema（[supabase/migrations/001_initial_schema.sql:33-45](file:///workspace/supabase/migrations/001_initial_schema.sql#L33-L45)）已有 `user_id uuid REFERENCES public.users(id)` 字段，由 RLS 强制 `auth.uid()` 写入。
- 云端 `cloudDBManager.addRecord`（[src/js/cloud-db.js:13-32](file:///workspace/src/js/cloud-db.js#L13-L32)）写入时已带 `user_id = authManager.getCurrentUser().id`。
- 云端 `getRecordsByTimeline`（[src/js/cloud-db.js:34-44](file:///workspace/src/js/cloud-db.js#L34-L44)）返回完整 `*` 含 `user_id`。
- 同步到本地 IndexedDB 时（[src/js/app.js:718-722](file:///workspace/src/js/app.js#L718-L722)）用 `{...r, cloud_id}` spread，**`user_id` 保留**。
- 本地新建未同步的记录（[src/js/app.js:2569](file:///workspace/src/js/app.js#L2569)）：`recordData` 没有 `user_id` 字段，但保存到云端时（line 2592）云端会写入 `user_id`。

**结论**：已同步的记录都有 `user_id`；离线新建的记录在同步后也会获得 `user_id`。无需改 schema 或迁移。

### 2.2 用户信息查询路径

- `cloudDBManager.getTimelineMembers(timelineId)`（[src/js/cloud-db.js:181-189](file:///workspace/src/js/cloud-db.js#L181-L189)）：已 select 完整 `users(username, nickname, real_name, name_only_surname, identity)`，并已 RLS 允许赛队成员互相查看（migration 003 + 004）。**直接复用即可**，无需新接口。
- `App.getFullDisplayName(u)`（[src/js/app.js:517-529](file:///workspace/src/js/app.js#L517-L529)）：已有「昵称（真实姓名）」统一格式（家长自动追加"家长"、老师仅填姓时追加"老师"）。**直接复用**。

### 2.3 时间轴类型判断

- `this.timelines`（云端拉取的 timeline 列表）含 `type: 'personal' | 'team'`。
- `current.type === 'team'`（[src/js/app.js:554](file:///workspace/src/js/app.js#L554)）已经在 `updateManageButton` 用过，**模式已成熟**。

### 2.4 时间显示位置

[src/js/app.js:2976](file:///workspace/src/js/app.js#L2976)（renderTimeline 内）：

```html
<div class="vx-item-time" style="...font-size:10px...">${this._escapeHtml(time)}</div>
```

需在此 div 内部追加 `<span>· 创建者</span>`。

### 2.5 暗色模式 hover 泛白根因

[index.html:875](file:///workspace/index.html#L875)（顶栏用户菜单按钮）：

```html
<button id="user-menu-btn" type="button"
        class="... bg-muted rounded-full hover:bg-gray-200 transition-all duration-200" ...>
```

[index.html:906](file:///workspace/index.html#L906)（移动端汉堡按钮）：

```html
<button id="mobile-menu-btn" type="button"
        class="lg:hidden ... bg-muted rounded-md hover:bg-gray-200 transition-all duration-200">
```

`hover:bg-gray-200` 是 Tailwind Play CDN 内置的**固定颜色 utility**（始终是 `#e5e7eb`），不会跟随 `prefers-color-scheme` 切换。在暗色模式（`--color-bg: #0F172A`、`--color-muted: #1E293B`）下，hover 时背景突然变成接近白色的浅灰，**对比度过高、且与暗色主题色板完全脱节**——这就是"泛白"。

其他用 `hover:bg-muted / hover:bg-fg / hover:bg-canvas` 的位置都通过 `src/css/styles.css:978-989` 走 CSS 变量，**没有这个问题**。

## 3. Proposed Changes

### 3.1 新功能：赛队时间轴显示记录创建者

**核心思路**：在 `renderTimeline` 内，如果当前 timeline 是 team 类型，先异步拉一次成员列表构建 `user_id → {nickname, real_name, ...}` 缓存（避免每条记录都查），然后对每条有 `user_id` 的记录追加 `· nick（real_name）`；个人 timeline 或本地未同步的记录（无 `user_id`）保持现状。

**文件 1**：[src/js/app.js](file:///workspace/src/js/app.js)

**a)** 在 `App` 类加一个用户缓存字段（紧跟 `this._currentTimelineRole` 等已存在的运行时缓存，line 569 附近）：

```js
// renderTimeline 用：缓存 user_id → {username, nickname, real_name, name_only_surname, identity}
// - 团队时间轴下避免每条记录都查 cloudDB
// - 切时间轴 / sync 完成后重建
this._recordCreatorCache = { timelineId: null, map: new Map() };
```

**b)** 在 `renderTimeline`（[src/js/app.js:2891](file:///workspace/src/js/app.js#L2891)）开头，team timeline 拉成员并建缓存：

```js
async renderTimeline() {
  const timeline = document.getElementById('timeline');
  this.showLoadingState();
  await new Promise(resolve => setTimeout(resolve, 100));

  // 新功能：team timeline 时预拉成员，构建 user_id → userObj 缓存
  await this._ensureCreatorMap();

  this.records = await this.getRecordsForCurrentTimeline();
  // ... 后续不变
}
```

**c)** 新增 helper `_ensureCreatorMap`（紧跟 `_loadCurrentTimelineRole` 之后，[src/js/app.js:582](file:///workspace/src/js/app.js#L582) 附近）：

```js
/**
 * 为 team timeline 构建 user_id → users row 的缓存（renderTimeline 用）
 * - 切时间轴 / sync 完成后调用 _invalidateCreatorMap() 强制重建
 * - 个人时间轴 / 未登录 / 无云端配置 → 跳过（保持现状）
 */
async _ensureCreatorMap() {
  const current = this.timelines.find(t => t.id === this.currentTimelineId);
  if (!current || current.type !== 'team') return;
  if (!authManager.isLoggedIn() || !supabaseManager.isConfigured()) return;
  if (this._recordCreatorCache.timelineId === this.currentTimelineId) return; // 已有

  try {
    const members = await cloudDBManager.getTimelineMembers(this.currentTimelineId);
    const map = new Map();
    (members || []).forEach(m => {
      if (m.user_id && m.users) map.set(m.user_id, m.users);
    });
    this._recordCreatorCache = { timelineId: this.currentTimelineId, map };
  } catch (e) {
    console.warn('[VEX-Timeline] _ensureCreatorMap failed:', e);
    // 失败时不阻塞 renderTimeline（records 仍会显示，只是没创建者名）
  }
}

/** 切换 timeline / 同步完成后调用，强制下次 renderTimeline 重建 */
_invalidateCreatorMap() {
  this._recordCreatorCache = { timelineId: null, map: new Map() };
}
```

**d)** 在 [src/js/app.js:2976](file:///workspace/src/js/app.js#L2976) 的 `vx-item-time` div 内追加创建者：

```html
<div class="vx-item-time" style="...font-size:10px...">
  ${this._escapeHtml(time)}${creatorHtml}
</div>
```

其中 `creatorHtml` 在 dayRecords.forEach 内（line 2951 附近）算出来：

```js
// 团队时间轴 + 记录有 user_id + 缓存里有该用户 → 显示「· nick（real_name）」
let creatorHtml = '';
const current = this.timelines.find(t => t.id === this.currentTimelineId);
if (current && current.type === 'team' && record.user_id) {
  const user = this._recordCreatorCache.map.get(record.user_id);
  if (user) {
    const name = this.getFullDisplayName(user);
    creatorHtml = `<span class="vx-item-creator"> · ${this._escapeHtml(name)}</span>`;
  }
}
```

**e)** 在两处 invalidate 缓存：

- `bindEvents` 切换 timeline 时（[src/js/app.js:450 附近](file:///workspace/src/js/app.js#L450)） — 切换到新时间轴应重建
- `syncFromCloud` 完成后（[src/js/app.js:728 附近](file:///workspace/src/js/app.js#L728)） — 新成员加入后应重建

```js
this._invalidateCreatorMap();
```

**f)** CSS 加一行让创建者部分与 time 同色 / 弱化（[src/css/styles.css](file:///workspace/src/css/styles.css)，紧跟 `.vx-item-time` 样式）：

```css
.vx-item-creator {
  color: var(--color-fg-muted);  /* 与 time 同色，不抢主标题 */
  font-weight: 500;
}
```

**g)** 月历弹窗 [src/js/app.js:2864-2875](file:///workspace/src/js/app.js#L2864-L2875) 的 `showDayRecords` 也跟着改，保持月历弹窗内时间后也能看到创建者（同一需求覆盖）。逻辑同 (d)。

**h)** 个人时间轴 & 未同步的本地记录：`record.user_id` 不存在或缓存里查不到 → `creatorHtml` 为空 → 行为完全不变（无 · 无名字），**零回归风险**。

### 3.2 修复：暗色模式头像 / 汉堡按钮 hover 泛白

**思路**：把 `hover:bg-gray-200`（Tailwind 硬编码浅灰）替换为 `hover:bg-border`（通过 `src/css/styles.css:991 .hover\:border-primary:hover` 那一批，**实际上** `hover:bg-border` 不在 styles.css 已声明的 utility 里）。所以**最稳妥**是加一条 `.hover\:bg-border:hover` 到 [src/css/styles.css:978-991](file:///workspace/src/css/styles.css#L978-L991) 那段。

**a)** [src/css/styles.css](file:///workspace/src/css/styles.css) 在 `.hover\:bg-canvas:hover` 之后新增一行：

```css
.hover\:bg-border:hover    { background-color: var(--color-border); }
```

**效果验证**（两种主题下都自然）：

| 主题 | bg-muted | hover:bg-border | 视觉效果 |
|---|---|---|---|
| 浅色 | `#F3F4F6` (slate-100) | `#E5E7EB` (gray-200) | 比原来略浅一点（之前是 `#e5e7eb` 直接硬编码）—— **几乎无变化** |
| 暗色 | `#1E293B` (slate-800) | `#334155` (slate-700) | **从 slate-800 微亮到 slate-700**，**不再泛白** |

**b)** [index.html](file:///workspace/index.html) 两处替换：

- Line 875（`#user-menu-btn`）：`hover:bg-gray-200` → `hover:bg-border`
- Line 906（`#mobile-menu-btn`）：`hover:bg-gray-200` → `hover:bg-border`

**c)** [sw.js](file:///workspace/sw.js) line 6：

```js
const CACHE_NAME = 'vex-timeline-cache-v41';
```

注释同步加一行：`// v41: 赛队时间轴显示记录创建者 + 暗色模式头像 hover 修复`

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | "时间轴的创建者" 解读为「每条记录的创建者」（而非 timeline owner） | "便于区分" 暗示区分**不同记录**的来源，team timeline 才有意义；personal timeline 所有人都是自己，冗余 |
| D2 | 仅 team timeline 显示，personal timeline 不变 | personal 没有"区分"需求，且用户没要求 |
| D3 | 复用 `getTimelineMembers` 而非新增 `getUsersByIds` | 该接口已 select 完整 `users` 字段且受 RLS 保护（迁移 003/004），数据齐全；新增接口反而增加维护成本 |
| D4 | 缓存到 `this._recordCreatorCache`，切 timeline / 同步后失效 | 避免每条记录都查云端；缓存粒度 = timeline_id |
| D5 | 离线 / 未同步记录（无 `user_id`）不显示创建者 | 没有数据；同步上线后自动出现。**零回归**：旧行为完全保留 |
| D6 | 月历弹窗 `showDayRecords` 同样显示 | 用户要求"赛队时间轴中"，月历弹窗也是赛队时间轴的一部分；保持一致性 |
| D7 | 创建者文字用 `var(--color-fg-muted)`，与 time 同色 | 不抢标题主色；与现有 mockup 文案（`14:30 · 王潇 · 2 张图`）视觉一致 |
| D8 | 分隔符用 `·`（中点） | 与现有 mockup、i18n hero 文案、app.js 已有用法一致（`·`/`·`） |
| D9 | hover 颜色用 `var(--color-border)` 而非新增 `--color-muted-hover` | 避免新增 token；`--color-border` 在两种主题下都是与 `--color-muted` 视觉相邻的色，hover 微亮微暗都自然 |
| D10 | 不引入新的 i18n key | "· 昵称（真实姓名）" 由 `getFullDisplayName` 自动生成，无新文案 |
| D11 | 不动 schema / 不动 RLS / 不写 migration | 数据层已经支持，仅前端展示 |
| D12 | `getFullDisplayName` 已正确处理 parent / teacher 边界 | 复用即可，不重复实现 |
| D13 | 不修改 CSS 中已有的 `.hover\:bg-muted` 等 utility | 那批是别的按钮用的；本轮只动有 bug 的 2 个 `hover:bg-gray-200` |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (a) `App` 构造 / 类内加 `_recordCreatorCache` 字段；(b) 新增 `_ensureCreatorMap()` + `_invalidateCreatorMap()`；(c) `renderTimeline` 顶部 await `_ensureCreatorMap`；(d) dayRecords.forEach 内根据 `record.user_id` + 缓存生成 `creatorHtml`；(e) `showDayRecords` 同样追加创建者；(f) `bindEvents` 切换 timeline 回调 + `syncFromCloud` 末尾调 `_invalidateCreatorMap()` |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | (a) 新增 `.hover\:bg-border:hover { background-color: var(--color-border); }`；(b) 新增 `.vx-item-creator` 样式 |
| [index.html](file:///workspace/index.html) | 改 | (a) line 875 `#user-menu-btn` class `hover:bg-gray-200` → `hover:bg-border`；(b) line 906 `#mobile-menu-btn` 同样 |
| [sw.js](file:///workspace/sw.js) | 改 | CACHE_NAME `v40` → `v41`，注释同步 |
| [supabase/migrations/](file:///workspace/supabase/migrations/) | **不改** | 数据层已就绪 |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | **不改** | 复用 `getTimelineMembers` |
| [src/js/db.js](file:///workspace/src/js/db.js) | **不改** | IndexedDB 已有 user_id |

## 6. Verification Steps

### 6.1 静态检查（grep / 语法）

```bash
# 1. 确认 hover:bg-gray-200 全部清除
grep -rn "hover:bg-gray-200" /workspace/index.html
# 期望：无输出

# 2. 确认新 utility 已加
grep -n "hover\\\\:bg-border" /workspace/src/css/styles.css
# 期望：1 行

# 3. 确认 creator 渲染 + 缓存方法存在
grep -n "_recordCreatorCache\|_ensureCreatorMap\|_invalidateCreatorMap\|vx-item-creator" /workspace/src/js/app.js /workspace/src/css/styles.css

# 4. JS 语法
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.2 浏览器端核心验证（5 步）

1. **赛队时间轴显示创建者**（team timeline）：
   - 登录后加入 / 创建一个 team timeline
   - 让 A、B 两个账号都添加 1-2 条记录
   - 切换到该 team timeline
   - 每条记录应显示 `17:45 · A的昵称（A真实姓名）`
   - 个人时间轴（personal）记录应**只显示时间**，无后缀

2. **离线场景无回归**：
   - 断网时添加 1 条本地记录（user_id 为空）
   - 显示应**只显示时间**，无后缀
   - 恢复网络后 sync，刷新页面，记录应**自动**显示创建者

3. **切 timeline 缓存重建**：
   - team A timeline 下看到创建者
   - 切到 team B timeline
   - 创建者应变成 B 队成员的对应名字（**不是**残留 A 队的）

4. **暗色模式 hover 不泛白**：
   - 浏览器切到暗色模式（macOS 系统设置 / DevTools Rendering）
   - 鼠标移到顶栏右侧的用户头像按钮
   - 背景应**平滑变深一点点**（slate-800 → slate-700），**不再泛白**
   - 同样验证移动端汉堡按钮（< lg 视口或 DevTools 模拟）

5. **浅色模式无视觉变化**：
   - 切回浅色模式
   - hover 头像
   - 背景仍是从 `#F3F4F6` 微深到 `#E5E7EB`，**与原版基本无差**

### 6.3 边界情况

- 老用户（user_id 在 cloud 已存在，real_name 为空）→ `getFullDisplayName` 自动降级为只显示昵称，无「（）」空括号
- 家长身份记录 → 自动显示 `昵称（孩子名家长）`，与全站一致
- 老师仅填姓 → 自动显示 `昵称（X 老师）`
- team timeline 成员被移除后留下的孤儿记录 → `map.get` 查不到 → 不显示创建者，**无报错**

## 7. Out of Scope

- 不改 Supabase schema / RLS / migration
- 不改 `getFullDisplayName` 现有逻辑
- 不改 `cloudDBManager.getTimelineMembers` 实现
- 不改月历格子内显示（月历格只显示点数 + 重要性色，**不显示**创建者，避免格子过满）
- 不改个人时间轴记录显示
- 不改时间轴头部（day header）显示
- 不加 hover tooltip
- 不加「@」前缀（直接用 nick（real name）文本）
- 不改 mockup hero 文案
- 不动其他 `hover:bg-gray-200` 误用（已 grep 确认仅 2 处）
- 不修任何其他暗色模式遗留问题

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| `getTimelineMembers` 调用失败 → 缓存空 → 记录无创建者 | try/catch + 仅 console.warn，**不阻塞 renderTimeline**；旧行为完全保留 |
| 缓存未失效 → 切 timeline 后还显示旧创建者 | `bindEvents` 切 timeline 回调 + `syncFromCloud` 末尾显式 `_invalidateCreatorMap` |
| 同步队列里的本地记录没 user_id → 显示空白 | 设计上接受：同步上线后自动出现 |
| 月历弹窗也跟着改 → 改动面变大 | 月历弹窗的渲染模板与时间轴几乎一致，复制 5 行代码即可，**风险可控** |
| `hover:bg-border` 浅色下视觉变化与原 `hover:bg-gray-200` 不完全一致 | 两者在浅色下都是 `#E5E7EB`（gray-200 = border 的浅色值），**完全等价**；暗色下从 slate-800 升到 slate-700，自然 |
| Tailwind Play CDN 不认识 `hover:bg-border` | Play CDN 会动态生成 utility，但**为防止 CDN 加载顺序 / 注入失败**，在 styles.css 显式声明一条 `.hover\:bg-border:hover`，**双保险** |
| SW 缓存未更新 → 用户看不到新版本 | Bump v40 → v41，触发 activate 清旧缓存 |
| 大团队成员多 → `getTimelineMembers` 慢 | 单次 ≤1s（select users 已有索引），且已缓存，**不感知** |
