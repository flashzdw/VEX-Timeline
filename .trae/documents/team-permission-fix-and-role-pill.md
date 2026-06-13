# 赛队权限系统修复 + 成员角色胶囊

## Summary

**两个问题**：
1. **前端权限判定错误**：app.js 中 `canEditRecord` 被定义了**两次**，后定义的"用户ID匹配版"覆盖了正确的"角色感知版"。导致赛队内 captain/teacher 成员对自己**没有 owner** 的赛队里的所有记录都看不到编辑/删除按钮。
2. **成员角色缺少胶囊显示**：管理赛队弹窗的成员列表里，每个成员名后只有"身份胶囊"（学生/老师/家长），没有"角色胶囊"（所有者/队长/老师/队员/访客）。非可管理时只显示一个灰色文本，没有视觉上的角色归属感。

**修复后效果**：
- 赛队内成员按其角色（owner/captain/teacher/member/visitor）拥有对应的编辑/删除/管理成员权限（前端 UI + 后端 RLS 双重放权，RLS 已经在 migration 005 处理好）
- 成员列表每行显示两个胶囊：身份胶囊（学生/老师/家长）+ 角色胶囊（所有者/队长/老师/队员/访客），与现有身份胶囊风格完全一致

---

## Current State Analysis

### Bug 1: 重复定义的 `canEditRecord` 覆盖正确版本

