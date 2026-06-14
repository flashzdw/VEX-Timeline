# VEX-Timeline UI 收尾打磨

## 摘要

继续打磨鉴权 + 团队管理流程的剩余 6 个 UX 细节：
1. 修正 `getDisplayName` 优先级，让"昵称"成为主要显示名（当前被 `real_name` 顶替）
2. 在成员列表 / 用户菜单下拉里用 "昵称 (真实姓名)" 双行展示
3. 隐藏个人时间轴下的"管理赛队"相关入口（已部分实现，确认无残留弹窗）
4. 修中英文切换时整页左右抽动（用 `scrollbar-gutter: stable` + 切语按钮的 loading 微态）
5. 修成员列表里身份标签与昵称垂直居中 + 角色 `<select>` 倒三角离右边框太近
6. 一级权限新增"家长（parent）"身份，注册表单 + 完善资料弹窗同步新增第三按钮

## 现状分析

| 文件 | 现状 | 引用 |
|---|---|---|
| [`src/js/app.js#L500-L508`](file:///workspace/src/js/app.js#L500-L508) `getDisplayName` | 优先级 real_name → nickname → username | 用户主诉"真实姓名顶替了昵称"的根因 |
| [`src/js/app.js#L513-L520`](file:///workspace/src/js/app.js#L513-L520) `updateUserMenu` | 顶栏 `#user-name` / 抽屉 `#user-menu-name` 都用 `getDisplayName` | 需要根据位置用不同格式 |
| [`src/js/app.js#L1800-L1825`](file:///workspace/src/js/app.js#L1800-L1825) 成员列表渲染 | `displayName` 用 `getDisplayName(user)`，身份标签是 `vx-member-identity-tag` | 成员列表也要走"昵称 (真实姓名)"格式 |
| [`src/js/app.js#L522-L533`](file:///workspace/src/js/app.js#L522-L533) `updateManageButton` | 已是 `!isTeam → hidden`（`isTeam = current?.type === 'team'`） | 个人时间轴已经隐藏 |
| [`src/js/app.js#L804-L818`](file:///workspace/src/js/app.js#L804-L818) `toggleLang` | 直接 `setLanguage` + `_refreshAppOnLangChange`，无防抖 / 视觉反馈 | 抽动来源：内容宽度变化 → 滚动条出现/消失 → 整页横移 |
| [`src/css/styles.css#L182-L215`](file:///workspace/src/css/styles.css#L182-L215) `.vx-member-row` / `.vx-member-name` / `.vx-member-identity-tag` | `.vx-member-row` 是 flex `align-items: center`；`.vx-member-name` 是 div + 内部 `<span>`（inline-block）`vertical-align: middle` | 14px 文本 + 10px 标签，line-height 不同 → 标签视觉偏高 |
| [`src/css/styles.css#L217-L238`](file:///workspace/src/css/styles.css#L217-L238) `.vx-role-select` | `padding: 0 0.5rem` 8px，`<select>` 系统倒三角在右内侧 | 倒三角贴边 |
| [`supabase/migrations/004_user_profile_and_role_expansion.sql#L29`](file:///workspace/supabase/migrations/004_user_profile_and_role_expansion.sql#L29) `users.identity` | `CHECK (identity IN ('student', 'teacher'))` | 缺 'parent' |
| [`supabase/migrations/006_auth_trigger_and_complete_profile.sql`](file:///workspace/supabase/migrations/006_auth_trigger_and_complete_profile.sql) `complete_profile` RPC | RPC 校验 `identity IN ('student', 'teacher')` | 缺 'parent' 校验分支 |
| [`index.html#L598-L603`](file:///workspace/index.html#L598-L603) 注册身份按钮 | `grid-cols-2` 两按钮（student/teacher） | 要变 3 按钮 |
| [`index.html#L661-L666`](file:///workspace/index.html#L661-L666) 完善资料身份按钮 | 同上 | 要变 3 按钮 |
| [`src/js/app.js#L1378-L1425`](file:///workspace/src/js/app.js#L1378-L1425) `_bindIdentityPicker` | 硬编码 student / teacher 两个按钮 | 要加 parent + 三角布局自动适配 |
| [`src/js/i18n.js#L115-L118`](file:///workspace/src/js/i18n.js#L115-L118) `auth.identity.*` | 只有 student / teacher | 缺 parent |

## 计划变更

### 1. 重写 `getDisplayName` + 新增 `getFullDisplayName`

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js)

```js
// 短显示名：仅昵称（用于头像、顶栏 user-name）
getDisplayName(u) {
  if (!u) return 'User';
  return u.nickname || u.username || 'User';
}

// 长显示名：昵称 (真实姓名)，用于成员列表 / 下拉菜单头部
getFullDisplayName(u) {
  if (!u) return 'User';
  const nick = u.nickname || u.username || 'User';
  if (u.real_name) {
    if (u.name_only_surname && u.identity === 'teacher') {
      return `${nick}（${u.real_name}老师）`;
    }
    return `${nick}（${u.real_name}）`;
  }
  return nick;
}
```

调用点替换：
- `updateUserMenu`：顶栏 `#user-name` 用 `getDisplayName`；下拉 `#user-menu-name` 用 `getFullDisplayName`
- 头像 `avatar.textContent` 用 `getDisplayName(u).charAt(0)`（保持首字母）
- 成员列表两处（行 1802、1905）改 `getFullDisplayName`
- 排序键也用 `getFullDisplayName`，保证 "张东炜" 和 "张东炜（张老师）" 排在一起

### 2. 个人时间轴隐藏管理赛队 + 清理残留

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js)

- `updateManageButton` 现有逻辑已正确（`!isTeam → hidden`）。
- 在 `handleTeamAction('manage')` 入口增加防御性检查：若 `!isTeam` 直接 return，防止极端情况被打开。
- 全局检索"switch to team"提示文案（`app.team.selectTeam`），若仍有调用点（行 1758）且仅在赛队时间轴才触发，符合"残留"语义则保留；若在个人时间轴会被触发，则加 `if (!isTeam) return;` 早返。

### 3. 修中英文切换抽动

**根因**：切换语言时 `data-i18n` 文本宽度变化 → 文档高度可能跨越滚动条阈值 → 浏览器自动加/去滚动条 → body 整体水平偏移约 15px。

**修法（双管齐下，按用户给的两个选项）**：

**文件 A**：[`src/css/styles.css`](file:///workspace/src/css/styles.css) — 末尾追加
```css
html { scrollbar-gutter: stable; }
```
让浏览器为滚动条预留固定 gutter，无论内容多高都不再出现/消失 → 解决抽动。

**文件 B**：[`src/js/app.js`](file:///workspace/src/js/app.js) `toggleLang` — 加视觉 loading 微态
```js
const toggleLang = () => {
  if (!window.i18n) return;
  const current = window.i18n.getLanguage();
  const next = current === 'zh-CN' ? 'en' : 'zh-CN';
  // 视觉反馈：在按钮上加 is-loading 类，60ms 后再切语言
  const btn = document.activeElement;
  if (btn && (btn.id === 'site-lang-toggle' || btn.id === 'app-lang-toggle')) {
    btn.classList.add('is-loading');
    btn.disabled = true;
  }
  // 推迟到下一帧让样式先生效，避免与抽动竞争
  requestAnimationFrame(() => {
    window.i18n.setLanguage(next);
    this._updateLangToggle();
    this._refreshAppOnLangChange();
    if (btn) {
      setTimeout(() => { btn.classList.remove('is-loading'); btn.disabled = false; }, 120);
    }
  });
};
```

**文件 C**：[`src/css/styles.css`](file:///workspace/src/css/styles.css) — 追加按钮 loading 样式
```css
.vx-lang-toggle.is-loading { opacity: 0.5; pointer-events: none; }
.vx-lang-toggle.is-loading::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 9999px;
  animation: vx-spin 0.6s linear infinite;
}
@keyframes vx-spin { to { transform: rotate(360deg); } }
```

### 4. 成员列表身份标签垂直居中

**文件**：[`src/css/styles.css`](file:///workspace/src/css/styles.css) 替换 `.vx-member-name` + 标签

```css
.vx-member-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 14px;
  line-height: 32px;          /* 显式锁定行高 = select 高度 */
  color: var(--color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vx-member-name .vx-member-identity-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;                /* 标签自身高度固定 */
  margin-left: 0.5rem;
  padding: 0 8px;
  border-radius: 9999px;
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-muted);
  color: var(--color-fg-muted);
  vertical-align: middle;      /* 在固定 line-height 容器内即可对齐 */
}
```
原理：父 `.vx-member-row` 是 flex `align-items: center` + 固定 32px 高（`padding: 0.625rem 0.75rem` ≈ 32px），标签 `inline-flex + height: 20px` + 文字 `line-height: 32px` 二者中心点重合。

### 5. 角色下拉倒三角离右框太近

**文件**：[`src/css/styles.css`](file:///workspace/src/css/styles.css) 替换 `.vx-role-select`

```css
.vx-role-select {
  height: 32px;
  padding: 0 1.75rem 0 0.5rem;     /* 右侧加 1.75rem 给系统倒三角留位 */
  background: var(--color-canvas, #fff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg);
  outline: none;
  cursor: pointer;
  appearance: none;                /* 移除系统默认外观以确保 padding 生效 */
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;   /* 倒三角位置：右内 8px */
  background-size: 12px 12px;
  transition: border-color 0.15s ease;
}
```
原理：原 `padding: 0 0.5rem` 两侧都是 8px，浏览器把系统倒三角紧贴右边框。加 `padding-right: 1.75rem` + 用 inline SVG 倒三角精确控制位置到 `right 0.5rem center`（距右边 8px），既留出文本呼吸空间也避免跨浏览器不一致。

### 6. 新增"家长（parent）"一级权限

#### 6.1 数据库迁移

**新文件**：[`supabase/migrations/008_add_parent_identity.sql`](file:///workspace/supabase/migrations/008_add_parent_identity.sql)
```sql
-- 1) users.identity CHECK 扩到 parent
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_identity_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_identity_check
  CHECK (identity IN ('student', 'teacher', 'parent'));

-- 2) complete_profile RPC 允许 parent（家长姓名仅 1 字符也接受，类似老师 surname-only 逻辑）
CREATE OR REPLACE FUNCTION public.complete_profile(
  p_nickname text,
  p_real_name text,
  p_name_only_surname boolean,
  p_identity text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;
  IF p_identity NOT IN ('student', 'teacher', 'parent') THEN
    RAISE EXCEPTION '身份必须是 student / teacher / parent';
  END IF;
  IF length(trim(p_real_name)) = 0 THEN
    RAISE EXCEPTION '真实姓名不能为空';
  END IF;
  -- 家长 / 老师仅填姓时，1 字符即可
  IF p_identity IN ('teacher', 'parent') AND p_name_only_surname THEN
    IF length(p_real_name) <> 1 THEN
      RAISE EXCEPTION '仅填姓时，姓名必须是 1 个字符';
    END IF;
  ELSIF p_identity = 'student' AND length(p_real_name) < 2 THEN
    RAISE EXCEPTION '学生姓名至少 2 个字符';
  ELSIF p_identity IN ('teacher', 'parent') AND length(p_real_name) < 2 THEN
    RAISE EXCEPTION '姓名至少 2 个字符';
  END IF;

  UPDATE public.users
     SET nickname         = trim(p_nickname),
         real_name        = trim(p_real_name),
         name_only_surname = COALESCE(p_name_only_surname, false),
         identity         = p_identity
   WHERE id = v_uid;
END;
$$;
```

#### 6.2 HTML 加第三按钮（注册 + 完善资料）

**文件**：[`index.html`](file:///workspace/index.html)

- 注册身份区（L597-L605）改 `grid-cols-3`，加 `<button id="auth-identity-parent" ...>家长</button>`
- 完善资料身份区（L660-L668）改 `grid-cols-3`，加 `<button id="profile-identity-parent" ...>家长</button>`
- 移动端 width ≤ 360px 时，CSS 媒体查询改回 `grid-cols-1`（按钮窄时换行避免压扁）

```css
@media (max-width: 360px) {
  .vx-identity-grid { grid-template-columns: 1fr; }
}
```

#### 6.3 JS picker 适配

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js) `_bindIdentityPicker`（L1378 起）

- 把 `studentBtn` / `teacherBtn` 改为数组 `[studentBtn, teacherBtn, parentBtn]`
- 循环绑定 click
- `setActive(btn, isActive)` 应用高亮类
- 默认值改 `this[stateKey] = 'student'`（保持不变）
- `surnameWrap` 可见条件：identity 切到 teacher 或 parent 都显示（家长单字姓也合理，比如"张先生"想用"张"）
- 在 `handleTeamAction` 不需要任何改动（parent 在赛队里的角色默认是 visitor，由 owner 在成员列表手动改）

#### 6.4 auth.js 注册 / 完成资料加 parent 校验

**文件**：[`src/js/auth.js`](file:///workspace/src/js/auth.js)

- L175 `identity !== 'student' && identity !== 'teacher'` 改为 `!['student','teacher','parent'].includes(identity)`
- L183 `if (identity === 'teacher')` 改为 `if (identity === 'teacher' || identity === 'parent')` 整段共享 surnameOnly 逻辑
- L300-L309 `completeProfile` 同步改

#### 6.5 i18n 加 `auth.identity.parent`

**文件**：[`src/js/i18n.js`](file:///workspace/src/js/i18n.js)
- 中文（L116 附近）：`'auth.identity.parent': '家长'`
- 英文（L434 附近）：`'auth.identity.parent': 'Parent'`

### 7. 团队角色枚举是否要加 parent？

**不增加**。`timeline_members.role` 仍是 `{owner, captain, teacher, member, visitor}`。家长身份的成员在赛队里默认是 `visitor`（仅查看），由队长/老师在成员列表手动改角色即可。这避免了两套枚举相互缠绕。

---

## 假设与决策

1. **"相关弹窗"** 解读为"个人时间轴下管理赛队相关的所有 UI 入口"。当前 `updateManageButton` 已经把 `#manage-team-btn` 和 `#mobile-manage-team-btn` 在个人时间轴隐藏；按钮隐藏后，无法打开 `#invite-modal`。本计划补一个防御性 early return，防止后续被新代码绕过。
2. **语言切换抽动**采用"修复 + 视觉反馈"双管齐下：CSS 层用 `scrollbar-gutter: stable` 一劳永逸；JS 层加 60ms 内的 `is-loading` 旋转动画作为视觉提示。用户给的"加加载按钮"和"解决抽动"两个选项我同时做了。
3. **家长身份不引入新团队角色**。保持团队角色枚举 5 个不变，家长在赛队里默认 visitor。
4. **家长仅填姓**逻辑与老师相同（姓 + 1 字符），checkbox 文案改为通用"仅填姓"（去掉"老师"前缀），由代码动态控制可见性。
5. **真实姓名为空时**，"昵称 (真实姓名)" 退化为只显示昵称，括号省略。
6. **不修改迁移 004/006 已有内容**（生产数据库已经跑过），新逻辑放迁移 008。

## 验证步骤

1. **静态检查**：`node -c src/js/app.js` && `node -c src/js/auth.js` && `node -c src/js/i18n.js`
2. **i18n 键完整性**：grep 确保 zh/en 都加了 `auth.identity.parent`
3. **更新两个 smoke test**：
   - `.profile-check.js` 加一行 `'auth.identity.parent'` 存在性
   - `.profile-check.js` 加一行 `getFullDisplayName` 存在性
   - 新增 `.display-name-check.js` 校验三种展示格式：
     - `getDisplayName({nickname:'小张', real_name:'张三'})` → `'小张'`
     - `getFullDisplayName({nickname:'小张', real_name:'张三'})` → `'小张（张三）'`
     - `getFullDisplayName({nickname:'小张', real_name:'三', identity:'teacher', name_only_surname:true})` → `'小张（三老师）'`
4. **视觉手动**：
   - 团队管理页：张东炜 (学生) 标签和"张东炜"垂直对齐
   - 角色下拉倒三角距右框约 8px
   - 切换中英文：无横移 + 按钮 0.6s 旋转
   - 注册表单 / 完善资料表单：3 按钮横向排列，"家长"也在
5. **数据库**：本地 `psql` 跑 `008_add_parent_identity.sql`，用 `supabase.from('users').update({identity:'parent'})` 测试通过
6. **回归**：未登录打开主应用、登录成功、个人时间轴下拉、赛队时间轴下拉、新建赛队、加入赛队、删除赛队、个人时间轴下不显示管理赛队

## 涉及文件清单

| 文件 | 类型 | 改动 |
|---|---|---|
| `src/js/app.js` | 改 | `getDisplayName` / `getFullDisplayName`、`updateUserMenu` 改用不同格式、成员列表 2 处、`_bindIdentityPicker` 加 parent、`toggleLang` loading、防御性 `isTeam` 检查 |
| `src/js/auth.js` | 改 | `register` / `completeProfile` 加 parent 校验 |
| `src/js/i18n.js` | 改 | 加 `auth.identity.parent` 中英文 |
| `index.html` | 改 | 注册 + 完善资料 identity grid 改 3 列，加 parent 按钮 |
| `src/css/styles.css` | 改 | `.vx-member-name` 锁定 line-height、`.vx-member-identity-tag` 改 inline-flex、`.vx-role-select` 加 padding-right + 倒三角 SVG、`html { scrollbar-gutter: stable }`、`.vx-lang-toggle.is-loading` 旋转 |
| `supabase/migrations/008_add_parent_identity.sql` | 新建 | users.identity CHECK + complete_profile RPC 升级 |
| `.profile-check.js` | 改 | 加 i18n + getFullDisplayName 断言 |
| `.display-name-check.js` | 新建 | 三种显示名格式单元测试 |
