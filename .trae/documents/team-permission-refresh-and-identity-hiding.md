# 赛队权限刷新 & 身份胶囊隐藏

## Summary

当前存在 3 个明确的赛队协作问题：

1. **队员权限不足**：赛队中担任 `member` 角色的用户目前只能修改/删除自己发布的记录（前端 `canEditRecord` + RLS `records_update_privileged`/`records_delete_privileged` 双重限制），无法编辑队友的记录。预期行为：队员和队长/老师一样，可以改/删赛队内任何记录（因为他们已经能看到所有时间轴）。
2. **云朵刷新不刷权限**：右上角（以及移动端抽屉里）的云朵刷新按钮只调用 `syncFromCloud()`，该方法只拉取 records、不知道重新加载 `timeline_members.role`。所以队长在另一个端调整了你的角色后，你需要等很久（手动切时间轴 / 重新登录 / 同步队列重试触发的副作用）才会生效。
3. **身份胶囊语义错误**：注册时选择的"一级权限"（`users.identity` = student/teacher/parent）只是给队长一个粗略的参考，**真正决定权限的是"二级权限"**（`timeline_members.role`）。队长给出二级权限后，成员列表里就不应该再显示一级身份胶囊了。

## Current State Analysis

### 1. 队员权限的 RLS 限制

`/workspace/supabase/migrations/005_member_management_rls.sql` L67-76（UPDATE）和 L83-94（DELETE）：

```sql
CREATE POLICY "records_update_privileged" ON public.records
  FOR UPDATE USING (
    user_id = auth.uid()              -- ← 这条 member 限制太严
    AND EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );
```

`records_insert_non_visitor` (L50-58) 没有这条限制，所以 member 一直能 INSERT。

### 2. 前端 `canEditRecord` 同步收紧

`/workspace/src/js/app.js` L591-599：

```js
canEditRecord(record) {
  const r = this._currentTimelineRole;
  if (!r) return true; // 个人时间轴
  if (r === 'visitor') return false;
  if (r === 'member') {
    return record?.user_id === authManager.getCurrentUser()?.id;  // ← 同样要放开
  }
  return true; // owner / captain / teacher
}
```

`canDeleteRecord` (L601-603) 直接复用 `canEditRecord`，自动跟随。

### 3. `syncFromCloud` 不刷角色

`/workspace/src/js/app.js` L713-737：

```js
async syncFromCloud() {
  // ...
  try {
    const cloudRecords = await cloudDBManager.pullAllData(this.currentTimelineId);
    await dbManager.replaceRecordsForTimeline(...);
    await this.processSyncQueue();
    await this.renderView();
    this.cloudSyncStatus = 'ok';
  } catch (e) { ... }
  // 缺：await this._loadCurrentTimelineRole()
  // 缺：this.updateManageButton() / 重渲染成员胶囊 / 重新评估按钮可见性
}
```

桌面云朵按钮 (`/workspace/src/js/app.js` L992) 和移动云朵按钮 (`/workspace/src/js/app.js` L1057) 都只调 `syncFromCloud()`，所以**改一处就够**。

`_loadCurrentTimelineRole()` 在 L569-582 定义，会从 `cloudDBManager.getMemberRole` 读最新角色并写到 `this._currentTimelineRole`。

`updateManageButton()` 在 L549 定义，会刷新「管理赛队」按钮的可见性。其它依赖 `_currentTimelineRole` 的地方（`canAddRecord`/`canEditRecord`/`canManageMembers`）在重新 `renderView()` 后会自动用新值。

### 4. 成员列表的身份胶囊

两处渲染同款 `identityTag` 模板字符串：

- `app.js` L2170-2172（`handleManageTeam` 创建/打开弹窗时一次性渲染）→ L2189 拼接
- `app.js` L2273-2275（`_refreshMembersList` 改完角色后局部刷新）→ L2292 拼接

`identity` 字段在个人设置（`openProfileSettingsModal`）和顶栏（个人时间轴下拉头像旁的身份标识）里仍然要用，**不能动**。只在**成员列表**（赛队弹窗）里去掉。

## Proposed Changes

### 改动 1：新增 SQL migration 009，放开 member 写权限

**新建** `/workspace/supabase/migrations/009_member_full_record_access.sql`：

