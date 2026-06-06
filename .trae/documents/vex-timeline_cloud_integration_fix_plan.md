# VEX-Timeline 云端对接 + UI 错位修复计划

## 1. Summary

解决用户报告的 4 个核心问题：

1. **lucide 图标全部空白**（CDN 解析路径不稳，导致 `lucide.createIcons()` 失败，所有 `<i data-lucide>` 不渲染）
2. **月历网格严重错位**（外层 grid-cols-7 包了内层 grid-cols-7，cells 被压缩到 1/49 宽度）
3. **数据库对接失败**（`getTimelinesForUser` 用 `id.in.(select ...)` 是 **JS client** 语法，PostgREST 字符串过滤器要求 `id=in.(...)` —— **整条 query 抛错**，导致 `loadTimelines` 返回失败 → 添加按钮被隐藏 → `syncFromCloud` 不跑 → 时间轴/赛队记录全为空）
4. **UI 缺乏错误反馈**（云端失败时无错误条 + 无重试入口）

按用户要求：**不允许本地存储降级**；云端必须可用；如真失败 → 顶部颜色块错误条 + 一键重试。

## 2. Current State Analysis（已通过 Phase 1 探索完成）

### 2.1 lucide 图标问题

**位置**：[index.html:23](file:///workspace/index.html#L23)
```html
<script src="https://unpkg.com/lucide@latest"></script>
```
**根因**：lucide 在 v0.400+ 切换为 ESM-only，`@latest` 默认入口为 ESM，`<script>` 标签加载后**不暴露** `window.lucide.createIcons()`，导致 `i[data-lucide]` 全部留空。截图里云状态、加号、chevron、menu 都呈"空盒"。

### 2.2 月历网格问题

**位置**：[src/js/app.js:984-1011](file:///workspace/src/js/app.js#L984-L1011)
```js
calendar.innerHTML = `<div class="grid grid-cols-7">${headerHTML}</div><div class="grid grid-cols-7">${cellsHTML}</div>`;
```
配合 [index.html:208](file:///workspace/index.html#L208)
```html
<div id="calendar" class="grid grid-cols-7 gap-0 border-2 border-border rounded-lg overflow-hidden"></div>
```
**根因**：外层是 7 列 grid，子元素 2 个内层 grid **每个占 1/7 宽度**，再各自 7 等分 → 日标签 ~1/42 宽、日期 cell ~1/49 宽。截图可见 cells 极度压缩成一窄条。

### 2.3 数据库对接问题（最严重）

**位置**：[src/js/cloud-db.js:23](file:///workspace/src/js/cloud-db.js#L23)
```js
.or(`owner_id.eq.${userId},id.in.(select timeline_id from timeline_members where user_id = ${userId})`)
```
**根因**：PostgREST 字符串过滤器语法为 `field=in.(...)`（用 `=`），不是 `field.in.(...)`（这是 **Supabase JS client `.in()` 方法** 的语法）。当字符串传给 `.or()` 时按 PostgREST 解析，子查询直接 400 报错。

**级联影响**：
1. `getTimelinesForUser` 抛错 → `loadTimelines` `catch` → 返回 `{ success: false }`
2. [src/js/app.js:138-142](file:///workspace/src/js/app.js#L138-L142) → `cloudSyncStatus = 'error'`
3. [src/js/app.js:146](file:///workspace/src/js/app.js#L146) → `_setAddEnabled(false)` → **添加按钮被 `display: none` 隐藏**（这就是截图里完全找不到加号按钮的原因）
4. [src/js/app.js:153](file:///workspace/src/js/app.js#L153) → `if (loadResult.success) await this.syncFromCloud();` → **不跑**
5. 时间轴 dropdown 永远只有 "本地时间轴" 一项
6. 记录全是本地 IndexedDB（用户没有），显示"暂无记录"

### 2.4 缺乏错误反馈

[src/js/app.js:138-147](file:///workspace/src/js/app.js#L138-L147) 只更新了 `cloudSyncStatus` 状态 + 隐藏 add 按钮，**无任何用户可见的错误提示**，用户根本不知道发生了什么。

## 3. Proposed Changes

### 3.1 修复 lucide CDN（[index.html](file:///workspace/index.html)）

```html
<!-- 旧 -->
<script src="https://unpkg.com/lucide@latest"></script>
<!-- 新：固定到 v0.378.0（最后一个稳定 UMD 版本，main = dist/umd/lucide.js） -->
<script src="https://unpkg.com/lucide@0.378.0"></script>
```

并在 lucide 加载完成后，再调用一次 `lucide.createIcons()`（双保险：脚本底部 + 加载完成后都触发）。`load` 事件 + 定时器双轨：
```js
window.addEventListener('DOMContentLoaded', () => {
  const tryIcons = () => {
    if (window.lucide?.createIcons) lucide.createIcons();
    else setTimeout(tryIcons, 50);
  };
  tryIcons();
});
```

### 3.2 修复月历网格（[src/js/app.js](file:///workspace/src/js/app.js#L984-L1011)）

把 calendar 渲染改为扁平 7 列 grid：
```js
// 旧：嵌套 grid
calendar.innerHTML = `<div class="grid grid-cols-7">${headerHTML}</div><div class="grid grid-cols-7">${cellsHTML}</div>`;

// 新：扁平 grid，header 与 cells 都在同一 7 列 grid 中
calendar.innerHTML = headerHTML + cellsHTML;
```
同时 [index.html:208](file:///workspace/index.html#L208) 保持 `grid grid-cols-7`（外层就是 7 列），42 个 cell 自动换行到 6 行。

注意：CSS 里 `vx-calendar-cell` 的 `aspect-ratio: 1` 让日期 cell 自动方形；header 单元格无 `aspect-ratio`，自然短高。**行高不一致是预期效果**（header 矮、日期方）。

### 3.3 重写 `getTimelinesForUser`（[src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js#L11-L30)）

```js
async getTimelinesForUser() {
  const client = this._getClient();
  const userId = authManager.getCurrentUser().id;

  // 1. 拿到本人作为成员的所有 timeline_id
  const { data: memberships, error: mErr } = await client
    .from('timeline_members')
    .select('timeline_id')
    .eq('user_id', userId);
  if (mErr) throw mErr;
  const memberIds = (memberships || []).map(m => m.timeline_id);

  // 2. 一次 .or() 拉所有 owner==me OR id in memberIds
  let query = client.from('timelines').select('*');
  if (memberIds.length > 0) {
    query = query.or(`owner_id.eq.${userId},id.in.(${memberIds.join(',')})`);
  } else {
    query = query.eq('owner_id', userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```
**关键修正**：去掉了 subquery 改用两步查，避开了 PostgREST 字符串过滤器对子查询的支持差异（`.in()` JS 方法用列表才是稳态）。

### 3.4 增加云端错误条 + 重试按钮（[index.html](file:///workspace/index.html) + [src/js/app.js](file:///workspace/src/js/app.js)）

**HTML**：在 [index.html:209](file:///workspace/index.html#L209) calendar 容器之上、`<main>` 之内插入：
```html
<div id="cloud-error-bar" class="hidden mb-6 p-4 bg-red-50 border-2 border-primary rounded-md flex items-center justify-between gap-4">
  <div class="flex items-center gap-3">
    <i data-lucide="alert-triangle" class="w-5 h-5 text-primary shrink-0"></i>
    <div class="flex flex-col">
      <span class="font-semibold text-sm text-red-700">云端连接失败</span>
      <span id="cloud-error-message" class="text-xs font-medium text-red-600/80"></span>
    </div>
  </div>
  <button id="cloud-retry-btn" type="button"
          class="h-10 px-4 bg-primary text-white rounded-md font-semibold tracking-wider uppercase text-xs flex items-center gap-2 hover:bg-primary-hover hover:scale-105 transition-all duration-200 shrink-0">
    <i data-lucide="refresh-cw" class="w-4 h-4"></i>重试
  </button>
</div>
```

**JS**（[src/js/app.js](file:///workspace/src/js/app.js)）：
- 新增方法 `_setCloudError(msg)`：显示错误条 + 写入 message
- 新增方法 `_clearCloudError()`：隐藏错误条
- 修改 `onLoginSuccess`：
  ```js
  async onLoginSuccess() {
    this.hideAuthPage();
    // ... 更新用户信息 ...
    
    const loadResult = await this.loadTimelines();
    if (!loadResult.success) {
      this._setCloudError(loadResult.error || '无法连接到云端');
      this._setAddEnabled(false);  // 仍隐藏按钮，因为云不可用无法保存
    } else {
      this._clearCloudError();
      this._setAddEnabled(true);
      // 等 sync 完成后才渲染，确保 records 已落到 IndexedDB
      try {
        await this.syncFromCloud();
      } catch (e) {
        this._setCloudError('同步云端记录失败: ' + e.message);
      }
    }
    
    this.renderDate();
    await this.renderView();
  }
  ```
- 绑定重试按钮：
  ```js
  document.getElementById('cloud-retry-btn').addEventListener('click', async () => {
    this._clearCloudError();
    this._setCloudError('正在重试…');
    await this.onLoginSuccess();
  });
  ```

### 3.5 移除本地存储降级路径（[src/js/app.js](file:///workspace/src/js/app.js)）

按用户要求"**不允许本地存储**"，做以下硬约束：
- `onGuestMode()`：保留但加上"测试模式仅供离线调试"提示，并在没有 Supabase 配置时调用
- 但生产路径（已登录用户）**不应**进入本地模式
- `_setAddEnabled(false)` 在已登录状态下保持隐藏 add 按钮，但**必须**伴随错误条出现（见 3.4）

### 3.6 修复时序：sync 必须在 renderView 之前

[src/js/app.js:148-154](file:///workspace/src/js/app.js#L148-L154) 当前是先 `renderView()` 再 `syncFromCloud()`，导致首次渲染是空数据。**改为**：
```js
if (loadResult.success) {
  await this.syncFromCloud();  // 等云同步完
}
this.renderDate();
await this.renderView();  // 再渲染
```

### 3.7 添加/编辑/删除也走云端（已有逻辑已对，但需检查）

[src/js/app.js:786-832](file:///workspace/src/js/app.js#L786-L832) `saveRecord` 已有云端 add/update 分支，逻辑正确。**新增**：当云端 add 失败时，**不要 fallback 到 IndexedDB only**（按用户要求），而是 throw 出错信息给用户。

## 4. Assumptions & Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | lucide 固定到 0.378.0（非 `@latest`） | 0.378.0 是最后一个稳定 UMD；0.400+ 全部 ESM，不暴露 `window.lucide` |
| D2 | 月历扁平 7 列 grid | header + cells 全部直接子元素，自动换行 |
| D3 | `getTimelinesForUser` 改为两次查询（先 members，再 owner OR in） | 避开 PostgREST 字符串子查询支持差异，`.in(list)` 是稳态语法 |
| D4 | 云端失败时显示**颜色块错误条 + 一键重试** | 用户明确要求"不要本地降级" |
| D5 | 错误时**仍隐藏** add 按钮 | 用户说"不允许本地存储"，云不可用 = 不能保存 = 不能添加 |
| D6 | sync 在 renderView 之前完成 | 避免首次渲染空数据再闪烁 |
| D7 | 保留 `onGuestMode` 但只用于无 Supabase 配置场景 | 兼容现有的"完全离线"调试路径；不影响生产 |
| D8 | 失败时 throw，不要静默 fallback | 用户要求"测试阶段全部调试好"，错误必须可见 |
| D9 | `cloud-db.js` 之外的代码不重写 | 范围聚焦 bug 修复，不做无意义重构 |

## 5. File Change List

| 文件 | 动作 | 关键改动 |
|---|---|---|
| [index.html](file:///workspace/index.html) | 改 | lucide CDN pin 0.378.0 + 增加 `cloud-error-bar` HTML 块 + 增加 `lucide.createIcons` 双触发脚本 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 改 | 增强 `.vx-calendar-cell` 在父 grid 下的 `aspect-ratio` 行为（如需要，现状已可） |
| [src/js/app.js](file:///workspace/src/js/app.js) | 改 | (a) `renderCalendar` flatten grid；(b) `onLoginSuccess` 调整时序 + 错误条；(c) 新增 `_setCloudError / _clearCloudError`；(d) 绑定重试按钮 |
| [src/js/cloud-db.js](file:///workspace/src/js/cloud-db.js) | 改 | `getTimelinesForUser` 重写为两次查询 |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 不改 | 无 bug |
| [src/js/db.js](file:///workspace/src/js/db.js) | 不改 | 业务逻辑保留 |
| [src/js/supabase.js](file:///workspace/src/js/supabase.js) | 不改 | 业务逻辑保留 |
| [manifest.json](file:///workspace/manifest.json) | 不改 | 上一轮已配 |

## 6. Verification Steps

实施完成后按以下顺序验证：

### 6.1 静态检查
```bash
# 1. lucide CDN 已固定
grep -n "lucide@" /workspace/index.html   # 应输出: lucide@0.378.0

# 2. 月历不再嵌套 grid
grep -nA1 "calendar.innerHTML" /workspace/src/js/app.js   # 应是 headerHTML + cellsHTML

# 3. 查询语法不再含子查询
grep -n "id.in.(select" /workspace/src/js/cloud-db.js   # 应为空

# 4. 错误条 HTML 存在
grep -n "cloud-error-bar" /workspace/index.html   # 应输出位置
```

### 6.2 JS 语法
```bash
node --check src/js/app.js && node --check src/js/cloud-db.js && echo OK
```

### 6.3 本地启动
```bash
cd /workspace && python3 -m http.server 8000
```

### 6.4 浏览器手测（核心 5 步）
1. **打开首页** → Auth 页海报式布局 + 3 个按钮（登录/注册/离线）渲染正常
2. **登录**（dongzi8009 已存在）→ 跳到主应用
3. **顶部菜单**：
   - 加号按钮**可见**（`bg-primary` 蓝色 h-14）
   - 云状态**显示为绿色**（`is-ok`）—— 表示 `getTimelinesForUser` 成功
   - lucide 图标**全部渲染**（cloud / plus / chevron / menu）
4. **时间轴下拉**：展开后**应显示**用户的所有时间轴（不止"本地时间轴"）
5. **月历视图**：
   - 切换到月历 tab → 7 列正常排布（每行 7 个 cell、cell 方形、约 150×150px）
   - 之前创建/有记录的日期显示**角落色块**或浅红底（高 importance）
6. **错误模拟**（可选）：
   - 在 DevTools Network 把 supabase.co 域名 block → 登录后应出现红色错误条
   - 错误条带"重试"按钮，点击后重新触发 `onLoginSuccess`
   - 解除 block 后再点重试 → 错误条消失、add 按钮出现

### 6.5 端到端数据流验证
- 在时间轴 A 创建一条记录（标题、日期、importance=high）
- 刷新页面 → 记录**仍在**（云端持久化）
- 切换到月历 → 该日期显示 has-high 类（浅红底 + 角落色块）
- 切换到不同 timeline → 当前 timeline 的记录**不混入**其他 timeline

### 6.6 性能/视觉
- 时间轴卡片 hover：`hover:scale-[1.02]` 平滑
- 模态框打开：200ms 硬切动画（无 backdrop-blur）
- 移动端 375px：汉堡菜单 → 抽屉正常
- Lighthouse：无 console error、无重复 ID

## 7. Out of Scope

- 不引入新的 npm 依赖
- 不改 Supabase 迁移 SQL
- 不改 Service Worker
- 不改 IndexedDB 表结构
- 不动认证流程（仍 Supabase email/password）
- 不做 i18n、暗色模式
- 不重写 React/Vue 化（项目保持 Vanilla JS）
- 不移除"离线使用"按钮（保留供无 Supabase 配置时使用）

## 8. 风险评估

| 风险 | 缓解 |
|---|---|
| lucide@0.378.0 仍可能在某 CDN 边缘失败 | 加 `load` 事件 + 轮询 `tryIcons()` 双保险 |
| 月历 flatten 后 cell 高度参差 | 接受（日标签行短，日期方形），符合"色块即结构" |
| 重写 `getTimelinesForUser` 后仍可能因 RLS 失败 | 错误条会显示具体 message，用户可截图反馈 |
| 用户已绑定的 session token 过期 | 由 Supabase 自动 refresh；如仍失败显示在错误条 |
