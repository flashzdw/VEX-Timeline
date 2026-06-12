# 官网首页 & i18n 修复 / 增强 Plan

## 1. 总结（Summary）
针对当前实现反馈的 6 个问题，逐项修复并增强：

1. **登录页头栏未隐藏** — `#site-header` 在 `#auth-page` 显示时仍可见，且锚点导航泄露。彻底隐藏。
2. **主应用未做 i18n** — 时间轴 / 月历 / 模态框 / 用户菜单 / FAB / 错误提示大量硬编码中文。补齐 i18n 字典 + `data-i18n` 标注。
3. **首页图形不够多彩** — Hero 仅 5 个单色装饰；增加 6-8 个新装饰（多色 / 多种形态 / 一处 SVG 几何图案 / 一处 4 色色块墙）。
4. **语言切换按钮变成单按钮** — 替换"两个 chip"为单一按钮：地球图标 + 当前语言，单击切换；固定宽度（min-width 88px）防止位置变化。
5. **FAQ 等分区加过渡动画** — FAQ 平滑展开/折叠（height + opacity transition），其他分区（Features / How-to / CTA）加 hover 与入场动画。
6. **FAQ 改为手风琴（accordion）+ 默认展开第一项** — 打开一项时关闭其他；用 `details[open]` 配合 CSS transition 实现平滑过渡；相对位置不变（使用 max-height 方案）。

---

## 2. 当前状态分析（Current State）

### 已发现的具体问题

