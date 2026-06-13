# VEX-Timeline · 官网首页 & i18n 修复 Plan（续：剩余 4 阶段）

> **本文是 [homepage-i18n-fixes-and-polish.md](file:///workspace/.trae/documents/homepage-i18n-fixes-and-polish.md) 的执行续篇。**
> 已完成的阶段（不再展开）：**Phase A 登录页头栏隐藏** ✅、**Phase D 单按钮语言切换器** ✅。
> 本计划只覆盖 **Phase B / C / E / F** 的剩余工作。

---

## 1. 总结（Summary）

完成上一轮未交付的 4 个阶段：

- **B. 主应用全面 i18n 化** —— 替换 `app.js` 中 ~66 处硬编码中文 + `index.html` 主应用区 ~30 处硬编码中文
- **C. 首页增加更多图形** —— Hero 加 4 个新装饰 + 新增"装饰艺术带"section + Features 卡片角落装饰
- **E. FAQ 动画 + accordion + 其他分区过渡** —— FAQ 默认展开第一项 + 手风琴（开一关一）+ 平滑过渡
- **F. 验证** —— i18n 单测 + DESIGN.md 合规扫描 + 6 项手动验证

---

## 2. 当前状态分析（Current State）

### 已完成

| 阶段 | 内容 | 位置 | 状态 |
|------|------|------|------|
| A | 登录页头栏用 `<body data-scene="auth/app">` 隐藏 + `auth-back-home` 返回链接 | [styles.css:865-866](file:///workspace/src/css/styles.css) / [app.js:159-161](file:///workspace/src/js/app.js) / [index.html:399-402](file:///workspace/index.html) | ✅ |
| D | 单按钮语言切换器 `#site-lang-toggle`（`min-width:96px` 防抖） | [index.html:142-146](file:///workspace/index.html) / [styles.css:890-920](file:///workspace/src/css/styles.css) / [app.js:656-668](file:///workspace/src/js/app.js) | ✅ |
| B-dict | `i18n.js` 字典已扩展 ~80 个 `app.*` key（zh + en） | [i18n.js:92-241](file:///workspace/src/js/i18n.js) | ✅ |

### 未完成（需在本次执行）

| 阶段 | 内容 | 位置 | 状态 |
|------|------|------|------|
| B-call | 替换 `app.js` 中 **66** 处硬编码中文为 `_i18n(key, fallback)` | [app.js:248-1731](file:///workspace/src/js/app.js) | ⏳ |
| B-html | 在 `index.html` 主应用区（`#user-info` 起 ~L450 之后到 modal 结束）~30 处加 `data-i18n` | [index.html:450-770](file:///workspace/index.html) | ⏳ |
| C-deco | Hero 新增 4 个装饰 + 新 `<section id="home-art-band">` + Features 角落装饰 | [index.html:167-211, 214-258, 262-289](file:///workspace/index.html) | ⏳ |
| E-faq | FAQ `open` 默认 + CSS `max-height` 过渡 + JS accordion + Features/How-to hover | [index.html:300-329](file:///workspace/index.html) / [styles.css:935-952](file:///workspace/src/css/styles.css) / [app.js:611-861](file:///workspace/src/js/app.js) | ⏳ |
| F-verify | i18n 单测、DESIGN.md 扫描、6 项手动验证 | 终端命令 | ⏳ |

### 文件依赖

- [`index.html`](file:///workspace/index.html) — 全部 HTML 结构（首页 164-360 / 登录 366-447 / 主应用 452-618 / modal 624-766 / 抽屉 771-831）
- [`src/css/styles.css`](file:///workspace/src/css/styles.css) — 现有 `.vx-site-header` / `.vx-lang-toggle` / `.vx-faq-item` / `.vx-feature-card`
- [`src/js/app.js`](file:///workspace/src/js/app.js) — 渲染、事件、i18n 调用
- [`src/js/i18n.js`](file:///workspace/src/js/i18n.js) — 字典与 `t()` / `applyI18n()`
- [`src/js/auth.js`](file:///workspace/src/js/auth.js) — 已 i18n 化（不改）
- [`DESIGN.md`](file:///workspace/DESIGN.md) — 设计规范

---

## 3. 变更方案（Proposed Changes）

### 变更 B1：替换 `app.js` 中 66 处硬编码中文

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js)

**策略**：所有面向用户的字符串用 `this._i18n(key, fallback)` 包裹（已存在的辅助方法 [app.js:977-979](file:///workspace/src/js/app.js)）。每个 fallback 与字典 key 严格对应。

**具体替换清单**（按行号分块）：

| 行号 | 原文 | 替换为 | 字典 key |
|------|------|--------|----------|
| L248 | `'无法连接到云端'` | `_i18n('app.cloud.unreachable', '无法连接到云端')` | `app.cloud.unreachable` |
| L262 | `'同步云端记录失败: '` | `_i18n('app.cloud.syncFail', '同步云端记录失败: ')` | `app.cloud.syncFail` |
| L285 | `'登录成功，正在进入应用…'` | `_i18n('home.toast.loginSuccess', '登录成功，正在进入应用…')` | 已存在 |
| L286 | `'立即进入'` | `_i18n('home.toast.enterNow', '立即进入')` | 已存在 |
| L298 | `\|\| '未知错误'` | `\|\| _i18n('app.modal.unknownError', '未知错误')` | `app.modal.unknownError` |
| L319 | `'添加记录' / '云端连接失败，无法添加记录'` | `_i18n('app.fab.add', ...) / _i18n('app.fab.cantAdd', ...)` | `app.fab.add` / `app.fab.cantAdd` |
| L334 | `'Supabase 未配置'` | `_i18n('app.cloud.notConfigured', 'Supabase 未配置')` | `app.cloud.notConfigured` |
| L428, L430 | `'未选择'` | `_i18n('app.timeline.unselected', '未选择')` | `app.timeline.unselected` |
| L454-465 | 云状态标签（`未知/Supabase 未配置/云端错误/离线/同步中/云端已连接`） | 逐个用 `_i18n('app.cloud.*', ...)` 替换 | `app.cloud.unknown` / `app.cloud.notConfigured` / `app.cloud.error` / `app.cloud.offline` / `app.cloud.syncing` / `app.cloud.connected` |
| L489 | `'未登录'` | `_i18n('app.user.unlogged', '未登录')` | `app.user.unlogged` |
| L501-519 | 诊断条 innerHTML 中的 `URL/Key/Session/已设置/未配置/已登录/未登录` 标签 | 拆为 `app.diag.*` key 引用 | `app.diag.urlLabel` / `app.diag.keyLabel` / `app.diag.sessionLabel` / `app.diag.urlSet` 等 |
| L527 | `'云端服务暂不可用…'` | `_i18n('app.cloud.broken', ...)` | `app.cloud.broken` |
| L519 | `'时间轴: '` | `_i18n('app.diag.timeline', ...)` | `app.diag.timeline` |
| L749, L756, L759, L761 | toast 文案 | `app.toast.loginFirst` / `app.cloud.refreshing` / `app.toast.syncing` / `app.cloud.refreshed` / `app.cloud.refreshFailed` |  |
| L805-817 | 移动端 toast 文案（同上） |  |  |
| L853 | `'正在重试…'` | `_i18n('app.toast.retrying', ...)` | `app.toast.retrying` |
| L857 | `'重试失败: '` | `_i18n('app.cloud.retryFailed', ...)` | `app.cloud.retryFailed` |
| L990, L994, L995, L998, L1019, L1023, L1024, L1027 | 登录/注册错误 fallback | 已部分用 `_i18n`，核对补齐 |  |
| L1158 | `alert(e.message \|\| '加入失败')` | `alert(e.message \|\| _i18n('app.team.joinFail', '加入失败'))` | `app.team.joinFail` |
| L1169 | `'请先在时间轴下拉中选择一个赛队'` | `_i18n('app.team.selectTeam', ...)` | `app.team.selectTeam` |
| L1176 | `'<div ...>加载中…</div>'` | 字符串模板拼 `_i18n('app.empty.loading', ...)` | `app.empty.loading` |
| L1183 | `'<div ...>暂无成员</div>'` | 拼 `_i18n('app.team.noMembers', ...)` | `app.team.noMembers` |
| L1194, L1195 | `'未知' / '所有者' / '成员'` | `_i18n('app.user.unknown', ...)` / `app.team.roleOwner` / `app.team.roleMember` |  |
| L1198 | `移除` | `_i18n('app.action.delete', '移除')` | `app.action.delete`（**注**：当前字典 `app.action.delete = '删除'`，与中文一致；用 `app.action.delete` 即可） |
| L1212 | `'已移除成员'` | `_i18n('app.team.memberRemoved', ...)` | `app.team.memberRemoved` |
| L1215 | `'移除失败: '` | `_i18n('app.team.removeFail', ...)` | `app.team.removeFail` |
| L1221 | `'加载失败: '` | `_i18n('app.empty.fail', ...)` | `app.empty.fail` |
| L1222 | `'加载成员失败: '` | `_i18n('app.team.membersFail', ...)` | `app.team.membersFail` |
| L1337, L1353 | `'编辑记录' / '添加记录'` | `_i18n('app.modal.editTitle', ...)` / `app.modal.addTitle` |  |
| L1393, L1394 | `'请输入标题' / '请选择日期'` | `_i18n('app.modal.titleReq', ...)` / `app.modal.dateReq` |  |
| L1449 | `'确定要删除这条记录吗？'` | `_i18n('app.modal.confirmDelete', ...)` |  |
| L1482-1490 | `months[]` / `days[]` / `formatDateDisplay` 中的中文 | 用字典 `app.month.1-12` / `app.day.full.sun-sat` / `app.dateFormat` 模板 |  |
| L1539 | `'请先选择时间轴'` | `_i18n('app.empty.timeline', ...)` |  |
| L1575 | `days` 数组 | `app.day.sun-sat` 字典引用 |  |
| L1658, L1701, L1716 | `'暂无记录' / '加载中…'` | `app.empty.records` / `app.empty.loading` |  |
| L1731 | `{ high:'高', medium:'中', low:'低' }` | 用 `app.importance.*` 字典引用 |  |

**验收**：运行 [verify.js](file:///tmp/verify.js) 期望 i18n 单测全部 PASS；`grep` 扫描 `app.js` 中剩余硬编码中文应 ≤ 12 处（仅 `[VEX-Timeline]` 日志、innerHTML 模板中的英文字符串等不影响 UI 的位置）。

---

### 变更 B2：在 `index.html` 主应用区加 `data-i18n` 标注

**文件**：[`index.html`](file:///workspace/index.html)

**策略**：约 30 处静态文本加 `data-i18n` 属性，确保 `i18n.applyI18n()` 在语言切换时刷新。

**具体清单**（行号 → 元素 → data-i18n key）：

| 行号 | 元素 | data-i18n 值 |
|------|------|--------------|
| L470 | `<span class="hidden sm:inline">时间轴</span>` | `app.view.timeline` |
| L474 | `<span class="hidden sm:inline">月历</span>` | `app.view.month` |
| L483 | `<span id="timeline-select-label">未选择</span>` | `app.timeline.unselected` |
| L495 | `title="点击刷新云端"` | `data-i18n-title="app.timeline.refresh"` |
| L509 | `<div id="user-menu-name">—</div>` | `app.user.account` |
| L512 | `<button data-team-action="create">` 内文字 | `app.team.create` |
| L515 | `<button data-team-action="join">` | `app.team.join` |
| L518 | `<button data-team-action="manage">` | `app.team.manage` |
| L522 | `<button id="logout-btn">` | `app.user.logout` |
| L540 | `aria-label="添加记录"` | `data-i18n-aria-label="app.fab.add"` |
| L557 | 过滤器标签"重要性" | `app.filter.label` |
| L559-562 | 过滤器按钮（全部/高/中/低） | `data-filter="all"→app.filter.all` / `high→app.filter.high` / `medium→app.filter.medium` / `low→app.filter.low` |
| L575 | `<span>云端连接失败</span>` | `app.cloud.error` |
| L581 | 重试按钮 | `app.cloud.retry` |
| L593 | "当前月份" | `app.picker.currentMonth`（**新增字典 key**，见 B3） |
| L628 | `<h2 id="modal-title">添加记录</h2>` | `app.modal.addTitle`（编辑时 JS 改用 `app.modal.editTitle`） |
| L634, L639, L645, L653, L658, L663 | modal 标签（日期/时间/重要性/标题/内容/图片） | `app.modal.date` / `time` / `importance` / `title` / `content` / `image` |
| L647-649 | 重要性按钮（高/中/低） | `data-importance="high"→app.importance.high` 等 |
| L654 | `placeholder="请输入标题"` | `data-i18n-placeholder="app.modal.titlePh"` |
| L659 | `placeholder="请输入内容"` | `data-i18n-placeholder="app.modal.contentPh"` |
| L667 | `alt="预览"` | `data-i18n-aria-label="app.modal.preview"`（**新增**） |
| L678, L682 | 取消/保存按钮 | `app.modal.cancel` / `app.modal.save` |
| L692 | `<h2>创建赛队时间轴</h2>` | `app.team.createTitle` |
| L697 | 标签"时间轴名称" | `app.team.nameLabel` |
| L698 | `placeholder="输入赛队时间轴名称"` | `data-i18n-placeholder="app.team.namePh"` |
| L704, L707 | 取消/创建按钮 | `app.modal.cancel` / `app.team.create` |
| L717 | `<h2>邀请成员</h2>` | `app.team.manageTitle`（**复用**，或新增 `app.team.inviteTitle`） |
| L722, L732 | 标签（邀请码/成员列表） | `app.team.inviteCode` / `app.team.members` |
| L738 | 关闭按钮 | `app.modal.cancel`（**复用**） |
| L747 | `<h2>加入赛队时间轴</h2>` | `app.team.joinTitle` |
| L752 | 标签"邀请码" | `app.team.inviteCode`（**复用**） |
| L753 | `placeholder="输入 6 位邀请码"` | `data-i18n-placeholder="app.team.invitePh"`（**新增**） |
| L759, L762 | 取消/加入按钮 | `app.modal.cancel` / `app.team.join` |
| L788-829 | 移动抽屉（快捷操作/添加记录/刷新云端/时间轴/赛队/创建/加入/管理/登出） | 复用字典：`app.modal.addTitle` / `app.cloud.refreshing` / `app.timeline.all` / `app.team.*` / `app.user.logout` |

**验收**：`grep -c 'data-i18n' index.html` ≥ 60（首页 43 + 登录 13 + 主应用 ≥ 30 - 重叠）。

---

### 变更 B3：补齐缺失的字典 key

**文件**：[`src/js/i18n.js`](file:///workspace/src/js/i18n.js)

**新增**（zh-CN + en 各一份）：
- `app.modal.preview` → "预览" / "Preview"
- `app.picker.currentMonth` → "当前月份" / "Current month"
- `app.team.invitePh` → "输入 6 位邀请码" / "Enter 6-digit invite code"
- `app.team.inviteTitle` → "邀请成员" / "Invite members"

**验收**：在 `i18n.js` 末尾 `zh-CN` 与 `en` 块中各加 4 行。

---

### 变更 C：首页增加更多图形

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**策略**：仍严守 DESIGN.md（0 shadow / 0 gradient / 0 backdrop-blur），全部用纯色块 + `clip-path` + 旋转矩形。

**具体改动**：

**C1. Hero 加 4 个新装饰**（追加到 [index.html:168-173](file:///workspace/index.html) 现有 5 个之后）：
```html
<div class="absolute top-20 right-1/3 h-16 w-16 rotate-45 bg-secondary/20 pointer-events-none"></div>
<div class="absolute top-1/2 left-10 hidden lg:block h-24 w-24 rounded-md bg-canvas/10 pointer-events-none"></div>
<div class="hidden md:block absolute bottom-20 right-1/3 h-2 w-40 bg-accent/40 pointer-events-none"></div>
<div class="absolute top-1/4 left-1/4 h-6 w-6 rounded-full bg-canvas/20 pointer-events-none"></div>
```

**C2. 新增装饰艺术带 `<section id="home-art-band">`**（在 [index.html:211](file:///workspace/index.html) 之后，`#home-features` 之前）：
- `min-h-[60vh]`（**注**：原 plan 写 100vh 过长，下调 60vh）
- 内含 4 个绝对定位色块：左中大圆（`bg-primary/10`）+ 右上旋转方块（`bg-accent/15`）+ 右中三角（`bg-secondary/15`，`clip-path: polygon(50% 0%, 0% 100%, 100% 100%)`）+ 底部细条
- 容器 `relative overflow-hidden bg-canvas`
- 装饰艺术带内**不放文字**，纯视觉呼吸

**C3. Features 卡片加角落装饰**（[index.html:224-258](file:///workspace/index.html) 4 张卡片各自加）：
```html
<div class="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-canvas border-2 border-border"></div>
```
（每张卡片加 1 个，不喧宾夺主）

**C4. How-to 区加 3 个右上角色块**（[index.html:262-289](file:///workspace/index.html)）：
```html
<div class="absolute top-10 right-1/4 h-12 w-12 rotate-12 bg-secondary/15 pointer-events-none"></div>
<div class="absolute bottom-20 right-1/3 h-8 w-8 rounded-full bg-accent/30 pointer-events-none"></div>
<div class="absolute top-1/3 left-1/4 h-1 w-20 bg-primary/30 pointer-events-none"></div>
```

**验收**：截图浅色首页，Hero 装饰数从 5 增加到 9；新增装饰艺术带可见但不抢戏；Features 卡片右上角有 10px 装饰圆。

---

### 变更 E：FAQ 动画 + accordion + 其他分区过渡

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css) + [`src/js/app.js`](file:///workspace/src/js/app.js)

**E1. 第一个 FAQ 默认 `open`**：在 [index.html:301](file:///workspace/index.html) 第一个 `<details class="group vx-faq-item">` 加 `open` 属性。

**E2. CSS `max-height` 过渡**（追加到 [styles.css:935-952](file:///workspace/src/css/styles.css) `.vx-faq-item` 块之后）：
```css
/* 答案容器：默认折叠；展开时过渡到 500px */
.vx-faq-item > .vx-faq-answer {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  transition: max-height 0.4s ease, opacity 0.3s ease, padding 0.3s ease;
}
.vx-faq-item[open] > .vx-faq-answer {
  max-height: 500px;
  opacity: 1;
  padding-top: 0;
  padding-bottom: 1.25rem;  /* 与原 pb-5 对应 */
}
```

**注意**：现有 FAQ 答案用 `<div class="px-5 sm:px-6 pb-5 ...">`。需要把外层 `<div>` 加 `vx-faq-answer` 类（仅 padding 调整即可，不改语义）。

**E3. Features / How-to / CTA hover 增强**（追加到 `.vx-feature-card` 后 [styles.css:933](file:///workspace/src/css/styles.css)）：
```css
.vx-feature-card { transition: transform 0.25s, background-color 0.25s; }
.vx-feature-card:hover { transform: scale(1.03); }

/* How-to 步骤卡 hover 上移 */
#home-howto li { transition: transform 0.2s, background-color 0.2s; }
#home-howto li:hover { transform: translateY(-4px); background-color: rgba(255,255,255,0.08); }

/* FAQ summary 加更顺滑的 transition */
.vx-faq-summary { transition: background-color 0.25s, padding 0.2s; }
```

**E4. JS accordion 行为**（在 [app.js:611-861](file:///workspace/src/js/app.js) `bindEvents()` 末尾追加）：
```js
// FAQ 手风琴：打开一项时关闭其他
const faqItems = document.querySelectorAll('.vx-faq-item');
faqItems.forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) {
      faqItems.forEach(other => {
        if (other !== item && other.open) other.open = false;
      });
    }
  });
});
```

**验收**：
- 首次加载：FAQ 第 1 项展开（**不要**瞬间闪烁 → 视觉上需平滑）
- 点击第 2 项：第 1 项平滑关闭，第 2 项平滑展开
- FAQ 容器整体高度变化仅在内容区内，**不会**引起其他 section 跳动

---

### 变更 F：验证

**F1. i18n 单测**：复用 `node /tmp/verify.js`（无则新建），覆盖：
- 14 个场景：默认中文 / 切换英文 / `setLanguage` 持久化 / `t()` 兜底（zh→en→key）/ placeholder 替换 `{name}` / applyI18n 节点扫描 / `data-i18n-placeholder` / `data-i18n-title` / `data-i18n-aria-label` / 错误 key 不抛 / 关闭再开浏览器保持语言 / body `data-scene` 切换 / 早期 lang 检测

**F2. DESIGN.md 合规扫描**：
```bash
curl -s http://localhost:8080/ | grep -cE 'shadow-|backdrop-blur-|bg-gradient-'
# 期望 = 0（FAB 的 `shadow-[0_8px_24px_rgba(0,0,0,0.18)]` 是历史残留，**仍需在本次清理**）
```

**F3. 手动验证 6 项**：

| # | 场景 | 期望 |
|---|------|------|
| 1 | 访问 `/` 未登录 | 首页（Hero 多装饰） |
| 2 | 首页 → 登录页 | 顶部无 site-header，auth-back-home 链接可见 |
| 3 | 登录成功 → 主应用 | 顶栏隐藏 |
| 4 | 主应用切英文 | 所有静态文本 + 动态模态框 + FAB 提示立即变；**语言按钮位置不变** |
| 5 | FAQ 首次加载 | 第 1 项默认展开（**视觉无跳变**） |
| 6 | FAQ 点第 2 项 | 第 1 项平滑关闭，第 2 项平滑展开；其他分区位置不变 |

---

## 4. 决策与假设（Assumptions & Decisions）

1. **i18n fallback 保留**：所有 `_i18n(key, fallback)` 调用中保留 fallback 字符串。即使字典缺失或浏览器禁用 JS，UI 仍可工作。
2. **字典已足够**：现有 `i18n.js` 字典覆盖 99% 所需 key；本轮仅新增 4 个 key（B3）。
3. **装饰艺术带 60vh 而非 100vh**：避免首页过长。视觉上仍是 1 屏可消化的"呼吸区"。
4. **FAQ max-height: 500px 够用**：现有答案最长 2-3 行（约 80px 文字 + padding），500px 富余 6 倍。
5. **FAB shadow 清理**：将 [index.html:538](file:///workspace/index.html) `shadow-[0_8px_24px_rgba(0,0,0,0.18)]` 改为 `border-2 border-border` 圆环。
6. **不引入新依赖**：所有变更用现有 CSS + 原生 JS。

---

## 5. 实施步骤（Implementation Steps）

按依赖顺序，可并行的标 ⓟ：

### 阶段 B：主应用 i18n 化 ⓟ（可与 C、E 并行）
- **B1**：在 [i18n.js](file:///workspace/src/js/i18n.js) 末尾 zh-CN + en 块各加 4 个新 key（`app.modal.preview` / `app.picker.currentMonth` / `app.team.invitePh` / `app.team.inviteTitle`）→ 影响变更 B3
- **B2**：在 [index.html](file:///workspace/index.html) L450-770 主应用区逐个加 `data-i18n` / `data-i18n-placeholder` / `data-i18n-title` / `data-i18n-aria-label`（约 30 处）→ 影响变更 B2
- **B3**：在 [app.js](file:///workspace/src/js/app.js) 用 `this._i18n(key, fallback)` 替换 66 处硬编码中文（保持日志字符串、innerHTML 模板中的英文字符不变）→ 影响变更 B1
- **B4**：在 [app.js:611-861](file:///workspace/src/js/app.js) `bindEvents()` 末尾的"语言切换：单按钮"块后追加 `_refreshAppOnLangChange()` 调用；确保 `renderDate` / `renderView` / `renderFilterChips` / `updateCloudStatusIcon` / `renderDiagnosticBar` 在场景为 `app` 时被调用（已存在 [app.js:182-196](file:///workspace/src/js/app.js)，核对补全）

### 阶段 C：首页美化 ⓟ
- **C1**：在 [index.html:168-173](file:///workspace/index.html) Hero 装饰块末尾追加 4 个新装饰 → 影响变更 C1
- **C2**：在 `#home-hero` 与 `#home-features` 之间新增 `<section id="home-art-band">` 装饰艺术带 → 影响变更 C2
- **C3**：在 [index.html:224-258](file:///workspace/index.html) 4 张 Features 卡片内各加 1 个角落装饰圆 → 影响变更 C3
- **C4**：在 [index.html:262-289](file:///workspace/index.html) `#home-howto` 装饰块末尾追加 3 个新色块 → 影响变更 C4
- **C5**：在 [styles.css](file:///workspace/src/css/styles.css) 加 `.vx-triangle` 类（`clip-path: polygon(50% 0%, 0% 100%, 100% 100%)`）给 C2 的三角用

### 阶段 E：FAQ 动画 + accordion ⓟ
- **E1**：在 [index.html:301](file:///workspace/index.html) 第一个 FAQ `<details>` 加 `open` 属性 → 影响变更 E1
- **E2**：把 [index.html:306, 313, 320, 327](file:///workspace/index.html) 4 个答案 `<div class="px-5 sm:px-6 pb-5 ...">` 的 `pb-5` 移除（统一由 CSS 控制 padding），并加 `vx-faq-answer` 类 → 影响变更 E2
- **E3**：在 [styles.css:935-952](file:///workspace/src/css/styles.css) `.vx-faq-item` 块之后追加 `.vx-faq-item > .vx-faq-answer` 过渡规则与 `.vx-faq-item[open]` 规则 → 影响变更 E2
- **E4**：在 [styles.css:933](file:///workspace/src/css/styles.css) `.vx-feature-card` 之后追加 `.vx-feature-card` / `#home-howto li` / `.vx-faq-summary` 的 transition 增强 → 影响变更 E3
- **E5**：在 [app.js:611-861](file:///workspace/src/js/app.js) `bindEvents()` 末尾追加 FAQ `toggle` 监听实现手风琴 → 影响变更 E4
- **E6**：在 [index.html:538](file:///workspace/index.html) FAB 清理 `shadow-[0_8px_24px_rgba(0,0,0,0.18)]` 改为 `border-2 border-border`（DESIGN.md 合规）→ 验证用

### 阶段 F：验证
- **F1**：编写 / 复用 `node /tmp/verify.js`，跑 14+ i18n 单测
- **F2**：在本地 8080 起 `python3 -m http.server 8080`，扫描 DESIGN.md 合规
- **F3**：跑 `grep -cE "['\"][^'\"]{2,40}[\u4e00-\u9fff][^'\"]{0,40}['\"]" src/js/app.js` 确认 `app.js` 中 UI 中文字符串 ≤ 12 处
- **F4**：手动走 6 项验证

---

## 6. 验证步骤（Verification）

### 自动验证

```bash
# 1. 语法检查
node -c /workspace/src/js/i18n.js
node -c /workspace/src/js/app.js

# 2. i18n 单测（需本地起 8080）
node /tmp/verify.js
# 期望 14+ PASS

# 3. DESIGN.md 合规
curl -s http://localhost:8080/ | grep -cE 'shadow-|backdrop-blur-|bg-gradient-'
# 期望 = 0

# 4. data-i18n 节点数
curl -s http://localhost:8080/ | grep -c 'data-i18n'
# 期望 ≥ 60

# 5. app.js 中 UI 中文字符串残留
grep -nE "['\"][^'\"]{2,40}[\u4e00-\u9fff][^'\"]{0,40}['\"]" /workspace/src/js/app.js | wc -l
# 期望 ≤ 12（仅日志、innerHTML 英文字符串）
```

### 手动验证

| # | 场景 | 期望 |
|---|------|------|
| 1 | 访问 `/` 未登录 | 首页显示 |
| 2 | 首页 Hero 视觉 | 9 个装饰可见，几何感强 |
| 3 | Hero 与 Features 之间 | 装饰艺术带可见（多色块、几何感） |
| 4 | Features 卡片 hover | 缩放至 1.03，**有过渡** |
| 5 | How-to 步骤 hover | 向上移动 4px |
| 6 | 首页 → 登录页 | 顶栏无 site-header，auth-back-home 链接可见 |
| 7 | 登录成功 → 主应用 | 顶栏隐藏 |
| 8 | 主应用切英文 | 所有静态 + 动态文本变英文；**语言按钮位置不变**（`min-width: 96px` 生效） |
| 9 | 主应用开"创建赛队"模态框 → 切英文 | 模态框标题、按钮、placeholder 立即变 |
| 10 | FAQ 首次加载 | 第 1 项默认展开（**视觉无跳变**） |
| 11 | FAQ 点第 2 项 | 第 1 项平滑关闭，第 2 项平滑展开 |
| 12 | 刷新浏览器 | 语言保持 |
| 13 | 切深色模式 | 所有装饰、卡片、模态框色块自动适配，无大块刺眼亮色 |

### DESIGN.md 强制项
- [x] 0 `shadow-*`（含 FAB）
- [x] 0 `backdrop-blur-*`
- [x] 0 `bg-gradient-*`
- [x] 字体仅 Outfit
- [x] 颜色仅来自 7 个 token
- [x] 圆角 `rounded-md` / `rounded-lg` / `pill`（仅 tag）

---

## 7. 风险与缓解（Risks & Mitigation）

| 风险 | 影响 | 缓解 |
|------|------|------|
| FAQ max-height 500px 不够 | 长答案被截断 | 改用 JS 动态测量 `scrollHeight`（不在本轮） |
| `data-i18n` 漏标注某处 | 部分 UI 仍为中文 | F3 跑 grep 扫描 |
| 装饰艺术带过长 | 用户嫌首页太长 | 设为 `min-h-[60vh]` 而非 100vh（C2 决定） |
| 语言按钮 `min-width: 96px` 不够 | 切换时仍轻微抖动 | 视觉评审后微调（D1 已设为 96px） |
| 替换 66 处中文时漏改 | UI 部分中文残留 | 跑 `grep` 确认 ≤ 12（仅日志） |
| JS 渲染的 modal 内容（如 toast）未在切语言时刷新 | 切语言时旧 toast 仍中文 | `_refreshAppOnLangChange` 触发 `renderDiagnosticBar` 等（已存在），核对 `showToast` 的 next call 用新字典 |
| `data-team-action` 委托到 document，但 i18n 后按钮文字变了点击可能失败 | 无影响（事件委托只看 `data-team-action` 属性） | 无需额外处理 |

---

## 8. 涉及文件清单（Affected Files）

| 文件 | 变更类型 | 主要变更 |
|------|----------|----------|
| [index.html](file:///workspace/index.html) | 修改 | 主应用区 30 处 `data-i18n` 标注 + 4 个 Hero 新装饰 + 装饰艺术带 + Features 角落装饰 + How-to 新色块 + FAQ `open` 属性 + 答案类名 + FAB 清理阴影 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 修改 | `.vx-faq-answer` 过渡 + `.vx-feature-card` hover 增强 + `#home-howto li` hover + `.vx-triangle` clip-path |
| [src/js/i18n.js](file:///workspace/src/js/i18n.js) | 修改 | 新增 4 个 key（`app.modal.preview` / `app.picker.currentMonth` / `app.team.invitePh` / `app.team.inviteTitle`） |
| [src/js/app.js](file:///workspace/src/js/app.js) | 修改 | 66 处硬编码中文 → `_i18n`；FAQ `toggle` 手风琴监听；FAB 文案 i18n |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 不变 | 已 i18n 化 |

---

## 9. 不在本轮范围（Out of Scope）

- 服务端 i18n（Supabase 数据本身是中文，不做翻译）
- 时间轴 / 月历数据中的历史记录（用户的标题/内容）i18n — 不可翻译
- 暗色模式下的额外颜色调整 — 现有 CSS 变量已自动处理
- 主题色切换 — 用户未要求
- 移动端导航抽屉的 i18n（已包含在 B2 L788-829，与 B 主任务同一改动）
- FAQ 答案 `max-height` 动态测量（按最长 80px 估算，500px 足够）

---

## 10. 验收清单（Definition of Done）

- [ ] 阶段 A、D 的现有成果未被破坏
- [ ] 阶段 B：app.js 中 UI 中文字符串 ≤ 12 处
- [ ] 阶段 B：index.html 主应用区 data-i18n 节点 ≥ 30
- [ ] 阶段 B：i18n 字典新增 4 个 key（zh + en）
- [ ] 阶段 C：Hero 装饰数 5 → 9；新增装饰艺术带可见
- [ ] 阶段 C：Features 卡片右上角有装饰
- [ ] 阶段 C：How-to 步骤 hover 上移
- [ ] 阶段 E：FAQ 第 1 项默认 open
- [ ] 阶段 E：FAQ `max-height` 过渡平滑（无 snap）
- [ ] 阶段 E：FAQ accordion 行为正确（开一关一）
- [ ] 阶段 F：i18n 单测 14+ PASS
- [ ] 阶段 F：DESIGN.md 0 shadow / 0 blur / 0 gradient
- [ ] 阶段 F：手动验证 13 项全通过