```sql
-- ============================================
-- VEX-Timeline: 放开 member 对赛队内记录的写权限
-- ============================================
-- 背景：
--   原 005_member_management_rls.sql 把 member 限定为「仅可改/删自己发布的记录」。
--   实际上赛队中的 member 应当可以访问（看到）和维护整个赛队的时间轴，
--   即可以改/删任何人的记录（与 owner/captain/teacher 等权）。
--   visitor 仍然没有任何写权限。
-- ============================================

-- ------------------------------------------
-- 1. records: member 放开 UPDATE 限制
-- ------------------------------------------
DROP POLICY IF EXISTS "records_update_privileged" ON public.records;

CREATE POLICY "records_update_privileged" ON public.records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );

-- ------------------------------------------
-- 2. records: member 放开 DELETE 限制
-- ------------------------------------------
DROP POLICY IF EXISTS "records_delete_privileged" ON public.records;

CREATE POLICY "records_delete_privileged" ON public.records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_id = records.timeline_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'captain', 'teacher', 'member')
    )
  );
```

**Why**：必须服务端放权。前端放宽 `canEditRecord` 但 RLS 不放，对其它端/直连 Supabase 仍然会被拒。

### 改动 2：前端 `canEditRecord` 放开 member

`/workspace/src/js/app.js` L591-599，删除 member 特判分支：

```js
canEditRecord(record) {
  const r = this._currentTimelineRole;
  if (!r) return true; // 个人时间轴
  if (r === 'visitor') return false;
  return true; // owner / captain / teacher / member 均可
}
```

**Why**：和 RLS 009 对齐；`canDeleteRecord` 已经复用 `canEditRecord`，自动跟随。

### 改动 3：云朵刷新同步重载角色

`/workspace/src/js/app.js` `syncFromCloud` L713-737，在 `processSyncQueue` 之后、`renderView` 之前（或之后也行，因为角色只影响按钮可见性）插入：

```js
async syncFromCloud() {
  if (!authManager.isLoggedIn() || !supabaseManager.isConfigured() || !this.currentTimelineId) return;
  if (this.syncInProgress) return;
  this.syncInProgress = true;
  this.updateCloudStatusIcon();

  try {
    const cloudRecords = await cloudDBManager.pullAllData(this.currentTimelineId);
    await dbManager.replaceRecordsForTimeline(this.currentTimelineId, cloudRecords.map(r => ({
      ...r,
      timeline_id: r.timeline_id,
      cloud_id: r.id
    })));
    await this.processSyncQueue();
    // ★ 新增：刷新当前赛队角色 + 角色相关的 UI
    await this._loadCurrentTimelineRole();
    this.updateManageButton();
    await this.renderView();
    this.cloudSyncStatus = 'ok';
  } catch (e) {
    this.cloudSyncStatus = 'error';
    this.cloudErrorMessage = e.message || String(e);
    console.warn('[VEX-Timeline] syncFromCloud failed:', e);
  }

  this.syncInProgress = false;
  this.updateCloudStatusIcon();
}
```

**Why**：
- `_loadCurrentTimelineRole` 重新从 `cloudDBManager.getMemberRole` 读 `timeline_members.role`，写回 `this._currentTimelineRole`。
- `updateManageButton` 立刻让「管理赛队」按钮按新角色显示/隐藏。
- `renderView` 会让时间轴视图里所有依赖 `canEditRecord`/`canDeleteRecord`/`canAddRecord` 的按钮按新角色重画（编辑/删除/添加 按钮）。
- 放在 `try` 块内：角色加载失败时不会让 records 同步整体回滚到 error（成员管理弹窗里 `getMemberRole` 失败也只是 `null`，`renderView` 会用旧值兜底）。

### 改动 4：成员列表不显示身份胶囊

**a)** `/workspace/src/js/app.js` L2170-2172，删除 `identityTag` 变量定义及上方注释：

```diff
   membersList.innerHTML = sortedMembers.map(member => {
     const user = member.users || {};
     const displayName = this._escapeHtml(this.getFullDisplayName(user));
-    const identityTag = user.identity
-      ? `<span class="vx-member-identity-tag vx-member-identity-tag--${user.identity}">${user.identity === 'student' ? this._i18n('auth.identity.student', '学生') : user.identity === 'teacher' ? this._i18n('auth.identity.teacher', '老师') : this._i18n('auth.identity.parent', '家长')}</span>`
-      : '';
     const isOwnerRow = member.role === 'owner';
     const currentRoleLabel = roleLabel[member.role] || member.role;
     const roleTag = `<span class="vx-member-role-tag vx-member-role-tag--${member.role}">${this._escapeHtml(currentRoleLabel)}</span>`;
```

L2189 行同步去掉 `${identityTag}`：

```diff
-    <div class="vx-member-name">${displayName}${identityTag}${roleTag}</div>
+    <div class="vx-member-name">${displayName}${roleTag}</div>
```

**b)** `/workspace/src/js/app.js` L2273-2275、L2292，同上对称删除。

**Why**：用户原话"队长给出之后，一级权限的标签就不显示了"。成员列表是赛队语境，二级权限（`role`）才是这个列表的真正维度；个人设置/顶栏里的身份胶囊（个人语境，标识「我」是谁）保留不动。