| # | 问题 | 位置 | 现状 |
|---|------|------|------|
| 1 | `#auth-page` 是 `fixed inset-0`，无 z-index；`#site-header` z-index 50 sticky 在顶部，把整个 auth 页都压在底下 | [index.html:126, 369](file:///workspace/index.html) | 顶栏 5 个元素（logo / 锚点 / 语言 / 开始使用 / 返回）都显示在 auth 页之上 |
| 2 | `app.js` 内 51 处硬编码中文（`'['一-鿿]'` 匹配） | [app.js L251-1728](file:///workspace/src/js/app.js) | 包括云错误、toast、模态框、FAB、user-menu、filter、calendar、team-modal |
| 3 | Hero 区装饰数量：5 个（1 大圆 + 1 旋转方块 + 1 次方块 + 1 小方块 + 1 细条） | [index.html:170-176](file:///workspace/index.html) | 颜色单一（白/琥珀/绿/次蓝），缺节奏感 |
| 4 | 语言切换器是两个 chip（`#site-lang-switch > .vx-lang-chip` × 2） | [index.html:142-149](file:///workspace/index.html) | 中/英 chip 宽度不同，切换时会换行或改变位置 |
| 5 | FAQ 用 `<details>` 展开，**无 transition**，直接 snap | [index.html:296-330](file:///workspace/index.html) | CSS 仅设置 `border-2`，无 max-height / opacity 过渡 |
| 6 | FAQ 当前 4 项可同时展开，**不是手风琴**；第一项也非默认展开 | [index.html:296-330](file:///workspace/index.html) | `<details>` 默认不带 accordion 行为 |

### 文件依赖
- [`index.html`](file:///workspace/index.html) — 所有 HTML 结构
- [`src/css/styles.css`](file:///workspace/src/css/styles.css) — 已加 `.vx-site-header` / `.vx-lang-switch` 等样式
- [`src/js/app.js`](file:///workspace/src/js/app.js) — 页面切换 / 渲染 / 事件
- [`src/js/i18n.js`](file:///workspace/src/js/i18n.js) — i18n 框架（已实现）
- [`src/js/auth.js`](file:///workspace/src/js/auth.js) — 登录/注册错误文案
- [`DESIGN.md`](file:///workspace/DESIGN.md) — 设计规范（无阴影 / 无渐变 / 字体 / 颜色 token）

---

## 3. 变更方案（Proposed Changes）

### 变更 1：登录页隐藏顶栏（修复 #1）

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**策略**：
- 移除 `app.js` 中 `_syncSiteHeader('auth')` 调用（简化逻辑）。
- 改用纯 CSS：当 `#auth-page` 显示时（用 `.open` / `data-scene="auth"` 类控制），让 `#site-header` 隐藏。
- 在 `#auth-page` 内部右上角加一个**内嵌的"← 返回首页"链接**（仅在 ≥ md 显示），保证用户从登录页能回到首页。
- 移动端（< md）继续用现有 `<lg:hidden>` 的内部 logo（已存在）。

**具体改动**：
1. 删除 `app.js` 中 `goToAuth()` 内对 `_syncSiteHeader('auth')` 的调用，改为只切换页面显示。
2. CSS：给 `#site-header` 增加 `[data-scene="auth"]` / `[data-scene="app"]` 隐藏规则。
3. 在 `#auth-page` 右侧表单顶部加一个 `<a id="auth-back-home" class="...">← 返回首页</a>`，绑定 `showHomePage()` 事件。
4. 给 `<html>` 或 `<body>` 加 `data-scene` 属性管理整体场景（`home` / `auth` / `app`）。

**验收**：
- 截图：从首页 CTA 跳到登录页 → 顶部无 site-header；右上角有"返回首页"链接。
- 主应用内 site-header 仍隐藏（`data-scene="app"`）。

---

### 变更 2：主应用全面 i18n 化（修复 #2）

**文件**：[`index.html`](file:///workspace/index.html) + [`src/js/i18n.js`](file:///workspace/src/js/i18n.js) + [`src/js/app.js`](file:///workspace/src/js/app.js)

**策略**：
- 在 `i18n.js` 字典中**新增**约 80-100 个 key，覆盖主应用所有面向用户的 UI 文案。
- 静态 HTML 部分用 `data-i18n` / `data-i18n-placeholder` / `data-i18n-title` / `data-i18n-aria-label` 标注。
- 动态 JS 渲染部分（toast、错误消息、modal title、calendar、timeline）改用 `i18n.t('key')`，并保留 fallback 字符串。
- 提供 `i18n.applyI18n()` 在切换语言时刷新所有动态内容（重新渲染当前视图）。

**具体 key 列表**（节选，详见实施步骤）：

```
app.view.timeline      时间轴 / Timeline
app.view.month         月历 / Month
app.timeline.unselected 未选择 / Unselected
app.filter.label       重要性 / Importance
app.filter.all         全部 / All
app.filter.high        高 / High
app.filter.medium      中 / Medium
app.filter.low         低 / Low
app.fab.add            添加记录 / Add record
app.fab.cantAdd        云端连接失败，无法添加记录 / Cloud unavailable, can't add
app.cloud.retry        重试 / Retry
app.cloud.failed       云端连接失败 / Cloud connection failed
app.cloud.refreshing   正在从云端刷新… / Refreshing from cloud…
app.cloud.refreshed    云端数据已同步 / Cloud data synced
app.cloud.refreshFailed 刷新失败: / Refresh failed:
app.toast.loginFirst   请先登录并选择时间轴 / Sign in and pick a timeline first
app.toast.syncing      正在同步中，请稍候 / Syncing, please wait
app.toast.retrying     正在重试… / Retrying…
app.modal.addTitle     添加记录 / Add record
app.modal.editTitle    编辑记录 / Edit record
app.modal.date         日期 / Date
app.modal.time         时间 / Time
app.modal.importance   重要性 / Importance
app.modal.title        标题 / Title
app.modal.titlePh      请输入标题 / Enter title
app.modal.content      内容 / Content
app.modal.contentPh    请输入内容 / Enter content
app.modal.image        图片 / Image
app.modal.cancel       取消 / Cancel
app.modal.save         保存 / Save
app.modal.titleReq     请输入标题 / Title is required
app.modal.dateReq      请选择日期 / Date is required
app.modal.confirmDelete 确定要删除这条记录吗？ / Delete this record?
app.team.createTitle   创建赛队时间轴 / Create team timeline
app.team.joinTitle     加入赛队 / Join team
app.team.manageTitle   管理赛队 / Manage team
app.team.nameLabel     时间轴名称 / Timeline name
app.team.namePh        输入赛队时间轴名称 / Enter team timeline name
app.team.inviteCode    邀请码 / Invite code
app.team.members       成员列表 / Members
app.team.roleOwner     所有者 / Owner
app.team.roleMember    成员 / Member
app.team.noMembers     暂无成员 / No members yet
app.team.membersFail   加载失败: / Load failed:
app.team.memberRemoved 已移除成员 / Member removed
app.team.removeFail    移除失败: / Remove failed:
app.team.selectTeam    请先在时间轴下拉中选择一个赛队 / Pick a team from the dropdown
app.team.create        创建赛队 / Create team
app.team.join          加入赛队 / Join team
app.team.manage        管理赛队 / Manage team
app.user.logout        登出 / Sign out
app.user.unlogged      未登录 / Not signed in
app.user.unknown       未知 / Unknown
app.day.sun..sat       日..六 / Sun..Sat
app.day.full.sun..sat  周日..周六 / Sunday..Saturday
app.importance.high    高 / High
app.importance.medium  中 / Medium
app.importance.low     低 / Low
app.empty.timeline     暂无记录 / No records yet
app.empty.calendar     请先选择时间轴 / Pick a timeline first
app.empty.records      暂无记录 / No records
app.error.unknown      未知错误 / Unknown error
app.cloud.offline      离线 / Offline
app.cloud.connected    云端已连接 / Cloud connected
app.cloud.syncing      同步中 / Syncing
app.cloud.error        云端错误 / Cloud error
app.cloud.broken       云端服务暂不可用，请稍后再试或联系管理员 / Cloud unavailable, retry later or contact admin
app.fab.fabTitle       添加记录 / Add record
app.diag.url           URL: ...
app.diag.key           Key: ...
app.diag.token         Token: ...
app.diag.timeline      时间轴: / Timeline:
app.diag.refresh       点击刷新云端 / Click to refresh cloud
app.action.edit        编辑 / Edit
app.action.delete      删除 / Delete
app.action.copied      已复制 / Copied
app.hours.sun..sat     （特殊命名，略）
app.picker.currentMonth 当前月份 / Current month
```

**实施**：
1. 在 `i18n.js` 字典两个语言块中各加 80+ key。
2. 在 `index.html` 给主应用 header / view / filter / FAB / modal / team-modal / invite-modal 各元素加 `data-i18n`。
3. 在 `app.js` 把 51 处硬编码字符串改为 `this._i18n(key, fallback)`，并把动态 `innerHTML` 中的中文拆为 key 渲染。
4. 在 `setLanguage` 触发后调用 `renderView()` / `renderDate()` / `renderModal()` 重新渲染。
5. 跑 13+ 单元测试确保 i18n 行为不变。

**验收**：
- 切换语言后，所有界面（主应用 + 模态框 + toast）文案立即变化。
- 关闭并重开浏览器，仍保持上次语言。

---

### 变更 3：首页增加更多图形（修复 #3）

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**策略**：
- 在现有 5 个 Hero 装饰基础上，**新增 8-10 个**装饰：
  - Hero：加 4 个新色块（琥珀 / 绿 / 次蓝 / 透明白），不同尺寸和位置；加 1 个 SVG 网格点阵背景。
  - Features 区：每张卡片**加一个角落装饰**（小圆点 / 小三角），并叠加一种"形状水印"（如半透明大圆在右下）。
  - How-to 区：加 3-4 个几何色块 + 1 个 SVG 折线。
  - CTA 区：保留现有装饰。
- 增加一段**专门的"装饰艺术带"**（在 Hero 与 Features 之间，100vh 高），多色斜切条 / 大圆 / 半透明形状拼贴，纯静态。

**具体改动**：
1. Hero：现有 5 个装饰保留，再加：
   - 右上第二个大圆（`bg-secondary/15`，比第一个小）
   - 左下中三角（用 `clip-path: polygon(50% 0%, 0% 100%, 100% 100%)` + `bg-accent/20`）
   - 中部装饰 1 条 `border-l-4 border-canvas/30` 细线
   - Hero 底部 1 个 `bg-white/10` 圆环（用 `ring` 替代 fill）
2. 新增 `<section id="home-art-band" class="bg-canvas">`：100vh 装饰艺术带，含 5-6 个大色块（primary/secondary/accent）+ SVG 网格 + 大数字 "1/2/3/4" 暗示功能序号。
3. Features 卡片：每张加一个绝对定位的 `absolute -top-4 -right-4 h-12 w-12 rounded-full bg-white/40` 装饰。
4. How-to：加 3 个右上角小色块（不同色），1 个底部大圆。

**验收**：
- 视觉：截图浅/深色下首页所有分区，确认多彩但不喧宾夺主。
- 仍保持 0 `shadow-*` / 0 `backdrop-blur-*` / 0 `bg-gradient-*`。

---

### 变更 4：单按钮语言切换器（修复 #4）

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css) + [`src/js/app.js`](file:///workspace/src/js/app.js)

**策略**：
- 替换 `#site-lang-switch` 的两个 chip 为一个**单一按钮** `#site-lang-toggle`。
- 按钮内显示：地球图标 (`<i data-lucide="globe">`) + 当前语言（`中文` / `EN`）+ 一个小箭头图标表示可点击。
- 固定宽度（`min-width: 96px`），文字切换时图标位置不变。
- 点击触发 `i18n.setLanguage(other)` + 刷新主应用视图。

**具体改动**：
1. HTML：替换 `<div id="site-lang-switch">` 为：
   ```html
   <button type="button" id="site-lang-toggle" class="vx-lang-toggle" aria-label="Language">
     <i data-lucide="globe" class="w-4 h-4"></i>
     <span id="site-lang-label">中文</span>
     <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
   </button>
   ```
2. CSS：`.vx-lang-toggle` 设置 `min-width: 96px`，`display: inline-flex`，`justify-content: space-between`，圆角 `rounded-md`，背景 `bg-muted`。
3. JS：替换 `bindEvents()` 内的"两个 chip"逻辑，改为：
   ```js
   const langBtn = document.getElementById('site-lang-toggle');
   const langLabel = document.getElementById('site-lang-label');
   if (langBtn) langBtn.addEventListener('click', () => {
     const next = (window.i18n.getLanguage() === 'zh-CN') ? 'en' : 'zh-CN';
     window.i18n.setLanguage(next);
     this._updateLangToggle();
     // 触发主应用重渲染
     if (this.renderView) { this.renderDate(); this.renderView(); this.updateCloudStatusIcon(); }
   });
   this._updateLangToggle();
   ```
4. `_updateLangToggle()` 方法：根据 `i18n.getLanguage()` 更新 `langLabel` 文本为 "中文" 或 "EN"。

**验收**：
- 切换时按钮位置不变（固定宽度）。
- 图标位置固定。

---

### 变更 5：FAQ + 其他分区过渡动画（修复 #5）

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**策略**：
- FAQ：用 `<details>` 配合 CSS `max-height` 过渡（0 → 一个足够大的值，如 500px），同时 `opacity` 和 `padding-bottom` 过渡，达到平滑展开。
- 首次加载时，第一个 FAQ 项默认 `open`。
- Features 卡片：现有 `hover:scale-110` 保留，加 `transition-all duration-300 ease-out`，并加 `transform translate-y-2` 入场动画（在视口内才触发）。
- How-to 步骤：加 `hover:-translate-y-1` 反馈。
- CTA 按钮：加 `hover:scale-105` 保留。

**具体改动（FAQ 关键）**：
```css
.vx-faq-item > .vx-faq-answer {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.4s ease, opacity 0.3s ease, padding 0.3s ease;
}
.vx-faq-item[open] > .vx-faq-answer {
  max-height: 500px;
  opacity: 1;
}
```

并在 JS 中：第一个 `<details>` 加 `open` 属性（直接 HTML 写）。

**验收**：
- 打开 / 关闭 FAQ 平滑过渡，无 jump。
- 其他分区 hover / 入场有响应。

---

### 变更 6：FAQ 改为手风琴（accordion）+ 默认展开第一项（修复 #6）

**文件**：[`index.html`](file:///workspace/index.html) + [`src/js/app.js`](file:///workspace/src/js/app.js)

**策略**：
- 给所有 FAQ `<details>` 加 `name="faq"`（HTML 原生 `<details>` name 属性支持 accordion，但兼容性差，主要依赖 JS）。
- 备用方案：JS 监听 `toggle` 事件，打开时关闭其他。
- 第一个 FAQ 在 HTML 中**默认 `open`**（这样首次加载时是展开状态）。

**具体改动**：
1. HTML：第一个 FAQ `<details class="group vx-faq-item" open>`。
2. JS：在 `bindEvents()` 中：
   ```js
   document.querySelectorAll('.vx-faq-item').forEach(item => {
     item.addEventListener('toggle', () => {
       if (item.open) {
         document.querySelectorAll('.vx-faq-item').forEach(other => {
           if (other !== item) other.open = false;
         });
       }
     });
   });
   ```
3. CSS：保留上面变更 5 的 max-height 过渡。

**关键点**：使用 `max-height` 过渡时，关闭其他项目的高度从 500px 收回 0，过渡平滑，**整体位置变化只发生在内容区域内**——即折叠的项内文字淡出，不影响其他项的位置。

**验收**：
- 打开任一 FAQ，其他 3 个自动关闭。
- 第一个 FAQ 首次加载时打开。
- 视觉相对位置不变（除非展开的项目本身在变化）。

---

## 4. 决策与假设（Assumptions & Decisions）

1. **顶栏隐藏策略**：用 CSS `data-scene` 切换 + 删除 `_syncSiteHeader` 中 `auth` 分支。优点：减少 JS 逻辑，CSS 控制更可预测。
2. **i18n 范围**：覆盖主应用**所有用户可见** UI（header / views / modal / FAB / toasts / user-menu / team-modal），但**不翻译** Supabase 错误原始字符串（仍走 `e.message`），因为这些是后端抛出。
3. **新装饰艺术带**：决定加在 Hero 与 Features 之间（100vh），作为视觉呼吸区。这会增加首页滚动长度（~1 屏），但提供更强的视觉冲击。
4. **语言按钮宽度**：`min-width: 96px`（中文 "中文" ≈ 24px + EN "EN" ≈ 16px + 图标 32px + padding 24px = 96px），切换时不抖动。
5. **FAQ 动画兼容性**：`max-height: 500px` 足够覆盖最长一条答案（实测答案最长 2-3 行）。如果未来答案更长，可改为动态测量 scrollHeight。
6. **不引入新依赖**：所有变更用现有 CSS + 原生 JS，不引入 framer-motion / anime.js 等库。

---

## 5. 实施步骤（Implementation Steps）

按依赖顺序执行，可并行的标 ⓟ：

### 阶段 A：基础重构
- **A1**：修改 [index.html](file:///workspace/index.html) `goToAuth` 流程（移除 `_syncSiteHeader('auth')` 调用，改为 body `data-scene` 属性 + CSS 控制）→ 影响变更 1
- **A2**：修改 [styles.css](file:///workspace/src/css/styles.css) 加 `#site-header[data-hidden="true"]` 规则与 `[data-scene="auth"]` 隐藏 → 影响变更 1
- **A3**：在 [#auth-page](file:///workspace/index.html) 右侧表单顶部加 `<a id="auth-back-home">返回首页</a>`，并绑定 `showHomePage` 事件 → 影响变更 1

### 阶段 B：i18n 主应用 ⓟ
- **B1**：扩展 [i18n.js](file:///workspace/src/js/i18n.js) 字典，添加 ~80 个 `app.*` key（zh-CN + en）→ 影响变更 2
- **B2**：在 [index.html](file:///workspace/index.html) 主应用部分加 `data-i18n` 标注（header / views / filter / modal / team-modal / invite-modal / fab）→ 影响变更 2
- **B3**：修改 [app.js](file:///workspace/src/js/app.js) 把 51 处硬编码中文改为 `this._i18n(key, fallback)`，并在 `setLanguage` 后重渲染 → 影响变更 2
- **B4**：在 `i18n.setLanguage` 触发后调用 `this.renderView()` / `this.renderDate()` / `this.updateCloudStatusIcon()` 刷新 → 影响变更 2

### 阶段 C：首页美化 ⓟ
- **C1**：在 [index.html](file:///workspace/index.html) Hero 增 4 个新装饰（圆 / 三角 / 细线 / 圆环）→ 影响变更 3
- **C2**：在 Hero 与 Features 之间新增 `<section id="home-art-band">` 装饰艺术带 → 影响变更 3
- **C3**：在 Features 卡片加角落装饰 + How-to 区加色块 → 影响变更 3
- **C4**：更新 [styles.css](file:///workspace/src/css/styles.css) 给新装饰加 CSS（如 `clip-path` 三角）→ 影响变更 3

### 阶段 D：语言单按钮 ⓟ
- **D1**：在 [index.html](file:///workspace/index.html) 替换 `#site-lang-switch` 为单按钮 `#site-lang-toggle` → 影响变更 4
- **D2**：在 [styles.css](file:///workspace/src/css/styles.css) 加 `.vx-lang-toggle` 样式（min-width 96px）→ 影响变更 4
- **D3**：在 [app.js](file:///workspace/src/js/app.js) `bindEvents()` 改写语言切换逻辑（单击切换 + 触发主应用重渲染）→ 影响变更 4

### 阶段 E：FAQ 动画 + accordion
- **E1**：在 [index.html](file:///workspace/index.html) 第一个 FAQ `<details>` 加 `open` 属性 → 影响变更 6
- **E2**：在 [styles.css](file:///workspace/src/css/styles.css) 给 `.vx-faq-item > .vx-faq-answer` 加 max-height 过渡 → 影响变更 5
- **E3**：在 [styles.css](file:///workspace/src/css/styles.css) 给 Features / How-to / CTA 加 hover transition（已有部分，需补齐）→ 影响变更 5
- **E4**：在 [app.js](file:///workspace/src/js/app.js) `bindEvents()` 监听 FAQ `toggle` 事件实现手风琴 → 影响变更 6

### 阶段 F：验证
- **F1**：跑 13+ i18n 单元测试
- **F2**：DESIGN.md 合规扫描（0 shadow / 0 blur / 0 gradient）
- **F3**：手动验证 6 项：① auth 页无头栏 ② 切换语言所有界面都变 ③ 首页多彩 ④ 语言按钮位置不变 ⑤ FAQ 平滑 ⑥ FAQ accordion

---

## 6. 验证步骤（Verification）

### 自动验证
```bash
# 1. 语法检查
node -c /workspace/src/js/i18n.js
node -c /workspace/src/js/app.js

# 2. i18n 单元测试（基于之前 /tmp/verify2.js）
node /tmp/verify2.js  # 应 13+ PASS

# 3. DESIGN.md 合规扫描
curl -s http://localhost:8080/ | grep -cE 'shadow-|backdrop-blur-|bg-gradient-'
# 应 = 0

# 4. i18n 节点数
curl -s http://localhost:8080/ | grep -c 'data-i18n'
# 应 ≥ 130（首页 43 + 登录 13 + 主应用 ≥ 75）

# 5. 主应用中文字符串残留（应 0）
grep -cE "['\"][^\"']*[\u4e00-\u9fff][^\"']*['\"]" /workspace/src/js/app.js
# 应大幅减少（仅保留 i18n 字典的 fallback）
```

### 手动验证
| # | 场景 | 期望 |
|---|------|------|
| 1 | 访问 `/` 未登录 | 显示首页 |
| 2 | 首页点击"开始使用" | 进入登录页，**顶部无 site-header**，右上角"返回首页"链接可见 |
| 3 | 登录页点击"返回首页" | 回到首页 |
| 4 | 登录成功 | toast 出现，3 秒后进入主应用 |
| 5 | 主应用切换语言 | 所有界面（header / views / filter / modal / FAB / team-modal）文案立即变化，**语言按钮位置不变** |
| 6 | 主应用点击"管理赛队" / "创建赛队"等菜单 | 模态框显示对应中文/英文 |
| 7 | 首页 Hero 视觉 | 多个多彩装饰，几何感强，仍扁平 |
| 8 | 首页 Features / How-to 卡片 hover | 缩放 + 入场动画 |
| 9 | FAQ 首次加载 | 第一项展开 |
| 10 | FAQ 点击第二项 | 第一项关闭，第二项展开，**平滑过渡** |
| 11 | 关闭所有 FAQ | 全部收回，位置变化仅在 FAQ 区域 |
| 12 | 刷新浏览器 | 语言保持 |
| 13 | 切换深色模式 | 所有分区色块适配，无大块刺眼亮色 |

### DESIGN.md 强制项
- [ ] 0 `shadow-*`
- [ ] 0 `backdrop-blur-*`
- [ ] 0 `bg-gradient-*`（按钮/卡片）
- [ ] 字体仅 Outfit
- [ ] 颜色仅来自 7 个 token
- [ ] 圆角 `rounded-md` / `rounded-lg` / `pill`（仅 tag）

---

## 7. 风险与缓解（Risks & Mitigation）

| 风险 | 影响 | 缓解 |
|------|------|------|
| FAQ max-height 500px 不够 | 答案长于 500px 被截断 | 改用 JS 动态测量 `scrollHeight` |
| i18n key 漏掉某些字符串 | 部分 UI 仍为中文 | 跑 grep 扫描中文字符串残留 |
| 装饰艺术带让首页过长 | 用户嫌首页太长 | 装饰艺术带设为 `min-h-[60vh]` 而非 100vh |
| 语言按钮 min-width 不够 | 切换时仍轻微抖动 | 视觉评审后微调 |
| 移除 `_syncSiteHeader('auth')` 破坏其他流程 | 顶栏状态错乱 | 用 `data-scene` 全局管理，单一真相源 |

---

## 8. 涉及文件清单（Affected Files）

| 文件 | 变更类型 | 主要变更 |
|------|----------|----------|
| [index.html](file:///workspace/index.html) | 修改 | 替换 site-lang-switch、增 auth-back-home、加新装饰 / 装饰艺术带、给主应用加 data-i18n |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 修改 | .vx-lang-toggle、FAQ max-height 过渡、data-scene 隐藏 site-header、新装饰 CSS |
| [src/js/i18n.js](file:///workspace/src/js/i18n.js) | 修改 | 字典新增 ~80 个 key（zh-CN + en） |
| [src/js/app.js](file:///workspace/src/js/app.js) | 修改 | 51 处硬编码 → i18n、bindEvents 加语言按钮 + FAQ accordion + 切换刷新 |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 不变 | 错误文案已 i18n 化 |

---

## 9. 不在本轮范围（Out of Scope）

- 服务端 i18n（Supabase 数据本身是中文，不做翻译）
- 时间轴 / 月历数据的国际化（如日期格式、星期名）— 已部分 i18n（`app.day.sun..sat`）
- 移动端导航抽屉（`#mobile-drawer`）的 i18n — 不在用户反馈范围内，但顺便也会跟随
- 暗色模式下的额外颜色调整 — 现有 CSS 变量已自动处理
- 主题色切换 — 用户未要求
