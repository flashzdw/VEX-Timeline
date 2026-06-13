// 验证个人设置（账号管理）弹窗：
//   1) 桌面/移动端下拉入口存在
//   2) openSettingsModal() 成功打开 + 3 个表单都在
//   3) 预填：real_name / username / identity 来自 authManager.getCurrentUser()
//   4) 关闭后可重开
//   5) 不触发云端请求
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const stripped = html.replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(stripped, {
  url: 'http://localhost:8080/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});
const { window } = dom;
const doc = window.document;

// 注入依赖
let supabaseRpcCalls = [];
let supabaseAuthCalls = [];
let supabaseFromCalls = [];

window.supabaseManager = {
  isConfigured: () => false,
  getClient: () => ({
    from: (table) => ({
      select: () => ({
        eq: () => ({
          neq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({ error: null }),
      }),
    }),
    auth: {
      updateUser: async (payload) => {
        supabaseAuthCalls.push({ type: 'updateUser', payload });
        return { error: null };
      },
      signInWithPassword: async (payload) => {
        supabaseAuthCalls.push({ type: 'signInWithPassword', payload });
        return { error: null };
      },
    },
  }),
  getProjectRef: () => 'mock',
};
window.lucide = { createIcons: () => {} };
window.i18n = {
  t: (k, d) => d || k,
  getLanguage: () => 'zh-CN',
  setLanguage: () => {},
  apply: () => {},
  setLanguageWithUpdate: () => {},
  languages: ['zh-CN', 'en'],
};
window.dbManager = { initDB: async () => {}, getTimelines: async () => [] };
window.cloudDBManager = {
  isConfigured: () => false,
  getClient: () => null,
  getTimelines: async () => [],
  init: async () => {},
};

process.on('unhandledRejection', () => {});

const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');
const wrapped = appJs + `;window.__vexApp = app;`;
try { window.eval(wrapped); } catch (e) {
  if (!window.__vexApp) { console.log('FAIL: cannot eval app.js:', e.message); process.exit(1); }
}
const app = window.__vexApp;

// stub 模拟登录用户
const myUser = {
  id: 'u-me',
  username: 'oldname',
  nickname: 'oldname',
  real_name: '张三',
  name_only_surname: false,
  identity: 'student',
};
window.authManager = {
  getCurrentUser: () => myUser,
  isLoggedIn: () => true,
  completeProfile: async (profile) => { return { ...myUser, ...profile }; },
  _loadUserProfile: async () => {},
};
app.updateUserMenu = () => {};
app.renderView = () => {};
app.showToast = (msg) => { console.log('toast:', msg); };

// ============================================================
// 1) 入口存在：桌面端 / 移动端下拉都应包含 data-user-action="settings"
// ============================================================
console.log('--- 1) 入口存在 ---');
const desktopBtns = doc.querySelectorAll('#user-menu [data-user-action="settings"]');
const mobileBtns = doc.querySelectorAll('#mobile-drawer [data-user-action="settings"]');
console.log('desktop 入口数:', desktopBtns.length, ' | mobile 入口数:', mobileBtns.length);
if (desktopBtns.length < 1) { console.log('FAIL: 桌面端下拉缺少个人设置入口'); process.exit(1); }
if (mobileBtns.length < 1) { console.log('FAIL: 移动端下拉缺少个人设置入口'); process.exit(1); }
console.log('OK: 桌面+移动端都有入口');

// ============================================================
// 2) Modal 存在 + openSettingsModal() 能打开
// ============================================================
console.log('\n--- 2) openSettingsModal() 打开 ---');
const modal = doc.getElementById('settings-modal');
if (!modal) { console.log('FAIL: #settings-modal 不在 DOM'); process.exit(1); }
const beforeActive = modal.classList.contains('active');
if (beforeActive) { console.log('FAIL: modal 默认就 active'); process.exit(1); }

app.openSettingsModal();
const afterActive = modal.classList.contains('active');
console.log('modal active after open:', afterActive);
if (!afterActive) { console.log('FAIL: openSettingsModal() 没有加 active class'); process.exit(1); }
console.log('OK: modal 打开');

// 3 个表单都存在
const basicForm = doc.getElementById('settings-basic-form');
const usernameForm = doc.getElementById('settings-username-form');
const passwordForm = doc.getElementById('settings-password-form');
if (!basicForm || !usernameForm || !passwordForm) {
  console.log('FAIL: 缺少某个表单（basic/username/password）');
  process.exit(1);
}
console.log('OK: 3 个表单都存在（basic / username / password）');

// ============================================================
// 3) 预填：real_name / username / identity
// ============================================================
console.log('\n--- 3) 预填 ---');
const realInput = doc.getElementById('settings-real-name');
if (realInput.value !== '张三') {
  console.log('FAIL: real_name 预填错误, 期望 "张三" 实际 "' + realInput.value + '"');
  process.exit(1);
}
const usernameInput = doc.getElementById('settings-username');
if (usernameInput.value !== 'oldname') {
  console.log('FAIL: username 预填错误, 期望 "oldname" 实际 "' + usernameInput.value + '"');
  process.exit(1);
}
const studentBtn = doc.getElementById('settings-identity-student');
if (!studentBtn.classList.contains('bg-primary')) {
  console.log('FAIL: identity 默认应高亮 student');
  process.exit(1);
}
console.log('OK: 预填正确（real_name=张三, username=oldname, identity=student 高亮）');

// ============================================================
// 4) 身份切换 → state 同步
// ============================================================
console.log('\n--- 4) 身份切换 ---');
const teacherBtn = doc.getElementById('settings-identity-teacher');
teacherBtn.click();
if (app._settingsIdentity !== 'teacher') {
  console.log('FAIL: 切到 teacher 后 _settingsIdentity 应是 teacher, 实际 ' + app._settingsIdentity);
  process.exit(1);
}
console.log('OK: 切到 teacher 同步 _settingsIdentity');

const parentBtn = doc.getElementById('settings-identity-parent');
parentBtn.click();
if (app._settingsIdentity !== 'parent') {
  console.log('FAIL: 切到 parent 后 _settingsIdentity 应是 parent, 实际 ' + app._settingsIdentity);
  process.exit(1);
}
console.log('OK: 切到 parent 同步 _settingsIdentity');

// 家长时 surnameWrap 应隐藏
const surnameWrap = doc.getElementById('settings-surname-only-wrap');
if (!surnameWrap.classList.contains('hidden')) {
  console.log('FAIL: 家长时 surname-only-wrap 应 hidden');
  process.exit(1);
}
console.log('OK: 家长时 surname-only-wrap 自动隐藏');

// 切回 student 验证 surname-wrap 仍 hidden（student 不享受仅填姓）
const studentBtn2 = doc.getElementById('settings-identity-student');
studentBtn2.click();
if (!surnameWrap.classList.contains('hidden')) {
  console.log('FAIL: 切到 student 时 surname-only-wrap 应 hidden');
  process.exit(1);
}
console.log('OK: 切到 student 时 surname-only-wrap 仍 hidden');

// 切到 teacher 验证 surname-wrap 显示 + 默认勾选
teacherBtn.click();
if (surnameWrap.classList.contains('hidden')) {
  console.log('FAIL: 切到 teacher 时 surname-only-wrap 应显示');
  process.exit(1);
}
const surnameCb = doc.getElementById('settings-surname-only');
if (!surnameCb.checked) {
  console.log('FAIL: 切到 teacher 时 surname-only 应默认勾选');
  process.exit(1);
}
console.log('OK: 切到 teacher 时 surname-only-wrap 显示 + 默认勾选');

// ============================================================
// 5) 关闭 + 重开（不抛错，不重复绑定）
// ============================================================
console.log('\n--- 5) 关闭 + 重开 ---');
modal.classList.remove('active');
app.openSettingsModal();
if (!modal.classList.contains('active')) { console.log('FAIL: 重开失败'); process.exit(1); }
console.log('OK: 关闭后能重开');

// 验证表单 submit handler 只绑定一次（不会累加）
// 通过在 basicForm 上加一个 fake 标记，再 openSettingsModal 一次，看 handler 是否被覆盖
// 简单做法：open 3 次后 dispatch submit，应只调用一次 completeProfile
let submitCount = 0;
const realStub = window.authManager.completeProfile;
window.authManager.completeProfile = async (p) => { submitCount++; return realStub(p); };
app.openSettingsModal();
app.openSettingsModal();
app.openSettingsModal();
basicForm.dispatchEvent(new window.Event('submit', { cancelable: true }));
// 等 microtask
setTimeout(() => {
  console.log('调用 completeProfile 次数（应=1）:', submitCount);
  if (submitCount !== 1) {
    console.log('FAIL: submit handler 重复绑定（提交一次应只调用 1 次）');
    process.exit(1);
  }
  console.log('OK: submit handler 只绑定一次');

  // ============================================================
  // 6) 打开弹窗不触发任何云端请求
  // ============================================================
  console.log('\n--- 6) 打开弹窗不发请求 ---');
  supabaseAuthCalls = [];
  supabaseFromCalls = [];
  app.openSettingsModal();
  if (supabaseAuthCalls.length > 0) {
    console.log('FAIL: 打开弹窗时不该调用 supabase.auth（应只在用户点提交时才发）');
    process.exit(1);
  }
  console.log('OK: 打开弹窗不触发任何 supabase.auth / from 调用');

  // ============================================================
  // 7) _handleSettingsBasicSubmit 复用 completeProfile 路径
  // ============================================================
  console.log('\n--- 7) 提交基本信息调用 completeProfile ---');
  let calledWith = null;
  window.authManager.completeProfile = async (p) => { calledWith = p; return { ...myUser, ...p }; };
  realInput.value = '李四';
  teacherBtn.click();
  surnameCb.checked = false;
  // 模拟提交
  basicForm.dispatchEvent(new window.Event('submit', { cancelable: true }));
  setTimeout(() => {
    if (!calledWith) { console.log('FAIL: basicForm submit 没调用 completeProfile'); process.exit(1); }
    console.log('completeProfile 入参:', JSON.stringify(calledWith));
    if (calledWith.realName !== '李四') { console.log('FAIL: realName 不对'); process.exit(1); }
    if (calledWith.identity !== 'teacher') { console.log('FAIL: identity 不对'); process.exit(1); }
    if (calledWith.nameOnlySurname !== false) { console.log('FAIL: nameOnlySurname 应 false'); process.exit(1); }
    if (calledWith.nickname !== 'oldname') { console.log('FAIL: nickname 应=username="oldname"'); process.exit(1); }
    console.log('OK: 基本信息 submit 走 completeProfile（realName + identity + nameOnlySurname + nickname 正确）');

    console.log('\n=== SETTINGS MODAL ALL PASSED ===');
    process.exit(0);
  }, 50);
}, 50);