### 改动 5（可选验证）：扩展 jsdom 测试

`/workspace/tests/permission-check.js` 补充：
- `assert(canEditRecord({user_id: 'other'}) === true, 'member 可改他人记录')`
- `assert(canDeleteRecord(...) === true, 'member 可删他人记录')`

`/workspace/tests/refresh-check.js`（或合并到现有套件）：
- mock `cloudDBManager.getMemberRole` 返回新值；调用 `syncFromCloud`；断言 `this._currentTimelineRole === '新值'`

`/workspace/tests/member-list.test.js`（或合入 `team-modal.test.js`）：
- mock 一个 team timeline + 2 个 member；open 成员管理；断言渲染出的 HTML 中**不**含 `vx-member-identity-tag`。

## Assumptions & Decisions

1. **member 与 owner/captain/teacher 等权**（都可以改/删赛队内任何记录）。用户原话："队员可以访问所有的时间轴，可以进行编写的或者是修改的"。`canManageMembers` 仍维持只对 owner/captain/teacher 开放 — member 不能调整其他成员的角色（成员管理弹窗里的角色下拉仍然对 member 不可见）。
2. **个人时间轴下不显示身份胶囊**这条不受影响 — 个人时间轴本来就不在成员列表里，规则不变。
3. **个人设置弹窗 / 顶栏头像旁的身份标识保持显示**。它们是「我」的语境，不属于"成员列表"语义。
4. **RENAME 不做**：`vx-member-identity-tag` 的 CSS 保留（`/workspace/src/css/styles.css` L216-234），不动其它可能用到它的地方（目前 grep 确认只有上面两处用到，CSS 类会变成孤儿类，但保留不影响渲染体积）。
5. **不在 `syncFromCloud` 里重启整个 `renderView`**，只补 `_loadCurrentTimelineRole` + `updateManageButton` + 已有的 `renderView`。已经够用。
6. **不引入手动刷新角色按钮** — 用户原话指明是"云朵刷新"要刷权限，加在云朵的语义下最自然。
7. **后端用一次性 migration 009**，不引入 RPC，不修改 005 本身（005 已经上线，不能改历史）。

## Verification

按以下顺序手动验证 + 跑测试：

1. **SQL**：登录 Supabase SQL Editor 执行 `009_member_full_record_access.sql`，确认无错误，`SELECT * FROM pg_policies WHERE tablename = 'records'` 中 `records_update_privileged`/`records_delete_privileged` 的 USING 子句不再含 `user_id = auth.uid()` 顶级谓词。
2. **队员改他人记录**：用 A 账号加入 B 的赛队 → B 把 A 设成 `member` → B 发布一条记录 → A 打开云朵刷新 → A 应该看到 B 的记录上出现"编辑"和"删除"按钮（之前没有）；点编辑能保存；点删除能删；后端不再返回 RLS 错误（看 DevTools Network）。
3. **云朵刷新刷权限**：用 A 账号打开 B 的赛队（角色 = member）→ 在另一个浏览器用 owner 把 A 改回 `teacher`（或踢出）→ 回到 A，点云朵 → toast 「正在从云端刷新…」结束后，A 的管理赛队按钮 / 编辑按钮 / 角色选择下拉应立即按新角色显示/隐藏。
4. **成员列表无身份胶囊**：在赛队弹窗里查看成员列表，断言每个成员行不再有"学生/老师/家长"小色块，只剩「角色」胶囊。
5. **个人语境保留**：打开个人设置 → "身份" tab 仍可选 student/teacher/parent；顶栏头像旁的身份标识仍显示。
6. **回归**：个人时间轴下，「管理赛队」按钮仍不显示；owner 仍能删除整个赛队；visitor 仍不能改任何记录。
7. **跑测试**：`npm test`（或 `node tests/run.js`），所有原有 + 新加的 case 都过。

## Files Touched

- **新增** `/workspace/supabase/migrations/009_member_full_record_access.sql`
- **修改** `/workspace/src/js/app.js`（4 处）
  - L591-599 `canEditRecord` 删 member 分支
  - L713-737 `syncFromCloud` 末尾加 `_loadCurrentTimelineRole` + `updateManageButton`
  - L2170-2172 + L2189 `handleManageTeam` 成员渲染删 `identityTag`
  - L2273-2275 + L2292 `_refreshMembersList` 成员渲染删 `identityTag`
- **可能修改**（视需要）`/workspace/tests/permission-check.js`、`/workspace/tests/team-modal.test.js` 等测试
- **不动**：`/workspace/src/css/styles.css`（保留孤儿类）、`/workspace/src/js/i18n.js`（键已就位）、个人设置弹窗、顶栏、RLS 005 迁移。
