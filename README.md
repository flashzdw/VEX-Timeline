# VEX-Timeline

VEX 备赛时间轴系统。支持本地 IndexedDB 离线使用和 Supabase 云端同步，含用户注册/登录、个人/赛队时间轴、邀请协作、图片上传。

## 本地开发

```bash
# 1. 安装依赖（如有）
npm install

# 2. 复制环境变量模板并填入 Supabase URL / anon key
cp .env.example .env.local
# 编辑 .env.local 填入：
#   SUPABASE_URL=https://<project-ref>.supabase.co
#   SUPABASE_ANON_KEY=<your-anon-key>

# 3. 启动构建 + 本地服务器
npm run dev
# 打开 http://localhost:8000
```

`npm run build` 会把 `.env.local` 中的变量烘焙到 `src/js/config.js`（在 `.gitignore` 中），浏览器通过 `window.VEX_CONFIG` 读取。

## Vercel 部署

### 1. 准备 Supabase 项目
- 在 [supabase.com](https://supabase.com) 创建项目
- 在 SQL Editor 中依次执行 `supabase/migrations/001_initial_schema.sql`、`002_storage_and_functions.sql` 和 `003_fix_user_profile_creation.sql`
- 在 Supabase Dashboard → **Settings → API** 复制：
  - **Project URL** → 用于 `SUPABASE_URL`
  - **anon public key** → 用于 `SUPABASE_ANON_KEY`
- ⚠️ 在 **Authentication → Providers → Email** 中**关闭** "Enable email confirmations"（否则注册后无法立即登录）

### 2. 在 Vercel 配置环境变量
进入 Vercel Dashboard → Project → **Settings → Environment Variables**，添加：

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | 你的 anon public key |

**关键**：每个变量添加时，必须勾选 **Production / Preview / Development 三个 Environment**（缺一不可）。

### 3. 触发构建并验证
每次修改/新增环境变量后必须 **Redeploy**（Vercel 不会自动用新 env var 重新构建）：
- Deployments → 最新部署右侧 ⋯ → **Redeploy**
- 也可以 `git commit --allow-empty && git push` 触发

### 4. 验证 env var 已正确注入

**方法 A：查看 Vercel 构建日志**
打开最新部署的 build log，搜索 `SUPABASE_URL:` 和 `SUPABASE_ANON_KEY:`：
```
=== VEX-Timeline Build Configuration ===
Environment: Vercel Build
SUPABASE_URL:    (set, length=52)
SUPABASE_ANON_KEY:(set, length=210)

✅ Configuration file generated: .../src/js/config.js
```
如果看到 `(not set)`，说明 env var 没正确注入。

**方法 B：查看运行时配置**
浏览器打开 `https://<your-domain>/src/js/config.js`，应能看到真实的 Supabase URL（不是 `YOUR_SUPABASE_URL`）。

**方法 C：查看页面诊断条**
打开首页，登录页中央的灰色诊断条会显示：
- `URL: ✓ https://abcdefg.supabase.co`
- `Key: ✓ 已设置`
- `Session: ⊘ 未登录`（未登录时）/`Session: ✓ 已登录 (username)`（登录后）

如果显示 `URL: ✗ 未配置`，按方法 A/B 排查。

## Vercel 部署故障排查

### 问题 1：登录后刷新浏览器，登录状态丢失

**症状**：刚登录成功，F5 刷新后又被弹回登录页。

**原因**：`authManager.init()` 在 `supabaseManager.isConfigured() === false` 时立即 return，不会从 localStorage 恢复 session。

**排查**：
1. 打开浏览器 DevTools → Console，搜索 `[VEX-Timeline]`，看是否有 "Supabase 未配置" 红色错误
2. 直接访问 `https://<your-domain>/src/js/config.js`，确认 URL 是真实值
3. 登录页诊断条检查 `URL` / `Key` 状态

**解决**：参考上文 "在 Vercel 配置环境变量" 章节，确保三个 Environment 全部勾选，然后 Redeploy。

### 问题 2：数据没上传到云端

**症状**：登录后添加记录，刷新或换浏览器看不到新记录。

**原因**：可能 `currentTimelineId` 仍为 `'local'`，或 `supabaseManager.isConfigured()` 为 false。

**排查**：
1. 登录后看时间轴选择器，应自动选中 "👤 个人时间轴"（云端 ID），不是 "本地时间轴"
2. 头部用户信息旁应有云图标 ☁（绿色=正常，⚠=错误，⊘=离线）
3. DevTools → Network → 找到 `supabase.co/rest/v1/records` 的 POST 请求，看是否返回 201
4. DevTools → Application → Local Storage → 找到 `sb-<project-ref>-auth-token`，确认存在

**解决**：
- 若时间轴选择器显示 "本地时间轴"：可能云端时间轴拉取失败（看 Console 错误），刷新重试
- 若云图标显示 ⚠：检查 Vercel env var（同问题 1）
- 若 POST 请求返回 401/403：检查 Supabase RLS 策略是否正确应用

### 问题 3：注册提示 "Email not confirmed"

**症状**：注册时返回 "Email not confirmed" 错误。

**原因**：Supabase Auth 默认开启邮箱验证，注册后需点击确认邮件。

**解决**：
- Supabase Dashboard → **Authentication → Providers → Email** → 关闭 **"Enable email confirmations"**
- 或在登录页改用 `signInWithPassword` 已有账号

### 问题 4：构建失败 "Aborting Vercel build due to missing env vars"

**症状**：Vercel build log 出现红色错误 `Aborting Vercel build due to missing env vars`。

**原因**：`scripts/build-config.js` 检测到 Vercel 构建时 env var 缺失，主动 `process.exit(1)` 防止静默部署坏版本。

**解决**：在 Vercel Settings → Environment Variables 添加缺失的变量后 Redeploy。

## 数据库 Schema

详见 `supabase/migrations/001_initial_schema.sql`：
- `users` — 用户资料，id 关联 `auth.users`
- `timelines` — 个人/赛队时间轴
- `timeline_members` — 时间轴成员关系
- `records` — 记录，关联 timeline

RLS 策略：成员可读/创建；创建者可编辑/删除自己的记录；时间轴所有者可删除任意记录。

## 技术栈

- 纯前端 SPA（无构建框架），Vanilla JS
- Supabase（Auth + Postgres + Storage）
- IndexedDB 离线缓存 + 同步队列
- Service Worker 离线缓存
- Vercel 静态部署

## License

MIT
