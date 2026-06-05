# 修复 VEX-Timeline 云端数据同步与会话持久化

## 问题根因分析

经过代码探索，两个问题的根本原因高度相关：

### 当前数据流
1. `scripts/build-config.js` 读取 `process.env.SUPABASE_URL` 和 `process.env.SUPABASE_ANON_KEY`，生成 `src/js/config.js`（在 `.gitignore` 中）
2. Vercel `buildCommand: npm run build` 在部署时执行此脚本
3. 浏览器加载 `src/js/config.js`，`SupabaseManager` 读取 `window.VEX_CONFIG`
4. `isConfigured()` 检查 URL/Key 是否还是占位符

### 两个症状的共同根因
当 `isConfigured()` 返回 `false` 时：
- `authManager.init()` 立即 `return`，**永远不会** 从 `supabase.auth.getSession()` 恢复 session → **登录态刷新即丢失**
- `app.js` 所有分支都用 `if (... && supabaseManager.isConfigured() && this.currentTimelineId !== 'local')` 包裹 → **数据永远不写入云端**
- `loadTimelines()` 提前 return，`this.currentTimelineId` 保持为 `'local'`，后续 `saveRecord` 直接走本地分支

### 三大可能触发点
1. **Vercel 环境变量作用域错误**：在 Vercel 控制台设置时只勾选了 "Development" 而非 "Production"（或反之），导致生产构建时 `process.env` 没有这两个变量
2. **修改 env var 后没有重新部署**：Vercel 只在 build 时把 env vars 烘焙进 `config.js`，改完必须 Redeploy
3. **构建脚本静默失败**：`scripts/build-config.js` 在 env var 缺失时只 fallback 到占位符并 `console.log('(not set)')`，不抛出任何错误，开发者无法察觉

## Proposed Changes

### 1. 构建脚本强化 (`scripts/build-config.js`)
**目的**：让 env var 缺失在 build 阶段就被发现，而不是等到运行时才暴露

**改动**：
- 在 `process.env.SUPABASE_URL` / `SUPABASE_ANON_KEY` 缺失时输出醒目的 `console.error`（红字 + 提示用户去 Vercel 控制台检查）
- 在文件顶部增加对 `process.env.VERCEL` 的判断：如果是 Vercel 构建（`process.env.VERCEL === '1'`）且 env vars 缺失，则 `process.exit(1)` 主动失败构建，避免静默部署错误版本
- 输出"有效 URL/Key 长度"等脱敏信息，便于在 Vercel build log 中确认

### 2. SupabaseManager 配置校验增强 (`src/js/supabase.js`)
**目的**：让前端能识别"env vars 已构建进 bundle"但 "Supabase 实际不可用"的情况

**改动**：
- `isConfigured()` 额外校验：URL 必须是 `https://` 开头、必须包含 `.supabase.co`（或自托管域名）
- 新增 `getConfigStatus()` 方法返回 `{ hasUrl, hasKey, urlPrefix, isValid }` 供 UI 诊断
- 新增 `init()` 在 `isConfigured()` 为 false 时通过 `console.error` 输出明确指引

### 3. 修复会话恢复 (`src/js/auth.js`)
**目的**：保证刷新后 session 一定被恢复

**改动**：
- `init()` 在 `supabase.auth.getSession()` 后增加一次 fallback：直接读 `localStorage.getItem('sb-' + projectRef + '-auth-token')`，因为项目 ref 已编码在 SUPABASE_URL 中
- 在 `init()` 末尾调用 `supabase.auth.onAuthStateChange` 注册全局回调，自动同步 `this.session` / `this.currentUser`（目前 `App` 类定义了 `onAuthStateChange` 但未在 init 中订阅）
- `isLoggedIn()` 增加一个 fallback：`!!this.session || !!this.currentUser`，避免任一字段被清空导致误判

### 4. 修复云端时间轴自动激活 (`src/js/app.js`)
**目的**：登录后自动跳到云端个人时间轴，确保后续 `saveRecord` 走云端分支

**改动**：
- `onLoginSuccess()` 中：若 `loadTimelines()` 抛错或返回空数组（云端拉取失败），**不要**让 `this.currentTimelineId` 保持 `'local'`——而是显示明确错误"无法连接到云端，请检查网络或刷新"，并禁用添加按钮
- `loadTimelines()` 增加重试机制（最多 2 次，间隔 1s）
- 记录 `currentTimelineId` 持久化到 `localStorage`，刷新后优先恢复，避免每次都从 `'local'` 起步

