# 个人设置页面（账号设置弹窗）

## Summary

在个人头像下拉菜单里新增"个人设置"入口，弹出 `#settings-modal` 模态框，可修改 4 项内容：
- **真实姓名**（re-bind 到 `complete_profile` RPC）
- **用户名**（修改 `auth.users.email` = `username@vex-timeline.local`，需唯一性检查）
- **密码**（需输入旧密码 → `signInWithPassword` 验证 → `updateUser({ password })`）
- **身份**（学生/老师/家长 切换，复用 `_bindIdentityPicker` + `complete_profile` RPC）

**两套保存策略**（避免一次失败把全部字段都丢掉）：
- 基本信息（真实姓名 + 身份）→ 一个表单，点击"保存"调用 `auth.completeProfile`
- 用户名和密码 → **独立**的两个独立按钮和表单，各自走自己的 RPC

---

## Current State Analysis

### 现有可复用资源

| 资源 | 位置 | 复用方式 |
|---|---|---|
| `auth.completeProfile()` | [`auth.js:297-324`](file:///workspace/src/js/auth.js#L297-L324) | 真实姓名 / 身份 直接复用 |
| `complete_profile` RPC | [`migrations/006 + 008`](file:///workspace/supabase/migrations/006_auth_trigger_and_complete_profile.sql) | 业务规则已就位（家长>=2字符、老师仅填姓等） |
| `_bindIdentityPicker` | [`app.js:1421-1480`](file:///workspace/src/js/app.js#L1421-L1480) | 3 身份 grid + 老师默认勾选仅填姓 + 家长强制提示 |
| `syncRealNameField` | [`app.js:_bindIdentityPicker 内`](file:///workspace/src/js/app.js#L1421-L1480) | 真实姓名 label/placeholder/hint 随身份变化 |
| `signInWithPassword` | Supabase 内置 | 改密码时验证旧密码 |
| `supabase.auth.updateUser({ email, password })` | Supabase 内置 | 改用户名 / 改密码 |
| 现有下拉菜单 `data-team-action` | [`index.html:762-778`](file:///workspace/index.html#L762-L778) | 新增"个人设置"按钮 |
| `app.user.*` i18n 键 | [`i18n.js:241-245`](file:///workspace/src/js/i18n.js#L241-L245) | 已部分就位 |
| 现有 modal 样式 `.vx-modal-overlay` / `.vx-modal` | [`styles.css:1-200`](file:///workspace/src/css/styles.css) | 直接套用 |

### username 业务约束（[`auth.js:201`](file:///workspace/src/js/auth.js#L201)）

```js
const email = username + '@vex-timeline.local';
```

→ `auth.users.email` = `username@vex-timeline.local`
→ 改 username = 改 `auth.users.email` = `supabase.auth.updateUser({ email: newUsername + '@vex-timeline.local' })`

**注意**：
- Supabase 改 email **默认不发验证邮件**（因为域名是 `.local`，SMTP 不会送达）
- 改完后用户保持登录态，但**再次登录必须用新 username**
- 唯一性检查：改前用 `supabase.from('users').select('id').eq('username', newUsername).neq('id', myId).maybeSingle()` 看是否被占用

### 改密码流程（用户已确认要旧密码验证）

```js
// 1) 旧密码验证
const { error: loginErr } = await supabase.auth.signInWithPassword({
  email: myEmail,
  password: oldPassword,
});
if (loginErr) throw new Error('旧密码错误');

// 2) 改密码
const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
if (pwErr) throw pwErr;
```

实际 Supabase 当前 session 已经是登录态，理论上不需要再 signInWithPassword 验证 — 但**安全角度**让用户重输旧密码能挡住会话被盗场景。

### UI 形式：弹窗（与现有 UI 一致）

用户说"个人设置**页面**"，但 VEX-Timeline 整个 UI 全部是 modal/抽屉交互（创建赛队/加入赛队/管理赛队/profile-completion 都是 modal）。**沿用 modal 模式**，视觉和交互统一。

---

## Proposed Changes

### 1. HTML：新增 `#settings-modal`（独立结构）

**文件**：[`index.html`](file:///workspace/index.html)

**位置**：放在 `<div id="profile-completion-modal">` 之后（与 profile-completion 同类，"个人向"弹窗）。

```html
<!-- 个人设置 -->
<div id="settings-modal" class="vx-modal-overlay">
  <div class="vx-modal max-w-lg">
    <div class="bg-primary text-canvas px-8 py-6 flex items-center justify-between">
      <h2 class="font-extrabold text-2xl tracking-[-0.02em] uppercase" data-i18n="app.user.settings">个人设置</h2>
      <i data-lucide="settings" class="w-6 h-6"></i>
    </div>
    <div class="p-8 flex flex-col gap-8">
      <!-- 卡片 A：基本信息（真实姓名 + 身份） -->
      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-fg/60 mb-3" data-i18n="app.user.basicInfo">基本信息</h3>
        <form id="settings-basic-form" class="flex flex-col gap-4">
          <!-- 真实姓名（与 profile-completion 同步，label/placeholder/hint 由 _bindIdentityPicker 动态设） -->
          <div id="settings-real-name-section" class="flex flex-col gap-1">
            <label id="settings-real-name-label" class="text-sm font-semibold" data-i18n="auth.realName.label">真实姓名</label>
            <input id="settings-real-name" type="text" class="vx-input" autocomplete="name">
            <p id="settings-real-name-hint" class="text-xs text-fg/60 hidden"></p>
          </div>
          <!-- 身份（与注册时一致：3 身份 grid） -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-semibold" data-i18n="auth.identity.label">身份</label>
            <div id="settings-identity-grid" class="vx-identity-grid grid grid-cols-3 gap-2">
              <button type="button" data-identity="student" class="vx-identity-pill">
                <i data-lucide="graduation-cap" class="w-4 h-4"></i><span data-i18n="auth.identity.student">学生</span>
              </button>
              <button type="button" data-identity="teacher" class="vx-identity-pill">
                <i data-lucide="briefcase" class="w-4 h-4"></i><span data-i18n="auth.identity.teacher">老师</span>
              </button>
              <button type="button" data-identity="parent" class="vx-identity-pill">
                <i data-lucide="heart" class="w-4 h-4"></i><span data-i18n="auth.identity.parent">家长</span>
              </button>
            </div>
            <!-- "仅填姓"行（与 profile-completion 一致；家长自动隐藏，老师默认勾选） -->
            <label id="settings-surname-only-wrap" class="flex items-center gap-2 text-sm text-fg/80 mt-1">
              <input type="checkbox" id="settings-surname-only" class="vx-checkbox">
              <span data-i18n="auth.surnameOnly">仅填姓</span>
            </label>
          </div>
          <p class="settings-error text-xs text-danger min-h-[1em]"></p>
          <button type="submit" class="h-12 bg-primary text-canvas rounded-md font-semibold uppercase tracking-wider" data-i18n="app.action.save">保存</button>
        </form>
      </section>

      <div class="h-px bg-border"></div>

      <!-- 卡片 B：用户名 -->
      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-fg/60 mb-3" data-i18n="app.user.username">用户名</h3>
        <form id="settings-username-form" class="flex flex-col gap-3">
          <input id="settings-username" type="text" class="vx-input" autocomplete="username" minlength="3">
          <p class="text-xs text-fg/60" data-i18n="app.user.usernameHint">修改后下次登录需用新用户名</p>
          <p class="settings-username-error text-xs text-danger min-h-[1em]"></p>
          <button type="submit" class="h-12 bg-primary text-canvas rounded-md font-semibold uppercase tracking-wider" data-i18n="app.action.update">更新</button>
        </form>
      </section>

      <div class="h-px bg-border"></div>

      <!-- 卡片 C：改密码 -->
      <section>
        <h3 class="text-sm font-bold uppercase tracking-wider text-fg/60 mb-3" data-i18n="app.user.changePassword">更改密码</h3>
        <form id="settings-password-form" class="flex flex-col gap-3">
          <input id="settings-old-password" type="password" class="vx-input" placeholder="旧密码" autocomplete="current-password" minlength="6">
          <input id="settings-new-password" type="password" class="vx-input" placeholder="新密码" autocomplete="new-password" minlength="6">
          <input id="settings-confirm-password" type="password" class="vx-input" placeholder="确认新密码" autocomplete="new-password" minlength="6">
          <p class="settings-password-error text-xs text-danger min-h-[1em]"></p>
          <button type="submit" class="h-12 bg-primary text-canvas rounded-md font-semibold uppercase tracking-wider" data-i18n="app.user.changePassword">更改密码</button>
        </form>
      </section>
    </div>
  </div>
</div>
```

**关键设计**：
- 三个独立 `<form>`，互不影响：一个失败不会回滚另一个
- 三个独立 `<p class="settings-*-error">` 错误区，定位清晰
- "仅填姓"行沿用 `vx-surname-only-wrap` id（与 profile-completion 同语义），家长自动隐藏，老师默认勾选

### 2. HTML：下拉菜单新增"个人设置"入口

**文件**：[`index.html`](file:///workspace/index.html)

**改动 1**（桌面端 L762-L778）：
```html
<div class="h-px bg-border my-1"></div>            <!-- 在"创建赛队"前加分割线 -->
<button type="button" data-user-action="settings">  <!-- 新增按钮 -->
  <i data-lucide="settings" class="w-4 h-4"></i><span data-i18n="app.user.settings">个人设置</span>
</button>
<button type="button" data-team-action="create">    <!-- 原有 -->
  ...
```

**改动 2**（移动端 L1093-L1103）：在 mobile 菜单"创建赛队"按钮**前**追加：
```html
<button data-user-action="settings" type="button"
        class="h-12 border-4 border-primary text-primary rounded-md font-semibold tracking-wider uppercase text-sm flex items-center justify-center gap-2 hover:bg-primary hover:text-canvas transition-all duration-200">
  <i data-lucide="settings" class="w-4 h-4"></i><span data-i18n="app.user.settings">个人设置</span>
</button>
```

### 3. JS：app.js 新增 handlers + bind

**文件**：[`src/js/app.js`](file:///workspace/src/js/app.js)

**3.1 `bindEvents` 中新增**（在 `handleTeamAction` 监听器附近 L1023-L1029）：

```js
// 用户操作（个人设置）
const userActionBtn = e.target.closest('[data-user-action]');
if (userActionBtn) {
  const action = userActionBtn.dataset.userAction;
  if (action === 'settings') this.openSettingsModal();
  this.closeAllMenus();
  this.closeMobileDrawer();
  return;
}
```

**3.2 新增 `openSettingsModal()`**：

```js
openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  const u = authManager.getCurrentUser();
  if (!u) return;

  // 1) 预填基本信息
  const realInput = document.getElementById('settings-real-name');
  if (realInput) realInput.value = u.real_name || '';
  const surnameCheckbox = document.getElementById('settings-surname-only');
  if (surnameCheckbox) surnameCheckbox.checked = !!u.name_only_surname;
  const usernameInput = document.getElementById('settings-username');
  if (usernameInput) usernameInput.value = u.username || '';

  // 2) 身份选择：复用 _bindIdentityPicker（构造一个新的绑定实例）
  this._settingsIdentity = u.identity || 'student';
  this._bindIdentityPicker({
    gridId: 'settings-identity-grid',
    realNameLabelId: 'settings-real-name-label',
    realNameInputId: 'settings-real-name',
    realNameHintId: 'settings-real-name-hint',
    surnameWrapId: 'settings-surname-only-wrap',
    surnameCheckboxId: 'settings-surname-only',
    initialIdentity: this._settingsIdentity,
    initialSurnameOnly: !!u.name_only_surname,
    identityStateKey: '_settingsIdentity',   // 让 _bindIdentityPicker 把选中值写到 app._settingsIdentity
  });

  // 3) 绑定三个表单的 submit
  const basicForm = document.getElementById('settings-basic-form');
  if (basicForm && !basicForm.__bound) {
    basicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSettingsBasicSubmit();
    });
    basicForm.__bound = true;
  }
  const usernameForm = document.getElementById('settings-username-form');
  if (usernameForm && !usernameForm.__bound) {
    usernameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSettingsUsernameSubmit();
    });
    usernameForm.__bound = true;
  }
  const passwordForm = document.getElementById('settings-password-form');
  if (passwordForm && !passwordForm.__bound) {
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSettingsPasswordSubmit();
    });
    passwordForm.__bound = true;
  }

  modal.classList.add('active');
  if (window.i18n) window.i18n.apply();
  if (window.lucide && lucide.createIcons) lucide.createIcons();
}
```

**3.3 `_handleSettingsBasicSubmit`（基本信息）**：

```js
async _handleSettingsBasicSubmit() {
  const errEl = document.querySelector('#settings-basic-form .settings-error');
  if (errEl) errEl.textContent = '';
  const realName = (document.getElementById('settings-real-name')?.value || '').trim();
  const surnameOnly = this._settingsIdentity === 'parent'
    ? false
    : !!document.getElementById('settings-surname-only')?.checked;
  const identity = this._settingsIdentity;

  try {
    // 复用 auth.completeProfile
    const updated = await authManager.completeProfile({
      nickname: authManager.getCurrentUser()?.username || '',
      realName,
      nameOnlySurname: surnameOnly,
      identity,
    });
    // 刷新顶栏 / 用户菜单
    this.updateUserMenu();
    this.renderView();
    // 关弹窗
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
    this.showToast(this._i18n('app.user.basicInfoSaved', '基本信息已更新'));
  } catch (e) {
    if (errEl) errEl.textContent = e.message || String(e);
  }
}
```

**3.4 `_handleSettingsUsernameSubmit`（改用户名）**：

```js
async _handleSettingsUsernameSubmit() {
  const errEl = document.querySelector('#settings-username-form .settings-username-error');
  if (errEl) errEl.textContent = '';
  const newUsername = (document.getElementById('settings-username')?.value || '').trim();
  const u = authManager.getCurrentUser();
  if (!u) return;

  // 校验
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(newUsername)) {
    if (errEl) errEl.textContent = this._i18n('app.user.usernameInvalid', '用户名只能是 3-20 位字母/数字/_-');
    return;
  }
  if (newUsername === u.username) {
    if (errEl) errEl.textContent = this._i18n('app.user.usernameUnchanged', '用户名未变化');
    return;
  }

  try {
    const supabase = supabaseManager.getClient();
    // 唯一性检查
    const { data: existing, error: chkErr } = await supabase
      .from('users')
      .select('id')
      .eq('username', newUsername)
      .neq('id', u.id)
      .maybeSingle();
    if (chkErr) throw chkErr;
    if (existing) {
      if (errEl) errEl.textContent = this._i18n('auth.error.taken', '用户名已被占用');
      return;
    }

    // 改 email
    const { error: updErr } = await supabase.auth.updateUser({
      email: newUsername + '@vex-timeline.local',
    });
    if (updErr) throw updErr;

    // 同步 public.users.username（email 改成功后，auth.users.email 已变，但 public.users.username 字段要手动同步）
    const { error: syncErr } = await supabase
      .from('users')
      .update({ username: newUsername })
      .eq('id', u.id);
    if (syncErr) throw syncErr;

    // 重新加载 profile
    await authManager._loadUserProfile(u.id);
    this.updateUserMenu();
    this.renderView();
    this.showToast(this._i18n('app.user.usernameSaved', '用户名已更新，下次登录请用新用户名'));
  } catch (e) {
    if (errEl) errEl.textContent = e.message || String(e);
  }
}
```

**3.5 `_handleSettingsPasswordSubmit`（改密码）**：

```js
async _handleSettingsPasswordSubmit() {
  const errEl = document.querySelector('#settings-password-form .settings-password-error');
  if (errEl) errEl.textContent = '';
  const oldPw = document.getElementById('settings-old-password')?.value || '';
  const newPw = document.getElementById('settings-new-password')?.value || '';
  const confirmPw = document.getElementById('settings-confirm-password')?.value || '';
  const u = authManager.getCurrentUser();
  if (!u) return;

  // 校验
  if (oldPw.length < 6 || newPw.length < 6) {
    if (errEl) errEl.textContent = this._i18n('auth.error.shortPassword', '密码至少 6 位');
    return;
  }
  if (newPw !== confirmPw) {
    if (errEl) errEl.textContent = this._i18n('auth.error.passwordMismatch', '两次输入的新密码不一致');
    return;
  }
  if (oldPw === newPw) {
    if (errEl) errEl.textContent = this._i18n('auth.error.passwordUnchanged', '新密码不能与旧密码相同');
    return;
  }

  try {
    const supabase = supabaseManager.getClient();
    // 1) 旧密码验证
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: (u.username || '') + '@vex-timeline.local',
      password: oldPw,
    });
    if (signInErr) {
      if (errEl) errEl.textContent = this._i18n('app.user.oldPasswordWrong', '旧密码错误');
      return;
    }
    // 2) 改密码
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
    if (pwErr) throw pwErr;

    // 清空三个密码输入框
    ['settings-old-password', 'settings-new-password', 'settings-confirm-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.showToast(this._i18n('app.user.passwordSaved', '密码已更新'));
  } catch (e) {
    if (errEl) errEl.textContent = e.message || String(e);
  }
}
```

**3.6 `_bindIdentityPicker` 重构**：当前实现里：
- 它**直接读** `this._authIdentity`（写死）作为状态
- 它只支持注册 / profile-completion 场景

**需要轻微抽象**：把 `identityStateKey` 做成参数（默认 `'_authIdentity'`），让 settings modal 也能复用。

```js
_bindIdentityPicker(opts = {}) {
  const {
    gridId = 'auth-identity-grid',
    realNameLabelId = 'auth-real-name-label',
    realNameInputId = 'auth-real-name',
    realNameHintId = 'auth-real-name-hint',
    surnameWrapId = 'auth-surname-only-wrap',
    surnameCheckboxId = 'auth-surname-only',
    initialIdentity = 'student',
    initialSurnameOnly = false,
    identityStateKey = '_authIdentity',
  } = opts;
  // ... 后续逻辑改成 this[identityStateKey] = selected;
  this[identityStateKey] = initialIdentity; // 初始化
  // ...
}
```

注册和 profile-completion 调用处保持**默认值**，无需修改。settings modal 调用时传自定义 id 和 `identityStateKey: '_settingsIdentity'`。

### 4. CSS：vx-input 复用 + vx-identity-pill 复用

**文件**：[`src/css/styles.css`](file:///workspace/src/css/styles.css)

**核对**：现有 `.vx-input`、`.vx-checkbox`、`.vx-identity-pill` 是否已存在 — 应当已存在（profile-completion / 注册表单都用了）。
如果**已存在**，无需新增 CSS。
如果**不存在**某个 class，临时新增（保证 settings-modal 视觉与 profile-completion-modal 一致）。

### 5. i18n：新增键

**文件**：[`src/js/i18n.js`](file:///workspace/src/js/i18n.js)

新增（zh-CN + en 都加）：

| 键 | 中文 | 英文 |
|---|---|---|
| `app.user.settings` | 个人设置 | Settings |
| `app.user.basicInfo` | 基本信息 | Basic info |
| `app.user.basicInfoSaved` | 基本信息已更新 | Basic info updated |
| `app.user.username` | 用户名 | Username |
| `app.user.usernameHint` | 修改后下次登录需用新用户名 | After change, sign in with the new username next time |
| `app.user.usernameInvalid` | 用户名只能是 3-20 位字母/数字/_- | Username must be 3-20 chars of letters/digits/_- |
| `app.user.usernameUnchanged` | 用户名未变化 | Username unchanged |
| `app.user.usernameSaved` | 用户名已更新，下次登录请用新用户名 | Username updated, please use the new one next time |
| `app.user.changePassword` | 更改密码 | Change password |
| `app.user.oldPasswordWrong` | 旧密码错误 | Wrong old password |
| `app.user.passwordSaved` | 密码已更新 | Password updated |
| `app.action.update` | 更新 | Update |
| `app.action.save` | 保存 | Save |
| `auth.error.passwordMismatch` | 两次输入的新密码不一致 | The two new passwords do not match |
| `auth.error.passwordUnchanged` | 新密码不能与旧密码相同 | The new password must be different from the old one |

### 6. 验证脚本

**文件**：新增 [`/workspace/.settings-modal-check.js`](file:///workspace/.settings-modal-check.js)

断言：
1. 入口存在：下拉菜单里能匹配 `data-user-action="settings"`（桌面 + 移动端）
2. Modal 打开：`openSettingsModal()` 后 `#settings-modal` 有 `active` class
3. 三个表单都存在：basic / username / password
4. 预填正确：`authManager.getCurrentUser()` 的 `real_name / username / identity` 出现在对应 input
5. 关闭后能重开（不抛错）
6. **不发请求**就打开（避免触发 cloud RPC）

---

## Assumptions & Decisions

1. **UI 形式用 modal 而非独立 page**。理由：与现有 VEX UI 风格统一（所有交互都是 modal/抽屉），与 profile-completion-modal / create-team-modal 一致。

2. **三个表单独立提交**。理由：一个字段失败不会回滚其他字段。用户可以分开重试。

3. **`completeProfile` 复用**。理由：业务规则（家长>=2字符、老师仅填姓）已经在 RPC 里实现；新加 update 路径会重复代码并可能引入不一致。

4. **改 username = 改 `auth.users.email` + 同步 `public.users.username`**。理由：username 在两处都有，必须同步；`auth.users.email` 改完后 Supabase session 保持（不重新登录），但用户需记住新 username 用于下次登录。

5. **改密码走 signInWithPassword 验证 + updateUser**。理由：用户已确认要旧密码验证；signInWithPassword 在 session 已登录的情况下不刷新 session（不会强制登出）。

6. **不需新增 SQL 迁移**。`complete_profile` RPC 已就位，auth.updateUser 由 Supabase 内置提供。

7. **不动 profile-completion 弹窗**。`completeProfile` 接口兼容两个调用点（注册后补全 / 设置页修改），不破坏现有逻辑。

8. **身份变更实时同步**：改完身份 → `updateUserMenu` / `renderView` 刷新 → 赛队成员列表里的"身份胶囊"自动更新（因为胶囊是按 user.identity 渲染）。

---

## Verification

1. **静态检查**（5 套回归）：
   ```bash
   node .display-name-check.js
   node .profile-check.js
   node .old-user-check.js
   node .bug-check.js
   node .permission-check.js
   ```
   全部应通过。

2. **新增 settings-modal 测试**：
   ```bash
   node .settings-modal-check.js
   ```
   期望：6 个断言全过。

3. **手动验证**（用户）：
   - 登录后点头像下拉，看到新"个人设置"入口
   - 弹出 modal，3 个卡片（基本信息 / 用户名 / 更改密码）
   - 改真实姓名后顶栏/赛队成员身份胶囊同步刷新
   - 改用户名：先改成已存在值 → 弹"用户名已被占用"；改成新值 → toast 提示"下次登录用新用户名"
   - 改密码：旧密码错 → 报错；新密码=旧密码 → 报错；两次不一致 → 报错；成功 → toast"密码已更新"
   - 切中英文：所有文案正确翻译

---

## Files Changed

| 文件 | 改动类型 | 行数估算 |
|---|---|---|
| `index.html` | 新增 `#settings-modal`（~80 行）+ 2 处下拉入口（~8 行） | +88 |
| `src/js/app.js` | 新增 4 个 handler + `openSettingsModal` + `_bindIdentityPicker` 重构（参数化） | +180 |
| `src/js/i18n.js` | 新增 14 个 i18n 键 × 2 语言 = 28 行 | +28 |
| `src/css/styles.css` | 复用既有 `.vx-input / .vx-checkbox / .vx-identity-pill` | 0（如果都存在） |
| `.settings-modal-check.js` | 新建 | +90 |