[`src/js/app.js:591-599`](file:///workspace/src/js/app.js#L591-L599) 定义了**正确**的角色感知版本：

```js
canEditRecord(record) {
  const r = this._currentTimelineRole;
  if (!r) return true;           // 个人时间轴
  if (r === 'visitor') return false;
  if (r === 'member') {
    return record?.user_id === authManager.getCurrentUser()?.id;  // member 仅自己
  }
  return true;                   // owner / captain / teacher 任意
}
```

但 [`src/js/app.js:2683-2691`](file:///workspace/src/js/app.js#L2683-L2691) 又定义了一个**错误**版本：

```js
canEditRecord(record) {
  if (!this.currentTimelineId) return false;
  if (!authManager.isLoggedIn()) return true;
  const current = this.timelines.find(t => t.id === this.currentTimelineId);
  if (!current) return true;
  if (current.owner_id === authManager.getCurrentUser()?.id) return true;   // 仅自己创建的赛队
  if (record.user_id === authManager.getCurrentUser()?.id) return true;     // 仅自己的记录
  return false;
}
```

ES6 class 中后定义的方法会覆盖前者。`renderView` 在 [`src/js/app.js:2626`](file:///workspace/src/js/app.js#L2626) 调用 `this.canEditRecord(record)`，实际执行的是 L2683 的"用户ID匹配版"。

**结果**：用户作为 captain/teacher 加入**别人创建的赛队**时，所有人（owner 除外）发布的记录都看不到编辑/删除按钮。

后端 RLS（[`supabase/migrations/005_member_management_rls.sql`](file:///workspace/supabase/migrations/005_member_management_rls.sql)）已经正确放权（owner/captain/teacher/member 可改 records），是前端 UI 把按钮隐藏了。

`canDeleteRecord` 只有一处定义（[`app.js:601-603`](file:///workspace/src/js/app.js#L601-L603)），它转调 `canEditRecord`，所以自动跟着修好。

### Bug 2: 成员列表缺少角色胶囊

[`handleManageTeam`](file:///workspace/src/js/app.js#L1815-L1939) 和 [`_refreshMembersList`](file:///workspace/src/js/app.js#L1941-L2029) 渲染成员行时：

- 显示名 + 身份胶囊（[`app.js:1865-1867`](file:///workspace/src/js/app.js#L1865-L1867)）
- 角色区域：
  - **可管理 + 非 owner** → 下拉选择（[`app.js:1870-1873`](file:///workspace/src/js/app.js#L1870-L1873)）
  - **不可管理 / owner 行** → 灰色文本（[`app.js:1874-1876`](file:///workspace/src/js/app.js#L1874-L1876)），没有胶囊样式

用户期望：每个成员名后跟两个胶囊，第二个是角色（"所有者" / "队长" / "老师" / "队员" / "访客"），样式与现有 `.vx-member-identity-tag` 风格一致（`border-radius: 9999px`、`height: 20px`、`padding: 0 8px`、uppercase 10px 字）。

i18n 键 [`app.team.roleOwner/Captain/Teacher/Member/Visitor`](file:///workspace/src/js/i18n.js#L214-L218) 已就位，无需新增。

### 现有色板（[`styles.css:21-27`](file:///workspace/src/css/styles.css#L21-L27)）

```css
--color-primary:    #3B82F6;  /* blue-500   */
--color-secondary:  #10B981;  /* emerald-500 */
--color-accent:     #F59E0B;  /* amber-500  */
--color-muted:      #F3F4F6;  /* gray-100   */
--color-danger:     #EF4444;  /* red-500    */
```

5 种角色需要 5 个独立色，缺一个紫色。新增一个 CSS 变量 `--color-role-captain`。

---

## Proposed Changes

### 1. 修复重复 `canEditRecord`（仅一处）

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js)

**操作**：删除 [`L2683-L2691`](file:///workspace/src/js/app.js#L2683-L2691) 的整个错误版本（包含其上方注释）。

```js
// 整段删除 ↓
/** 编辑/删除记录的权限判定（基于赛队角色） */
canEditRecord(record) {
  if (!this.currentTimelineId) return false;
  if (!authManager.isLoggedIn()) return true;
  const current = this.timelines.find(t => t.id === this.currentTimelineId);
  if (!current) return true;
  if (current.owner_id === authManager.getCurrentUser()?.id) return true;
  if (record.user_id === authManager.getCurrentUser()?.id) return true;
  return false;
}
```

**为什么**：L591-L599 的角色感知版本是正确实现，保留它；后定义的错误版本覆盖了它，导致整个角色权限系统失效。

**怎么验证**：
- 在 `renderView` 中调用 `canEditRecord` 时，对 captain/teacher/member 角色返回正确值
- `canDeleteRecord` 自动跟随（它内部调用 `canEditRecord`）

### 2. 新增角色胶囊 CSS

**文件**：[`src/css/styles.css`](file:///workspace/src/css/styles.css)

**操作**：在现有 `.vx-member-identity-tag--parent` 规则（[`L231`](file:///workspace/src/css/styles.css#L231)）之后追加：

```css
/* ----- 成员角色胶囊（赛队级二级权限） ----- */
.vx-member-name .vx-member-role-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  margin-left: 0.35rem;             /* 与身份胶囊之间稍近一点（0.5rem 改为 0.35rem） */
  padding: 0 8px;
  border-radius: 9999px;
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  vertical-align: middle;
}
.vx-member-name .vx-member-role-tag--owner    { background: var(--color-danger);    color: #fff; }
.vx-member-name .vx-member-role-tag--captain  { background: #8B5CF6;                 color: #fff; }  /* 紫色 */
.vx-member-name .vx-member-role-tag--teacher  { background: var(--color-accent);     color: #fff; }
.vx-member-name .vx-member-role-tag--member   { background: var(--color-primary);    color: #fff; }
.vx-member-name .vx-member-role-tag--visitor  { background: var(--color-muted);      color: var(--color-fg); }
```

并在 [`L21-L27`](file:///workspace/src/css/styles.css#L21-L27) 浅色变量区块补：
```css
--color-role-captain: #8B5CF6;       /* 紫色 - 队长 */
```

在 [`L68-L75`](file:///workspace/src/css/styles.css#L68-L75) 深色变量区块补：
```css
--color-role-captain: #A78BFA;       /* 紫色 浅色变体 - 队长 */
```

并把上面 `.vx-member-role-tag--captain` 的硬编码 `#8B5CF6` 改为 `var(--color-role-captain)`，让暗色模式自动适配。

### 3. 修改成员行渲染逻辑（两处）

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js)

**改动 1**：[`handleManageTeam` L1862-L1889](file:///workspace/src/js/app.js#L1862-L1889)

将 `roleSelectHtml` 三元逻辑改为：

```js
const currentRoleLabel = roleLabel[member.role] || member.role;
let roleCellHtml;
if (member.role === 'owner') {
  // owner 行：永远显示胶囊（不显示下拉 / X 按钮）
  roleCellHtml = `<span class="vx-member-role-tag vx-member-role-tag--owner">${this._escapeHtml(currentRoleLabel)}</span>`;
} else if (canManage) {
  // 可管理：显示下拉
  roleCellHtml = `
    <select class="vx-role-select" data-user-id="${member.user_id}">
      ${ROLE_OPTIONS.map(r => `<option value="${r}" ${r === member.role ? 'selected' : ''}>${this._escapeHtml(roleLabel[r] || r)}</option>`).join('')}
    </select>
  `;
} else {
  // 不可管理 + 非 owner：显示角色胶囊
  roleCellHtml = `<span class="vx-member-role-tag vx-member-role-tag--${member.role}">${this._escapeHtml(currentRoleLabel)}</span>`;
}
const removeBtnHtml = (canManage && !isOwnerRow) ? `
  <button class="vx-member-remove-btn" data-user-id="${member.user_id}" ...>...</button>
` : '';
return `
  <div class="vx-member-row">
    <div class="vx-member-name">${displayName}${identityTag}<span class="vx-member-role-tag vx-member-role-tag--${member.role}">${this._escapeHtml(currentRoleLabel)}</span></div>
    ${roleCellHtml}
    ${removeBtnHtml}
  </div>
`;
```

**注意**：胶囊**在 .vx-member-name 内部**追加（而不是替换为 roleCellHtml 之前的灰色文本），这样每个成员名后面有身份 + 角色**两个胶囊**并排显示。

**改动 2**：[`_refreshMembersList` L1965-L1992](file:///workspace/src/js/app.js#L1965-L1992) — 同样的三态分支（owner 胶囊 / 可管理下拉 / 不可管理胶囊），与改动 1 保持一致。

**为什么**：把现有灰色文本升级为胶囊，并把 owner 行的胶囊永远显示，响应用户的"在后面展示一个浮窗 / 圆形胶囊"的需求。

### 4. 验证脚本

**文件**：新增 [`/workspace/.permission-check.js`](file:///workspace/.permission-check.js)

模拟 4 种场景，验证 `canEditRecord`：

| 场景 | `currentTimelineId` | `_currentTimelineRole` | `record.user_id` | `authManager.getCurrentUser().id` | 期望返回值 |
|---|---|---|---|---|---|
| 1. 自己创建赛队，captain 编辑别人记录 | team-x | 'captain' | 别人 | 我 | true |
| 2. 自己加入别人赛队，captain 编辑别人记录 | team-x (别人建) | 'captain' | 别人 | 我 | **true**（修复后）|
| 3. member 编辑自己记录 | team-x | 'member' | 我 | 我 | true |
| 4. member 编辑别人记录 | team-x | 'member' | 别人 | 我 | false |
| 5. visitor 编辑 | team-x | 'visitor' | 别人 | 我 | false |
| 6. 个人时间轴 | personal | null | 任意 | 我 | true |

并验证成员列表渲染输出包含 `vx-member-role-tag--owner` / `--captain` / `--member` 等 class。

---

## Assumptions & Decisions

1. **`canEditRecord` 错误版本（L2683）应整段删除**而非修复 — 因为 L591 已经是正确实现，保留 L591 即可。决策依据：删比改更安全（避免双定义再次产生覆盖问题）。

2. **owner 行**永远显示"所有者"胶囊（不显示下拉 / X 按钮），与"赛队创建者不可被改"的业务规则一致。

3. **角色胶囊的色板**遵循用户选择："每角色一种独立色"，映射：
   - owner → `--color-danger` (红，独占感)
   - captain → `#8B5CF6` (紫，独有)
   - teacher → `--color-accent` (琥珀)
   - member → `--color-primary` (蓝，主色)
   - visitor → `--color-muted` (灰)

4. **CSS 变量**新增 `--color-role-captain` 浅/深双版本（不直接硬编码），便于暗色模式自动适配。

5. **不动后端 RLS** — 005 迁移已经放权，无需新增 SQL 迁移。

6. **i18n 不动** — `app.team.roleOwner/Captain/Teacher/Member/Visitor` 5 个键已存在（[`i18n.js:214-218`](file:///workspace/src/js/i18n.js#L214-L218)），中英文都齐。

7. **不动 record 渲染逻辑** — 只需确保 `canEditRecord` 返回正确值，UI 自然正确（[`renderView L2626`](file:///workspace/src/js/app.js#L2626) 已经按返回值决定是否渲染编辑/删除按钮）。

---

## Verification

执行以下步骤验收：

1. **静态检查** — 跑现有 4 个回归测试（不应有 regression）：
   ```bash
   node .display-name-check.js
   node .profile-check.js
   node .old-user-check.js
   node .bug-check.js
   ```

2. **新增权限测试** — 跑新的 permission-check：
   ```bash
   node .permission-check.js
   ```
   期望：6 个场景全部通过，输出 `=== PERMISSION CHECK PASSED (6/6) ===`。

3. **成员列表渲染测试** — 在 permission-check.js 中追加断言：
   - 模拟 owner + captain + member + visitor 各一个成员
   - 调用 `handleManageTeam`（或直接调用内部渲染）
   - 断言生成的 HTML 包含 4 个 `vx-member-role-tag`（owner/captain/member/visitor 各一），且 owner 行不含 `vx-role-select`。

4. **手动验证**（用户）：在浏览器中
   - 加入别人的赛队，验证现在能看到所有人记录的编辑/删除按钮
   - 打开管理赛队弹窗，验证每个成员名后有"身份胶囊 + 角色胶囊"两个并排胶囊
   - 切换中英文，验证 5 个角色的胶囊文案正确翻译

---

## Files Changed

| 文件 | 改动类型 | 行数估算 |
|---|---|---|
| `src/js/app.js` | 删 9 行（错版 canEditRecord），改 ~30 行（两处成员渲染） | -9 +30 = +21 |
| `src/css/styles.css` | 新增 16 行（5 角色胶囊 + 2 变量） | +16 |
| `.permission-check.js` | 新建 | +90（仅测试用） |
