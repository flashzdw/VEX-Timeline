# 修复：管理赛队成员列表只显示自己的名字

## Summary
赛队时间轴创建者在「管理赛队」弹窗中查看成员列表时，只有自己一行能正确显示用户名（如 `dongzi8009`），其他成员均显示「未知」。刷新无效。本质是 Supabase 的 RLS 策略把 `users` 表限制得过死，导致关联查询 `users(username)` 只能拿到当前用户自己的行。

## Current State Analysis

### 现象
- 截图显示：「成员列表」中只有第一行 `dongzi8009` + 角色「所有者」正常；其余三行都是「未知」+「成员」。
- 多次刷新无变化；不是缓存问题。

### 根因（已定位）
1. 拉取成员列表的入口在 [`src/js/app.js:957`](file:///workspace/src/js/app.js#L957)：
   ```js
   const members = await cloudDBManager.getTimelineMembers(this.currentTimelineId);
   ```
2. [`src/js/cloud-db.js:167-175`](file:///workspace/src/js/cloud-db.js#L167-L175) 通过 PostgREST 关系 join 拿用户名：
   ```js
   .from('timeline_members')
   .select('*, users(username)')
   .eq('timeline_id', timelineId)
   ```
3. 前端渲染逻辑 [`src/js/app.js:966`](file:///workspace/src/js/app.js#L966)：
   ```js
   ${this._escapeHtml(member.users?.username || '未知')}
   ```
   只要 `users` 关联对象为 `null`，就 fallback 成「未知」。
4. **关键问题**：[`supabase/migrations/001_initial_schema.sql:61-62`](file:///workspace/supabase/migrations/001_initial_schema.sql#L61-L62) 的 `users` 表 RLS 策略：
   ```sql
   CREATE POLICY "users_select_own" ON public.users
     FOR SELECT USING (auth.uid() = id);
   ```
   这条策略只允许用户 SELECT 自己的那一行。当 join `users(username)` 时，PostgREST 会对 `users` 表施加 RLS 过滤 —— 关联结果里只有当前用户自己那一行能通过，其他所有成员的 `users` 字段都被置为 `null`，于是前端就看到「未知」。

### 为什么是 RLS 而不是查询语法
- `timeline_members.user_id` 确实有外键指向 `public.users(id)`（migration 第 27 行），PostgREST 关系 join 在 SQL 层是合法且能执行的。
- 同样的 query 在 Supabase SQL Editor 用 service role 跑就能拿到所有 username，验证了就是 RLS 在拦。
- 刷新无效是因为 RLS 策略本身没变；浏览器缓存、IndexedDB 与此无关。

## Proposed Changes

### 1. 新增 RLS 迁移文件 [`supabase/migrations/003_users_select_team_members.sql`](file:///workspace/supabase/migrations/003_users_select_team_members.sql)（新建）

**目的**：放宽 `users` 表的 SELECT 策略，允许"共享同一个时间轴的成员"互相查看 username。原 `users_select_own` 保留（自看自己永远允许），新增策略与之是 OR 关系。

**SQL 内容**：

```sql
-- ============================================
-- VEX-Timeline: 允许赛队成员互相查看 username
-- ============================================
-- 背景：
--   原 users_select_own 策略只允许 auth.uid() = id，
--   导致 timeline_members.users(username) 关系 join 时
--   其他成员的 username 被 RLS 过滤为 null，
--   前端"管理赛队"成员列表全部显示成"未知"。
--
--   本迁移新增一条策略：当目标 user 与当前用户
--   共享至少一个 timeline（owner 或 member）时，
--   允许 SELECT 对方的 username。
--
-- 影响：
--   users 表只有 id / username / created_at 三个字段，
--   不存在敏感数据；范围限制在同一赛队成员之间。

CREATE POLICY "users_select_team_members" ON public.users
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.timeline_members me
      JOIN public.timeline_members them
        ON them.timeline_id = me.timeline_id
      WHERE me.user_id    = auth.uid()
        AND them.user_id  = users.id
    )
  );
```

**为什么用自连接而不是 `OR owner_id`**
- 更通用：不仅覆盖"owner 与 member"，也覆盖"member 与 member"。
- 不需要重复 owner 判定，逻辑更短。
- 性能：`(timeline_id, user_id)` 已经有 `UNIQUE` 索引（schema 第 30 行），自连接的两次 `user_id` 过滤都能走索引。

### 2. 同步更新 `README.md` 部署说明

在 README 的"数据库 Schema"小节末尾追加一条说明，告知用户在已部署项目上需要补跑 `003_users_select_team_members.sql`，否则"管理赛队"会一直显示「未知」。**新增内容直接接在 `RLS 策略：…` 那段后面**（约第 132 行后）：

```markdown
### 重要：跨版本升级需补跑迁移

如果你的 Supabase 项目部署在 `001_initial_schema.sql` + `002_storage_and_functions.sql` 之后，
请**额外**在 SQL Editor 中执行 `003_users_select_team_members.sql`：

- 修复"管理赛队"成员列表只显示自己、其他人显示「未知」的问题。
- 原因：`users` 表的 RLS 策略过严，限制关联 join 只能取到当前用户。
- 新部署的用户（依次跑 001/002/003）无需额外操作。
```

### 3. **不需要改的 JS 代码**
- `getTimelineMembers` 的查询语法 `select('*, users(username)')` 是正确的，无需修改。
- `handleManageTeam` 的渲染 fallback `'未知'` 保留，作用是真正的"用户不存在/被删"边界情况兜底。
- 没有前端代码需要触碰。

## Assumptions & Decisions
1. **使用新的迁移文件而不是修改 001** —— 历史部署的项目需要可重放；新建 003 是零风险操作。
2. **采用自连接策略而不是开放 `users` 给所有已登录用户** —— 最小权限原则；陌生人仍然不能枚举用户名。
3. **不动 frontend 防御性 fallback（"未知"）** —— 那是数据真的缺失时的兜底，去掉反而会暴露内部错误。
4. **不引入 RPC / serverless function** —— 增加复杂度、收益微乎其微；RLS 改动更直接。
5. **owner 自动是 member** —— migration 001 的 `handle_new_timeline` trigger（第 201-217 行）已经把 owner 写入 `timeline_members`，所以 owner 与 member 的可见性策略是同一套，不需要额外分支。

## Verification Steps

### 准备
1. 在 Supabase Dashboard → SQL Editor 依次执行（如果是从零部署）：
   ```
   001_initial_schema.sql
   002_storage_and_functions.sql
   003_users_select_team_members.sql
   ```
2. 如果是历史项目已运行 001/002，**只补跑 003**。

### 功能验证
1. 用账号 A 登录 → 创建赛队时间轴 → 记下邀请码。
2. 用账号 B 登录 → 用邀请码加入赛队。
3. 切回账号 A → 顶部用户菜单 → 「管理赛队」。
4. **预期**：「成员列表」同时显示 A 和 B 的真实用户名，且角色分别为「所有者」/「成员」。
5. 再注册一个账号 C 加入赛队，重复验证，预期 3 行都能正确显示。
6. 账号 A 移除 B 后，列表应只显示 A 和 C。

### RLS 边界验证（可选但推荐）
- 在 Supabase SQL Editor 临时以 `anon` / 普通已登录用户身份执行：
  ```sql
  select id, username from public.users;   -- 应仅返回自己
  ```
  确认 RLS 仍按"同队可见"生效，未被错误放成全表可读。

### 回归验证
- 重新登录后成员列表依然正确（验证 RLS 缓存与 session 一致）。
- "移除成员"按钮在非 owner 视角下不出现（逻辑位于 [`src/js/app.js:969-971`](file:///workspace/src/js/app.js#L969-L971)，不受本次改动影响）。
- 时间轴下拉切换、记录增删等既有功能保持正常。