### 5. 增强 UI 反馈 (`index.html` + `src/js/app.js` + `src/css/styles.css`)
**目的**：让用户随时能看到 Supabase 配置和登录状态

**改动**：
- 在登录页面顶部加一个"诊断条"：用 `supabaseManager.getConfigStatus()` 显示 `SUPABASE_URL: ✅ 已配置 / ❌ 未配置`、当前 session 状态
- 头部用户信息旁边加一个云同步状态图标（同步中 ✓ / 失败 ⚠ / 离线 ⊘）
- 登录失败、网络错误时显示具体原因（不是模糊的"登录失败"）

### 6. README 增加 Vercel 部署故障排查章节 (`README.md`)
**目的**：让用户/后续维护者知道如何检查 env vars

**改动**：
- 新增"## Vercel 部署"章节，包含：
  - 在 Vercel Dashboard → Project → Settings → Environment Variables 添加 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`，**必须勾选 Production / Preview / Development 全部三个环境**
  - 改完 env var 必须 Redeploy
  - 如何在 Vercel build log 中确认 env var 已注入（搜索 `SUPABASE_URL: (set)`）
  - 如何用浏览器 DevTools 打开 `https://你的域名/src/js/config.js` 验证配置已正确烘焙

## Assumptions & Decisions

1. **Vercel 是正确的部署目标**（已有 `vercel.json`），继续沿用构建时注入方案
2. **不引入运行时配置覆盖 UI**——会泄露 anon key 到 URL 引用记录，且容易与 build-time config 冲突
3. **不动 Supabase RLS / Schema**——表结构、RLS 策略已是终态
4. **保持 Supabase 邮箱+密码认证方案**——虽然 spec 提到过无密码方案，但当前实现已采用 `signInWithPassword`，改回 RPC 风险更大
5. **不动 Service Worker 缓存列表**——目前 sw.js 没有缓存 `supabase.js / auth.js / cloud-db.js / config.js`，但缓存 `index.html` 可能让用户拿到旧版本；不过这是次要问题，留待后续
6. **不实现离线队列重放**——用户只关心"新数据上云"，离线队列已存在但本次不深入调优

## Verification Steps

实施后请按以下步骤逐项验证：

1. **Vercel 构建诊断**
   - 在 Vercel 控制台修改/确认 env var → Redeploy
   - 打开 build log，搜索 `SUPABASE_URL:` 和 `SUPABASE_ANON_KEY:`，必须显示 `(set)` 而非 `(not set)`
   - 打开浏览器访问 `https://你的域名/src/js/config.js`，确认能看到真实的 Supabase URL（不是 `YOUR_SUPABASE_URL`）

2. **诊断条显示正确**
   - 打开首页登录页，诊断条显示 `SUPABASE_URL: ✅ 已配置` 和 `SUPABASE_ANON_KEY: ✅ 已配置`

3. **登录 + 刷新会话持久化**
   - 输入用户名密码登录 → 进入主页
   - **F5 刷新浏览器** → 应自动恢复到主页，不应回到登录页
   - 关闭并重新打开浏览器 → 同样应自动恢复

4. **数据真正写入云端**
   - 登录后点击 + 添加一条记录
   - 打开 Supabase Dashboard → Table Editor → `records` 表，应能看到刚添加的记录（含 `timeline_id`、`user_id`）
   - 切换到其他浏览器/隐身窗口，用同一账号登录，应能看到该记录

5. **时间轴自动激活**
   - 登录成功后，时间轴选择器应自动选中"个人时间轴"（即云端时间轴），而不是"本地时间轴"
   - 添加按钮可用，不应被禁用

6. **登出后清空本地缓存（可选验证）**
   - 登出 → 重新登录 → 云端记录应被拉取到本地 IndexedDB 并显示

## 涉及文件清单

| 文件 | 改动类型 |
|------|----------|
| `scripts/build-config.js` | 修改：增加 Vercel 构建时的强校验和详细日志 |
| `src/js/supabase.js` | 修改：增加 `getConfigStatus()`、URL 格式校验 |
| `src/js/auth.js` | 修改：增加 localStorage fallback、订阅 onAuthStateChange |
| `src/js/app.js` | 修改：增强 onLoginSuccess / loadTimelines 错误处理、持久化 currentTimelineId |
| `index.html` | 修改：增加诊断条 UI 容器 |
| `src/css/styles.css` | 修改：诊断条与同步状态图标样式 |
| `README.md` | 修改：增加 Vercel 部署故障排查章节 |
