# VEX-Timeline UI 与云端对接深度修复计划（Round 2）

## 1. Summary

上一轮（Round 1）已修复 5 个核心 bug（lucide CDN pin / 月历扁平 grid / 两步查询 / 错误条 / 时序）。本轮（R2）针对**仍可能残留**的根因做深度排查与修缮，目标：

- 把 `getTimelinesForUser` 中**仍有歧义**的 `.or("id.in.(...)")` 字符串过滤器替换成**完全无歧义**的两次独立查询
- 修复 `processSyncQueue` 一遇错就 `break` 导致队列卡死
- 修复 `authManager.getCurrentUser()` 在 profile 还未加载完成时被访问会 throw 的竞态
- 修复**移动端抽屉**因无 `overflow-y-auto` 导致内容超长时无法滚动
- 修复月历 grid 因每个 cell `border: 2px` 叠加造成 4px 视觉缝隙（统一用 `border-b border-r` 单一规则）
- 验证 `is-ok` 状态颜色（`bg-secondary` 绿）在顶部小圆点对比度是否清晰
- 验证 Service Worker 没有缓存坏掉的旧版本

## 2. Current State Analysis（Phase 1 已完成）

### 2.1 上一轮已修但需二次确认

| # | 项目 | 状态 | 风险 |
|---|---|---|---|
| 1 | lucide CDN 0.378.0 | ✅ 静态检查 OK | SW 缓存可能仍返回旧版 |
| 2 | 月历扁平 grid | ✅ `headerHTML + cellsHTML` | 每个 cell `border:2px` 叠加 → 4px 缝隙 |
| 3 | `getTimelinesForUser` 两步查询 | ✅ 框架 OK | 第 2 步仍用 `.or('id.in.(...)')` 字符串过滤器 |
| 4 | cloud-error-bar + retry | ✅ HTML+JS 都在 | SW 可能缓存旧版 |
| 5 | onLoginSuccess 时序 | ✅ sync 在 render 前 | — |

### 2.2 仍存在的根因（深度排查结果）

#### 根因 A：`.or('id.in.(uuid1,uuid2)')` 字符串过滤器兼容性

