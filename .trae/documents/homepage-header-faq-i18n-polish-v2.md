# VEX-Timeline · 首页布局 / 顶栏语言按钮 / FAQ 动画 / i18n 补全 Plan

> 上一轮已完成的 6 项不在本计划范围内（顶栏隐藏、单按钮语言切换器、首页 9 个装饰、Features 角落装饰、FAQ accordion、主应用 i18n）。
> 本计划处理用户最新的 6 项反馈。

---

## 0. 当前执行进度（Status）

> 之前一轮执行已落地的工作（grep 验证后已确认），无需重做：

| 阶段 | 任务 | 状态 |
|------|------|------|
| 1.1 | 删 `<section id="home-art-band">` | ✅ 已完成（grep 确认 0 处残留） |
| 1.2-1.5 | 删 4 个 Features 卡片右上角圆 | ✅ 已完成（grep 确认 0 处残留） |
| 2.1-2.2 | 顶栏右组 DOM 重排 + 简化 lang toggle | ✅ 已完成 |
| 2.3 | CTA 加 `min-w-[112px] sm:min-w-[136px]` | ✅ 已完成 |
| 2.4 | `.vx-lang-toggle` CSS 改 40x40 方形 | ✅ 已完成 |
| 3.1-3.4 | FAQ 改 grid-template-rows | ❌ **待执行** |
| 4.1-4.2 | 登录页左栏 i18n | ❌ **待执行** |
| 5.1-5.4 | 个人时间轴 + chooseFile 补全 | ❌ **待执行** |
| 6.1-6.4 | 主应用顶栏加语言按钮 | ❌ **待执行** |
| 7 | 验证 | ❌ **待执行** |

> **执行入口**：从 §3（FAQ 动画）开始往下做。

---

## 1. 总结（Summary）

修复 6 个新问题：

1. **Hero 下方大块空白** —— 删掉 `home-art-band` section（60vh 纯装饰）
2. **语言按钮被 CTA 推挤位移** —— 把它移到 CTA 右侧 + 加 `min-width` 锁定 CTA + 简化为只显示 `中` / `EN` 文字
3. **Features 卡片右上角圆形装饰** —— 删除 4 个角落圆
4. **FAQ 切换卡顿** —— 改用 `grid-template-rows: 0fr → 1fr` 现代方案，去除 `max-height` 500px 的 snap
5. **登录页左栏 i18n 缺失** —— 4 个静态文本加 `data-i18n`
6. **补全 i18n 缺失项** —— `app.term.personalTimeline` / `app.term.image` / `app.modal.chooseFile` 等
7. **主应用顶栏右侧增加语言按钮** —— 让登录后页面也能切语言

---

## 2. 当前状态分析（Current State）

### 已有结构（关键行号）