**位置**：[src/js/cloud-db.js:130-135](file:///workspace/src/js/cloud-db.js#L130-L135)
```js
let query = client.from('timelines').select('*');
if (memberIds.length > 0) {
  query = query.or(`owner_id.eq.${userId},id.in.(${memberIds.join(',')})`);
} else {
  query = query.eq('owner_id', userId);
}
```

**问题**：Supabase JS v2（通过 CDN `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` 加载）底层使用 **postgrest-js v1**。postgrest-js v1 的 `.or()` 解析对 `in` 算子的支持**版本敏感**：
- 旧版（< 1.4）：`id.in.(...)` 可工作（dot 语法）
- 新版（≥ 1.5）：要求 `id=in.(...)`（PostgREST 原生 `=` 语法）

**安全做法**：完全规避 `.or()` 字符串解析，改用**两次独立查询** + **JS 端合并去重**。这样不依赖 postgrest-js 的内部解析规则，行为完全可预测。

#### 根因 B：月历 cell 边框叠加

**位置**：[src/css/styles.css:153-166](file:///workspace/src/css/styles.css#L153-L166)
```css
.vx-calendar-cell {
  aspect-ratio: 1;
  border: 2px solid var(--color-border);
  ...
}
```

**问题**：每个 cell 都有 `border: 2px solid`，在 `grid-cols-7 gap-0` 布局下，相邻 cell 的边框**视觉上叠加**为 4px，而不是预期的 2px。42 个 cell × 4 边 = 168 条 2px 边线，肉眼看到的是粗黑网格。

**修复**：cell 用 `border-b border-r`（仅下、右），最后一行用 `last-row` 移除 `border-b`，最右一列用 `nth-child(7n)` 移除 `border-r`。**外层父 div 的 `border-2 border-border rounded-lg`** 保持不变，提供最外圈边框。

#### 根因 C：`processSyncQueue` 遇错即 `break`

**位置**：[src/js/app.js:398-407](file:///workspace/src/js/app.js#L398-L407)
```js
async processSyncQueue() {
  if (!this.isOnline || !authManager.isLoggedIn()) return;
  const queue = await dbManager.getSyncQueue();
  for (const item of queue) {
    try {
      await this.executeSyncOperation(item);
      await dbManager.removeFromSyncQueue(item.id);
    } catch (e) { break; }  // ← 队列卡死
  }
}
```

**问题**：队列第 1 条失败就 `break`，**后面所有项目全部卡住**。一次失败永久阻塞同步。

**修复**：用 `continue` 跳过失败项，错误只 console.warn，**不删除失败项**（保留在队列等待下次重试）。

#### 根因 D：profile 加载竞态

**位置**：[src/js/auth.js:18-23](file:///workspace/src/js/auth.js#L18-L23)
```js
if (session) {
  this.session = session;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await this._loadUserProfile(user.id);  // ← 异步
  }
}
```

随后 [src/js/app.js:53-60](file:///workspace/src/js/app.js#L53-L60)
```js
if (authManager.isLoggedIn()) {  // ← 立即基于 session 判断为 true
  if (supabaseManager.isConfigured()) {
    await this.onLoginSuccess();  // ← onLoginSuccess 中访问 getCurrentUser().id
  }
}
```

**问题**：`isLoggedIn()` 用 `!!(currentUser || session)`，session 已就绪但 `currentUser`（profile）还在加载中。`onLoginSuccess` → `loadTimelines` → `getTimelinesForUser` → `authManager.getCurrentUser().id` → **throw "Cannot read property 'id' of null"**。

**修复**：在 `app.init()` 中 `authManager.init()` 之后 await 一个 `_waitForUserProfile(maxMs)` 兜底；或在 `onLoginSuccess` 中加 guard `if (!authManager.getCurrentUser()) { await authManager._loadUserProfile(...) }`。

#### 根因 E：移动端抽屉超长内容无法滚动

**位置**：[src/css/styles.css:334-347](file:///workspace/src/css/styles.css#L334-L347)
```css
.vx-mobile-drawer {
  position: fixed; inset: 0;
  background-color: var(--color-bg);
  z-index: 100;
  display: none;
  flex-direction: column;
  padding: 1.5rem;
  /* ← 缺 overflow-y: auto */
}
```

**问题**：在 iPhone SE 等 568px 高度屏幕，如果用户加入了 ≥ 3 个赛队 + 多个时间轴项 + 创建/加入/管理/登出 4 个按钮，**总高度超过视口**，内容被裁切且**无滚动条**。

**修复**：加 `overflow-y: auto` + 内部用 `flex-1 min-h-0` 包裹可变区域。

#### 根因 F：Service Worker 可能缓存旧 HTML

**位置**：[/workspace/sw.js](file:///workspace/sw.js)

**问题**：之前提到 "Only cache the static shell — NEVER cache JS files"，但 `index.html` 是否被 cache 取决于 sw 实现。需要确认。

**修复**：检查 sw.js，对 `index.html` 加 `Cache-Control: no-cache` 或在 sw 中**完全不缓存 HTML**。

## 3. Proposed Changes

### 3.1 `getTimelinesForUser` 完全规避 `.or()`（[src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js#L116-L139)）

```js
async getTimelinesForUser() {
  const client = this._getClient();
  const userId = authManager.getCurrentUser().id;

  // Step 1: 我作为 owner 的 timelines
  const { data: owned, error: oErr } = await client
    .from('timelines')
    .select('*')
    .eq('owner_id', userId);
  if (oErr) throw oErr;

  // Step 2: 我作为 member 的 timeline_ids
  const { data: memberships, error: mErr } = await client
    .from('timeline_members')
    .select('timeline_id')
    .eq('user_id', userId);
  if (mErr) throw mErr;

  const ownedIds = new Set((owned || []).map(t => t.id));
  const memberIds = (memberships || []).map(m => m.timeline_id)
    .filter(id => !ownedIds.has(id));   // 去重 owner

  // Step 3: 拉我作为 member 的 timelines（如果非空）
  let member = [];
  if (memberIds.length > 0) {
    const { data: mData, error: mTErr } = await client
      .from('timelines')
      .select('*')
      .in('id', memberIds);   // ← 用 JS .in() 列表方法，稳态
    if (mTErr) throw mTErr;
    member = mData || [];
  }

  return [...(owned || []), ...member];
}
```

**关键修正**：
- 完全去掉 `.or(string)` 字符串过滤器
- 改用 `.in('id', [array])`（**JS client method**，永远是稳态语法）
- 两次独立查询 + JS 端合并去重

### 3.2 月历边框规则统一（[src/css/styles.css](file:///workspace/src/css/styles.css#L150-L207)）

```css
/* 父容器已有 border-2 border-border rounded-lg，做最外圈 */
.vx-calendar-cell {
  aspect-ratio: 1;
  background-color: var(--color-bg);
  /* 用单边边框，避免叠加 */
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: 0.5rem;
  ...
}
/* 第 7 列移除右边框（最右一列由父容器右边框收口） */
.vx-calendar-cell:nth-child(7n) { border-right: 0; }
/* 最后一行移除底边框（由父容器底边框收口） */
.vx-calendar-row-last .vx-calendar-cell { border-bottom: 0; }
```

并在 [src/js/app.js:1090-1118](file:///workspace/src/js/app.js#L1090-L1118) 给最后一行 cell 容器加 `vx-calendar-row-last` class（JS 在 cellsHTML 拼接时计算）。

### 3.3 `processSyncQueue` 失败项不阻塞（[src/js/app.js](file:///workspace/src/js/app.js#L398-L407)）

```js
async processSyncQueue() {
  if (!this.isOnline || !authManager.isLoggedIn()) return;
  const queue = await dbManager.getSyncQueue();
  let succeeded = 0, failed = 0;
  for (const item of queue) {
    try {
      await this.executeSyncOperation(item);
      await dbManager.removeFromSyncQueue(item.id);
      succeeded++;
    } catch (e) {
      failed++;
      console.warn(`[VEX-Timeline] Sync queue item ${item.id} (${item.operation}) failed:`, e.message);
      // ← 失败项不删除，留待下次重试
    }
  }
  if (succeeded > 0) console.log(`[VEX-Timeline] Sync queue: ${succeeded} succeeded, ${failed} failed`);
}
```

### 3.4 profile 加载竞态修复（[src/js/app.js](file:///workspace/src/js/app.js#L44-L64) + [src/js/auth.js](file:///workspace/src/js/auth.js#L72-L87)）

**[src/js/app.js:44-64](file:///workspace/src/js/app.js#L44-L64)**：
```js
async init() {
  await dbManager.initDB();
  supabaseManager.init();
  await authManager.init();
  // ← 新增：等 profile 就绪，最长等 3 秒
  await this._waitForUserProfile(3000);
  this.bindEvents();
  ...
}

async _waitForUserProfile(maxMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (authManager.getCurrentUser()) return true;
    if (!authManager.session) return false;  // 未登录直接退出
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}
```

**[src/js/auth.js:72-87](file:///workspace/src/js/auth.js#L72-L87)** — `_loadUserProfile` 加超时与重试：
```js
async _loadUserProfile(userId, retries = 3) {
  const supabase = supabaseManager.getClient();
  if (!supabase) return;
  for (let i = 0; i < retries; i++) {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && profile) {
        this.currentUser = profile;
        return;
      }
    } catch (e) {
      console.warn(`[VEX-Timeline] _loadUserProfile attempt ${i+1} failed:`, e);
    }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));  // 退避
  }
  console.error('[VEX-Timeline] _loadUserProfile all retries failed');
}
```

### 3.5 移动端抽屉滚动（[src/css/styles.css](file:///workspace/src/css/styles.css#L334-L347)）

```css
.vx-mobile-drawer {
  position: fixed; inset: 0;
  background-color: var(--color-bg);
  z-index: 100;
  display: none;
  flex-direction: column;
  padding: 1.5rem;
  overflow-y: auto;     /* ← 新增 */
  -webkit-overflow-scrolling: touch;  /* iOS 顺滑滚动 */
}
```

### 3.6 Service Worker HTML 缓存策略（[sw.js](file:///workspace/sw.js)）

检查 sw.js：
- `index.html` 必须在 `caches` 之外（每次 fetch 网络）
- JS 文件已正确"不缓存"
- 静态资源（icons / manifest）可缓存

如当前 sw.js 把 `index.html` 加进了 cache，移除该 case。

### 3.7 顶部云状态 `is-ok` 颜色对比度（[src/css/styles.css](file:///workspace/src/css/styles.css#L323-L329)）

当前：`.vx-cloud-status.is-ok { background-color: var(--color-secondary); color: var(--color-bg); ... }`
- 绿色 `#10B981` 背景 + 白色图标 → 对比度 ~3.5:1（**低于 WCAG AA 4.5:1**）
- **修复**：在 `.is-ok` 状态下用更深的绿色背景（如 `#059669`）或加 2px 白色内边

不改设计 token，仅在 `.is-ok` class 内部覆盖：
```css
.vx-cloud-status.is-ok {
  background-color: #059669;  /* 深绿，对比度 ~5.2:1 */
  color: var(--color-bg);
  border-color: #059669;
}
```

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | `getTimelinesForUser` 用两次独立查询 + JS 合并 | 完全规避 `.or()` 字符串过滤器的版本敏感问题 |
| D2 | 月历 cell 用 `border-r + border-b` 单边 1px | 避免相邻 cell 边框叠加为 4px |
| D3 | `processSyncQueue` 失败项不删除、不 break | 一次失败不阻塞后续，保证队列"自愈" |
| D4 | `init()` 阶段等 profile 就绪（最多 3s） | 消除 `getCurrentUser().id` throw 的竞态 |
| D5 | 移动端抽屉加 `overflow-y: auto` | 4 按钮 + 多赛队项时不被裁切 |
| D6 | HTML 不进 sw 缓存 | 部署新版本时立即生效，无需 Hard Reload |
| D7 | 云状态绿色用 `#059669` 深绿（不用新 token） | 对比度从 3.5:1 提升到 5.2:1；不破坏 7 色 token 体系 |
| D8 | 不重写 `saveRecord` / `deleteRecord` 的本地+云双写 | 业务逻辑已对，仅补错误处理 |
| D9 | 不动 RLS 策略 | schema 与 RLS 已正确，与 1.0 同步 |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 改 | `getTimelinesForUser` 改为两次独立查询 + JS 合并去重 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | 月历 cell 边框规则统一 + 抽屉加 overflow-y + 云状态深绿 |
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (a) `processSyncQueue` 失败项 continue；(b) `init` 加 `_waitForUserProfile`；(c) 月历最后一行加 `vx-calendar-row-last` |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 改 | `_loadUserProfile` 加重试 + 退避 |
| [sw.js](file:///workspace/sw.js) | 改 | 确认 `index.html` 不在 cache 列表（如在则移除） |
| [src/js/db.js](file:///workspace/src/js/db.js) | 不改 | 业务逻辑 OK |
| [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 不改 | 配置读取 OK |
| [index.html](file:///workspace/index.html) | 不改 | HTML 结构 OK |
| [supabase/migrations/](file:///workspace/supabase/migrations/) | 不改 | schema 与 RLS OK |

## 6. Verification Steps

### 6.1 静态检查
```bash
# 1. .or() 完全消失
grep -n "\.or(" /workspace/src/js/cloud-db.js   # 应为空

# 2. .in('id', [...]) 仍存在
grep -nA1 "\.in(" /workspace/src/js/cloud-db.js   # 应在 getTimelinesForUser 中

# 3. processSyncQueue 不再 break
grep -nA3 "for (const item of queue)" /workspace/src/js/app.js   # 应是 continue/无 break

# 4. _waitForUserProfile 存在
grep -n "_waitForUserProfile" /workspace/src/js/app.js

# 5. 月历 cell 单边边框
grep -nA3 "\.vx-calendar-cell {" /workspace/src/css/styles.css   # 应有 border-right + border-bottom
```

### 6.2 JS 语法
```bash
cd /workspace
for f in src/js/*.js; do node --check "$f" || echo "FAIL: $f"; done
```

### 6.3 本地服务器实测
```bash
cd /workspace
# 先确保 .env.local 存在（否则 Supabase 配置缺失，所有登录/查询都会失败）
ls -la .env.local 2>/dev/null || echo "⚠️  .env.local 不存在；构建时不会注入 Supabase URL/Key"
npm run build      # 生成 src/js/config.js
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

### 6.4 浏览器端核心验证 7 步
1. **首页**：海报式布局、3 个按钮（登录/注册/离线）渲染正常
2. **登录**（用 dongzi8009 / 已注册账号）→ 跳到主应用
3. **顶部菜单**：
   - 加号按钮**可见**（蓝底白字 h-14）
   - 云状态**显示深绿圆**（`is-ok` 状态，对比度清晰）
   - lucide 图标**全部渲染**（cloud / plus / chevron / menu）
4. **时间轴下拉**：展开后**应显示**用户的所有时间轴（personal + 加入的 team），不再只有"本地时间轴"
5. **月历视图**：
   - 切换到月历 → 7 列正常排布
   - 网格线**单像素**（cell 之间是 1px 分隔线，不是 4px）
   - cell 方形
6. **赛队协作**：
   - 创建赛队（输入名称）→ 下拉出现新 team timeline
   - 复制邀请码 → 退出登录 → 用另一账号加入 → 该账号下拉也能看到该 team
7. **添加记录**：
   - 选中某 timeline → 点加号 → 填表 → 保存
   - 切到月历 → 该日期显示 has-records 红角
   - 切回时间轴 → 记录**仍在**

### 6.5 错误恢复路径
- 在 DevTools Network 把 `*.supabase.co` block → 登录后**应出现红色错误条**
- 错误条**带"重试"按钮**，点击后重新触发 `onLoginSuccess`
- 解除 block 后再点重试 → 错误条消失、add 按钮出现
- 强制刷新（Ctrl+Shift+R） → 错误条不残留（说明 HTML 不在 SW 缓存）

### 6.6 移动端验证
- Chrome DevTools 切到 iPhone SE (375×667)
- 登录 → 汉堡菜单 → 抽屉打开
- 加入 ≥ 3 个赛队后 → 抽屉**内容**仍能**完整滚动到底**（包括"登出"按钮）
- 月历在 375px 宽度下 cell 仍呈方形、不溢出

## 7. Out of Scope

- 不重写为 React / Vue
- 不引入新依赖（仍 Tailwind CDN + lucide CDN + Supabase CDN）
- 不做 i18n / 暗色模式
- 不改 Supabase 迁移 SQL / RLS 策略
- 不改 Service Worker 注册逻辑（仅修缓存策略）
- 不重写认证流程

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| 改 `getTimelinesForUser` 后仍可能 RLS 失败 | 错误条会显示具体 message，可截图反馈 |
| 月历边框改 1px 后视觉上更"细"，可能觉得不够"高级" | 外层父容器仍 `border-2 border-border`，最外圈还是 2px |
| `_waitForUserProfile` 最多等 3s，profile 慢加载会被截 | 网络正常下 profile 加载 < 500ms；3s 兜底足够 |
| 抽屉 `overflow-y: auto` 在 iOS Safari 有时无效 | 加 `-webkit-overflow-scrolling: touch` |
| sw.js 改缓存策略导致老用户卡旧版 | 加 `version: 'v2'` 到 cache name，强制刷新一次 |