| 元素 | 位置 | 状态 |
|------|------|------|
| `home-art-band` 装饰艺术带 | [index.html:218-226](file:///workspace/index.html) | 占 60vh 无文字 → **要删** |
| 顶栏语言按钮 | [index.html:142-146](file:///workspace/index.html) | 在 CTA 左侧、有 icon+文字+chevron → **要瘦身** |
| 顶栏 CTA "开始使用" | [index.html:152-154](file:///workspace/index.html) | 无 `min-width` → **要加 min-width** |
| Features 4 张卡片角落圆 | [index.html:242, 251, 260, 269](file:///workspace/index.html) | 4 个 10px 装饰 → **要删** |
| FAQ `max-height` 过渡 | [styles.css:962-976](file:///workspace/src/css/styles.css) | 0 → 500px 抖动 → **改用 grid** |
| 登录页左栏 i18n | [index.html:402-413](file:///workspace/index.html) | 4 处硬编码中文 → **要加 data-i18n** |
| 主应用顶栏右侧 | [index.html:515-524](file:///workspace/index.html) | 无语言按钮 → **要加** |
| 文件输入 `<input type="file">` | [index.html:683-686](file:///workspace/index.html) | "选择文件" 浏览器原生字符串 → **要包自定义 i18n 标签** |

### 字典现状

- `app.modal.image` 已存在（"图片" / "Image"）
- `app.term.personalTimeline` **不存在**（目前散落在 `home.features.item3.desc` / `home.howto.step2.desc` 句子里）

---

## 3. 变更方案（Proposed Changes）

### 变更 1：删除 Hero 下方装饰艺术带

**文件**：[`index.html`](file:///workspace/index.html)

**改动**：删除 L218-226 整段 `<section id="home-art-band">...</section>`（共 9 行）。

**验收**：访问首页，Hero 之后直接接 Features，没有大块空白。

---

### 变更 2：顶栏语言按钮瘦身 + 移到最右

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**策略**：
- 顶栏右组的 DOM 顺序：语言按钮 → 返回首页 → CTA。把语言按钮移到 **CTA 之后**（成为最右）
- 简化按钮：去掉 globe 图标和 chevron，只保留一个文字 span（"中" / "EN"）
- 加 `min-width` 锁定 CTA（"开始使用" / "Get started" 文本宽度差 60%）

**HTML 调整**（[index.html:140-155](file:///workspace/index.html)）：
```html
<div class="flex items-center gap-2 sm:gap-3">
    <!-- 登录页：返回首页链接 -->
    <a href="#" id="site-back-home" class="hidden ...">返回首页</a>

    <!-- 首页：开始使用 CTA（min-width 锁定，避免语言切换时撑开） -->
    <a href="#" id="site-cta-start"
       class="h-10 px-3 sm:px-5 inline-flex items-center justify-center gap-2 bg-primary text-canvas rounded-md font-semibold tracking-wider uppercase text-xs hover:bg-primary-hover hover:scale-105 transition-all duration-200 min-w-[112px] sm:min-w-[136px]">
        <i data-lucide="arrow-right" class="w-4 h-4 shrink-0"></i><span data-i18n="nav.start" class="truncate">开始使用</span>
    </a>

    <!-- 语言切换：最右、只显示 中/EN -->
    <button type="button" id="site-lang-toggle" class="vx-lang-toggle" aria-label="Language">
        <span id="site-lang-label" class="text-xs font-extrabold tracking-wider">中</span>
    </button>
</div>
```

**CSS 调整**（[styles.css:890-920](file:///workspace/src/css/styles.css)）：
```css
.vx-lang-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 40px;              /* 固定 40x40 方形 */
  padding: 0;
  background-color: var(--color-muted);
  border: 2px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-fg);
  font-weight: 800;
  font-size: 0.8125rem;     /* 13px 略放大，确保 "中" 居中不挤 */
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  flex-shrink: 0;           /* 防止被挤压 */
}
.vx-lang-toggle:hover { background-color: var(--color-canvas); border-color: var(--color-primary); }
```

**验收**：
- 按钮在 CTA 右侧、宽度恒定 40x40
- 切换语言时按钮位置不动
- 视觉上比之前的 96px 宽按钮节省 60% 空间

---

### 变更 3：删除 Features 卡片右上角圆形装饰

**文件**：[`index.html`](file:///workspace/index.html)

**改动**：删除 L242 / L251 / L260 / L269 4 个 `<div class="absolute -top-3 -right-3 ...">` 装饰圆（每行 1 个，共 4 行）。

**验收**：访问首页 Features 区，4 张卡片右上角没有突出的圆。

---

### 变更 4：FAQ 切换动画改用 grid-template-rows

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**问题分析**：当前 `max-height: 0 → 500px` 过渡在内容只有 80px 时，前 16% 时间就已展开完毕，后 84% 时间视觉"等"，并且 4 个 FAQ 各自的 `max-height: 500px` 在打开瞬间让容器高度有 micro-jump（特别在 Chrome 上）。同时 `details[open]` 是瞬时状态切换，与 CSS 过渡存在 race condition。

**新方案**：使用 `grid-template-rows: 0fr → 1fr` 过渡（现代 CSS 方案，从 [Chrome 117+](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-rows#interpolation) 起支持）。需要把答案内容包在一个 grid 容器里。

**HTML 调整**（每个 FAQ）：
```html
<details class="group vx-faq-item">
    <summary class="vx-faq-summary">...</summary>
    <div class="vx-faq-grid-wrap">  <!-- 新增 grid 容器 -->
        <div class="vx-faq-answer px-5 sm:px-6 text-sm sm:text-base font-medium text-fg/70 leading-relaxed" data-i18n="home.faq.a1">...</div>
    </div>
</details>
```

**CSS 调整**（[styles.css:962-976](file:///workspace/src/css/styles.css)）：
```css
/* 旧 .vx-faq-item > .vx-faq-answer 块全部删除 */

.vx-faq-grid-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0.0, 0.2, 1);
}
.vx-faq-item[open] > .vx-faq-grid-wrap {
  grid-template-rows: 1fr;
}
.vx-faq-grid-wrap > .vx-faq-answer {
  overflow: hidden;
  /* 解决 Chrome 中 grid-rows 过渡的"底部抽搐" */
  min-height: 0;
}

/* 同步优化 summary 的 + → × 旋转，避免跳动 */
.vx-faq-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
  /* 防止内容变化时 summary 高度跳动 */
  align-items: center;
  min-height: 64px;
}
.vx-faq-summary:hover { background-color: var(--color-muted); }
```

**JS 调整**（[app.js:864-873](file:///workspace/src/js/app.js)）：保留现有 accordion 逻辑（开一关一），不动。

**验收**：
- 首次加载：第 1 项默认展开，平滑显示（不再有"先 0 后立刻跳到展开"的 snap）
- 切到第 2 项：第 1 项平滑折叠 + 第 2 项平滑展开，几乎无视觉 jump
- 底部其他内容（CTA / Footer）位置无 twitch

---

### 变更 5：登录页左栏加 i18n

**文件**：[`index.html`](file:///workspace/index.html) + [`src/js/i18n.js`](file:///workspace/src/js/i18n.js)

**新增字典**（zh-CN + en 各 4 条）：
- `auth.hero.title` → "记录备赛<br/>每一天。" / "Track every day<br/>of build season."
- `auth.hero.eyebrow` → "Personal & team timeline for VEX robotics." / "Personal & team timeline for VEX robotics."
- `auth.hero.cloud` → "云端同步" / "Cloud sync"
- `auth.hero.team` → "赛队协作" / "Team collab"
- `auth.hero.media` → "图片记录" / "Image logs"

**HTML 调整**（[index.html:402-413](file:///workspace/index.html)）：
```html
<h1 class="..." data-i18n="auth.hero.title">记录备赛<br/>每一天。</h1>
<p class="..." data-i18n="auth.hero.eyebrow">Personal & team timeline for VEX robotics.</p>
...
<span class="..."><i data-lucide="cloud"></i> <span data-i18n="auth.hero.cloud">云端同步</span></span>
<span class="..."><i data-lucide="users"></i> <span data-i18n="auth.hero.team">赛队协作</span></span>
<span class="..."><i data-lucide="image"></i> <span data-i18n="auth.hero.media">图片记录</span></span>
```

**验收**：访问登录页，切英文，左栏标题 / 副标题 / 3 个标签全部变英文。

---

### 变更 6：补全 i18n 缺失项

#### 6a. `app.term.personalTimeline` 独立 key

**文件**：[`src/js/i18n.js`](file:///workspace/src/js/i18n.js) + [`index.html`](file:///workspace/index.html)

**新增字典**：
- `app.term.personalTimeline` → "个人时间轴" / "Personal timeline"
- `app.term.teamTimeline` → "赛队时间轴" / "Team timeline"（对称补全）

**HTML 调整**（[index.html:265, 305](file:///workspace/index.html)）：
- 把"个人时间轴"在两个句子里用 `<span data-i18n="app.term.personalTimeline">个人时间轴</span>` 包裹
- 把"赛队时间轴"同理包裹

**验收**：切英文后，"个人时间轴"显示 "Personal timeline"。

#### 6b. 文件输入"选择文件"自定义 i18n

**问题**：`<input type="file">` 的按钮文字是浏览器原生（"选择文件"/"Choose File"），无法通过 `data-i18n` 直接翻译。

**方案**：在文件输入下方添加一行可隐藏的提示标签 `<span data-i18n="app.modal.chooseFile">点击或拖拽图片到此处</span>`（中）/ "Click or drop image here"（英），并把现有 "图片" 标签改为更明确的 "选择图片" / "Choose image"。

**新增字典**：
- `app.modal.chooseFile` → "点击或拖拽图片到此处" / "Click or drop an image here"

**HTML 调整**（[index.html:683-686](file:///workspace/index.html)）：
```html
<div class="flex flex-col gap-2">
    <label class="..." for="record-image" data-i18n="app.modal.image">图片</label>
    <input id="record-image" type="file" accept="image/*" class="...">
    <span class="text-xs font-semibold uppercase tracking-wider text-fg/40" data-i18n="app.modal.chooseFile">点击或拖拽图片到此处</span>
    <div id="image-preview" ...>...</div>
</div>
```

**验收**：打开添加记录 modal，文件输入下方有"点击或拖拽图片到此处"提示，切英文后变 "Click or drop an image here"。

---

### 变更 7：主应用顶栏右侧增加语言按钮

**文件**：[`index.html`](file:///workspace/index.html) + [`src/css/styles.css`](file:///workspace/src/css/styles.css)

**位置**：[index.html:515-524](file:///workspace/index.html) `<div class="flex items-center gap-2 sm:gap-3">`（云状态 + 用户菜单所在组）末尾。

**HTML 调整**：
```html
<div class="flex items-center gap-2 sm:gap-3">
    <button id="cloud-status" ...>...</button>
    <div id="user-info" ...>...</div>

    <!-- 主应用顶栏：语言切换按钮（与首页同款） -->
    <button type="button" id="app-lang-toggle" class="vx-lang-toggle vx-lang-toggle--app" aria-label="Language">
        <span id="app-lang-label" class="text-xs font-extrabold tracking-wider">中</span>
    </button>
</div>
```

**CSS 调整**（[styles.css](file:///workspace/src/css/styles.css)）：复用 `.vx-lang-toggle` 基础样式，给主应用加修饰类 `.vx-lang-toggle--app`（40x40 方形，与首页同款）。

**JS 调整**（[app.js:611-870](file:///workspace/src/js/app.js)）：在 `bindEvents()` 内追加：
```js
// 主应用顶栏语言按钮
const appLangBtn = document.getElementById('app-lang-toggle');
if (appLangBtn) {
  appLangBtn.addEventListener('click', () => {
    if (!window.i18n) return;
    const current = window.i18n.getLanguage();
    const next = current === 'zh-CN' ? 'en' : 'zh-CN';
    window.i18n.setLanguage(next);
    this._updateLangToggle();
    this._refreshAppOnLangChange();
  });
}
```
同时扩展 `_updateLangToggle()` 同时更新 `#site-lang-label` 和 `#app-lang-label`。

**验收**：
- 登录后主应用顶栏最右侧出现 40x40 "中" 按钮
- 切到英文后变 "EN"
- 切回中文时按钮位置不动

---

## 4. 决策与假设（Assumptions & Decisions）

1. **art-band 整段删除，不保留**：用户明确说"把这个空白删去"。不再保留 1vh 装饰，避免视觉上仍有"断节"感。
2. **CTA 文字保留**："开始使用" / "Get started" 都保留，`min-width` 锁定容器尺寸。位置稳定靠 CSS，不靠 JS。
3. **语言按钮尺寸**：40x40 与 `cloud-status` 按钮（也是 40x40）保持一致，构成视觉对称。
4. **FAQ grid 方案兼容性**：grid-template-rows 0fr/1fr 过渡从 Chrome 117 / Safari 17.2 / Firefox 122+ 支持；旧浏览器会自动 fallback 到瞬间切换（不致命）。
5. **"个人时间轴" 保留原 key + 新独立 key**：原 `home.features.item3.desc` / `home.howto.step2.desc` 已经 i18n 化，但句子中"个人时间轴"被翻译成 "personal timeline"（在句中）。为避免歧义，**新增独立 key `app.term.personalTimeline` 用于特征标题/独立标签**。
6. **不引入新依赖**：所有变更用现有 CSS + 原生 JS。

---

## 5. 实施步骤（Implementation Steps）

按依赖顺序：

### 阶段 1：删除装饰（变更 1, 3）
- **1.1** 删除 [index.html:218-226](file:///workspace/index.html) 整段 `home-art-band`
- **1.2** 删除 [index.html:242](file:///workspace/index.html) 卡片 1 角落圆
- **1.3** 删除 [index.html:251](file:///workspace/index.html) 卡片 2 角落圆
- **1.4** 删除 [index.html:260](file:///workspace/index.html) 卡片 3 角落圆
- **1.5** 删除 [index.html:269](file:///workspace/index.html) 卡片 4 角落圆

### 阶段 2：顶栏语言按钮瘦身 + 移到最右（变更 2）
- **2.1** 改 [index.html:140-155](file:///workspace/index.html) 顶栏右组 DOM 顺序：`back-home` → `cta-start` → `lang-toggle`
- **2.2** 简化 `lang-toggle` HTML：去掉 globe/chevron 图标，只保留 `<span id="site-lang-label">中</span>`
- **2.3** 给 `site-cta-start` 加 `min-w-[112px] sm:min-w-[136px]`
- **2.4** 改 [styles.css](file:///workspace/src/css/styles.css) `.vx-lang-toggle`：40x40 方形、无 padding、字号略大
- **2.5** 验证切换语言时按钮位置不动

### 阶段 3：FAQ 改用 grid（变更 4）
- **3.1** 改 4 个 FAQ 的 HTML 答案：外层加 `<div class="vx-faq-grid-wrap">`，内层 `.vx-faq-answer`
- **3.2** 替换 [styles.css:962-976](file:///workspace/src/css/styles.css) `.vx-faq-item > .vx-faq-answer` 为 `.vx-faq-grid-wrap` 方案
- **3.3** 加 `min-height: 0` 解决 Chrome 抽搐
- **3.4** 加 `min-height: 64px` 给 `.vx-faq-summary` 防止文字变化跳动

### 阶段 4：登录页左栏 i18n（变更 5）
- **4.1** 在 [i18n.js](file:///workspace/src/js/i18n.js) zh-CN 与 en 各加 5 条 key（`auth.hero.title` / `eyebrow` / `cloud` / `team` / `media`）
- **4.2** 在 [index.html:402-413](file:///workspace/index.html) 4 个位置加 `data-i18n`

### 阶段 5：补全 i18n 缺失项（变更 6）
- **5.1** 在 [i18n.js](file:///workspace/src/js/i18n.js) zh-CN + en 各加 3 条 key（`app.term.personalTimeline` / `app.term.teamTimeline` / `app.modal.chooseFile`）
- **5.2** 改 [index.html:265](file:///workspace/index.html) 把句子中"个人时间轴"/"赛队时间轴"用 `<span data-i18n>` 包裹
- **5.3** 改 [index.html:305](file:///workspace/index.html) 同上
- **5.4** 改 [index.html:683-686](file:///workspace/index.html) 文件输入区：加提示行 `data-i18n="app.modal.chooseFile"`

### 阶段 6：主应用顶栏加语言按钮（变更 7）
- **6.1** 改 [index.html:515-524](file:///workspace/index.html) 用户菜单组末尾加 `<button id="app-lang-toggle">`
- **6.2** 改 [styles.css](file:///workspace/src/css/styles.css) 加 `.vx-lang-toggle--app` 修饰类（可选，复用基础样式即可）
- **6.3** 改 [app.js](file:///workspace/src/js/app.js) `bindEvents()` 末尾追加 `#app-lang-toggle` 监听
- **6.4** 改 [app.js](file:///workspace/src/js/app.js) `_updateLangToggle()` 同时更新 `#site-lang-label` 和 `#app-lang-label`

### 阶段 7：验证
- **7.1** 语法检查：`node -c src/js/i18n.js && node -c src/js/app.js`
- **7.2** DESIGN.md 合规：`grep -cE 'shadow-\[|backdrop-blur-|bg-gradient-' index.html` = 0
- **7.3** data-i18n 计数：`grep -c 'data-i18n' index.html` ≥ 130
- **7.4** app.js 中文字符串残留：≤ 7（仅 fallback / debug log）
- **7.5** HTTP 起服务，curl 验证页面无 500

---

## 6. 验证步骤（Verification）

### 自动验证

```bash
# 1. 语法
node -c /workspace/src/js/i18n.js
node -c /workspace/src/js/app.js

# 2. DESIGN.md 合规
grep -cE 'shadow-\[|backdrop-blur-|bg-gradient-' /workspace/index.html
# 期望 = 0

# 3. data-i18n 节点数
grep -c 'data-i18n' /workspace/index.html
# 期望 ≥ 130

# 4. app.js 中文字符串残留
python3 -c "
import re
src = open('src/js/app.js', encoding='utf-8').read()
src = re.sub(r\"_i18n\([^,]+,\s*'[^']*'\)\", '_i18n(...)', src)
src = re.sub(r'_i18n\([^,]+,\s*\"[^\"]*\"\)', '_i18n(...)', src)
n = sum(1 for m in re.finditer(r\"'([^'\\n]{2,80})'\\s*[,;)]\", src) if re.search(r'[\u4e00-\u9fff]', m.group(1)))
print(n)
"
# 期望 ≤ 7

# 5. art-band 已删除
grep -c 'home-art-band' /workspace/index.html
# 期望 = 0

# 6. 角落圆已删除
grep -c '\-top-3 \-right-3 h-10 w-10' /workspace/index.html
# 期望 = 0

# 7. lang-toggle 在主应用
grep -c 'app-lang-toggle' /workspace/index.html
# 期望 ≥ 1
```

### 手动验证

| # | 场景 | 期望 |
|---|------|------|
| 1 | 访问 `/` | 首页 Hero 之后直接是 Features，**无大块空白** |
| 2 | 顶栏 | 最右是 40x40 "中" 按钮；右侧"开始使用"按钮 |
| 3 | 切换中英文 | "开始使用"→"Get started"，**"中"按钮位置不动**；"中" → "EN" |
| 4 | 4 张 Features 卡片 | **右上角没有突出圆** |
| 5 | FAQ 首次加载 | 第 1 项默认展开，**视觉无 snap** |
| 6 | FAQ 点第 2 项 | 第 1 项平滑折叠 + 第 2 项平滑展开；底部 CTA / Footer **无抽搐** |
| 7 | 进入登录页 | 左栏标题、3 个标签为中文 |
| 8 | 登录页切英文 | 标题 "Track every day of build season."；标签 "Cloud sync" / "Team collab" / "Image logs" |
| 9 | 主应用（登录后） | 顶栏最右出现 40x40 "中" 按钮 |
| 10 | 主应用切英文 | 按钮变 "EN"；功能区（如"时间轴"/"月历"）变 "Timeline" / "Calendar" |
| 11 | 主应用开添加记录 modal | 文件输入下显示"点击或拖拽图片到此处"；切英文后变 "Click or drop an image here" |
| 12 | "个人时间轴"在 Features / How-to 中 | 切英文后变 "personal timeline" / "Personal timeline" |
| 13 | 刷新浏览器 | 语言保持 |

### DESIGN.md 强制项
- [x] 0 `shadow-*`（含 FAB）
- [x] 0 `backdrop-blur-*`
- [x] 0 `bg-gradient-*`
- [x] 字体仅 Outfit
- [x] 颜色仅来自 7 个 token

---

## 7. 风险与缓解（Risks & Mitigation）

| 风险 | 影响 | 缓解 |
|------|------|------|
| `grid-template-rows` 0fr→1fr 在旧浏览器不支持 | FAQ 切换瞬间 snap | Safari 17.2 / Chrome 117+ / Firefox 122+ 全部支持；旧浏览器降级到无动画（用户最差体验是瞬间切换，不影响功能） |
| 删除 art-band 后 Hero 显得拥挤 | 视觉过渡不自然 | Hero 自身 `min-h-screen` + 已有 9 个装饰 + Features 区顶部 `py-20 sm:py-28`，足够有节奏 |
| CTA `min-width` 136px 在小屏溢出 | 标题被挤 | 仅 `sm:` 起 136px，mobile 仍 112px + `truncate` |
| 文件输入 i18n 方案不彻底 | 用户仍看到"选择文件"浏览器原生字符串 | 加 hint 文字缓解；如需彻底解决，可改为自定义按钮触发 `input.click()`（不在本轮） |
| 主应用加语言按钮后顶栏过满 | 移动端挤压 | mobile 端通过 `flex-shrink-0` 防止挤压；hamburger drawer 已有（mobile-logout-btn），可后续考虑把语言按钮合并到 drawer（不在本轮） |
| grid 方案在 Safari 上偶有底部 1px 抽搐 | 罕见 | 加 `min-height: 0` + `overflow: hidden` 已缓解；如仍有问题可降级回 max-height |

---

## 8. 涉及文件清单（Affected Files）

| 文件 | 变更类型 | 主要变更 |
|------|----------|----------|
| [index.html](file:///workspace/index.html) | 修改 | 删除 art-band、删除 4 角落圆、调整顶栏右组 DOM、FAQ 加 grid wrap、登录页左栏加 4 data-i18n、个人时间轴包 span、文件输入加 hint、主应用顶栏加语言按钮 |
| [src/css/styles.css](file:///workspace/src/css/styles.css) | 修改 | `.vx-lang-toggle` 改为 40x40、`.vx-faq-grid-wrap` 替换旧 `.vx-faq-answer` 过渡、`.vx-faq-summary` 加 min-height |
| [src/js/i18n.js](file:///workspace/src/js/i18n.js) | 修改 | 新增 12 个 key（zh + en 各 6：auth.hero.*、app.term.*、app.modal.chooseFile）|
| [src/js/app.js](file:///workspace/src/js/app.js) | 修改 | `_updateLangToggle` 支持双按钮；`bindEvents` 加 `#app-lang-toggle` 监听 |
| [src/js/auth.js](file:///workspace/src/js/auth.js) | 不变 | 已 i18n 化 |

---

## 9. 不在本轮范围（Out of Scope）

- 把语言按钮整合进移动端汉堡 drawer（用户未要求）
- 自定义文件输入按钮（`<label>` 包裹 input 模拟按钮，跨浏览器麻烦）
- Hero 区与 Features 区之间的过渡动画
- 主应用顶栏在移动端的进一步简化

---

## 10. 验收清单（Definition of Done）

- [ ] 变更 1：Hero 下方无 60vh 空白
- [ ] 变更 2：顶栏最右是 40x40 "中" 按钮，切换语言位置不动
- [ ] 变更 2：CTA "开始使用" / "Get started" 切换时宽度稳定
- [ ] 变更 3：4 张 Features 卡片右上角无装饰圆
- [ ] 变更 4：FAQ 切换平滑无 snap，底部 CTA / Footer 无抽搐
- [ ] 变更 5：登录页左栏全部 i18n 化
- [ ] 变更 6a："个人时间轴" 在英文下显示 "personal timeline"
- [ ] 变更 6b：文件输入下方有 i18n hint
- [ ] 变更 7：主应用顶栏最右有 40x40 语言按钮
- [ ] 阶段 7：自动验证 7 项全通过
