// 综合验证两个 bug 的修复情况：
//   Bug 1: 个人时间轴下"管理赛队"按钮被隐藏
//   Bug 2: 老用户（real_name/identity 缺失）再登录时补全弹窗被打开
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

// 注入必需依赖
window.supabaseManager = {
  isConfigured: () => false,
  getClient: () => null,
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

// 老用户：real_name/identity 都缺失
const oldUser = {
  id: 'u-1',
  username: 'olduser',
  nickname: 'olduser',
  real_name: null,
  identity: null,
  name_only_surname: false,
};
window.authManager = {
  getCurrentUser: () => oldUser,
  isLoggedIn: () => true,
  needsProfileCompletion: () => !oldUser.real_name || !oldUser.identity,
};

process.on('unhandledRejection', () => {});

const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');
const wrapped = appJs + `;window.__vexApp = app;`;
try {
  window.eval(wrapped);
} catch (e) {
  if (!window.__vexApp) {
    console.log('FAIL: cannot evaluate app.js in jsdom:', e.message);
    process.exit(1);
  }
}
const app = window.__vexApp;

// ============================================================
// Bug 1: 个人时间轴下"管理赛队"按钮应该被隐藏
// ============================================================
console.log('\n--- Bug 1: manage-team-btn visibility ---');
app.timelines = [
  { id: 'tl-personal', name: '个人时间轴', type: 'personal' },
  { id: 'tl-team', name: '赛队时间轴', type: 'team' },
];
app.currentTimelineId = 'tl-personal';
app.updateManageButton();

const desktopBtn = doc.getElementById('manage-team-btn');
const mobileBtn = doc.getElementById('mobile-manage-team-btn');
if (!desktopBtn || !mobileBtn) {
  console.log('FAIL: manage-team-btn or mobile-manage-team-btn not found in DOM');
  process.exit(1);
}
const desktopHidden = desktopBtn.classList.contains('hidden');
const mobileHidden = mobileBtn.classList.contains('hidden');
console.log('personal timeline → desktop hidden:', desktopHidden, ', mobile hidden:', mobileHidden);
if (!desktopHidden || !mobileHidden) {
  console.log('FAIL: Bug 1 — manage-team-btn 应该在个人时间轴下被隐藏');
  process.exit(1);
}
console.log('OK: Bug 1 — personal timeline 下 manage-team-btn 已隐藏');

// 关键：实际渲染层面（CSS 计算样式）也必须 display:none
// 这里通过解析 styles.css 验证 CSS 规则存在（jsdom 不解析 CSSOM）
const cssText = fs.readFileSync(path.join(__dirname, 'src/css/styles.css'), 'utf-8');
// 必须存在 .vx-user-menu button.hidden / a.hidden 的 !important 规则，
// 否则 Tailwind .hidden 会被 .vx-user-menu button{display:flex} 覆盖，
// 实际渲染时按钮仍可见（用户在浏览器里看到的 bug 复现条件）
if (!/\.vx-user-menu\s+button\.hidden[\s\S]{0,200}display:\s*none\s*!important/.test(cssText)) {
  console.log('FAIL: CSS 缺少 .vx-user-menu button.hidden{display:none !important} 规则 — 浏览器实际渲染时按钮仍可见');
  process.exit(1);
}
console.log('OK: CSS 存在 .vx-user-menu button.hidden{display:none !important} 规则');

// 切到赛队时间轴，按钮应该显示
app.currentTimelineId = 'tl-team';
app.updateManageButton();
const desktopVisible = !desktopBtn.classList.contains('hidden');
const mobileVisible = !mobileBtn.classList.contains('hidden');
if (!desktopVisible || !mobileVisible) {
  console.log('FAIL: Bug 1 回归 — team timeline 下 manage-team-btn 应该显示');
  process.exit(1);
}
console.log('OK: Bug 1 回归 — team timeline 下 manage-team-btn 正确显示');

// ============================================================
// Bug 2: 老用户（real_name/identity 缺失）补全弹窗应该打开
// ============================================================
console.log('\n--- Bug 2: profile-completion-modal for old user ---');
app.checkProfileCompletion();
const modal = doc.getElementById('profile-completion-modal');
if (!modal) {
  console.log('FAIL: profile-completion-modal not found');
  process.exit(1);
}
const isActive = modal.classList.contains('active');
console.log('modal active class:', isActive);
if (!isActive) {
  console.log('FAIL: Bug 2 — 老用户（real_name/identity 缺失）应该弹补全弹窗');
  process.exit(1);
}
console.log('OK: Bug 2 — 老用户补全弹窗已打开');

// 真实姓名 section / 身份 section 都应该显示（因为都缺失）
const realNameSection = doc.getElementById('profile-real-name-section');
const identitySection = doc.getElementById('profile-identity-section');
const realNameHidden = realNameSection?.classList.contains('hidden');
const identityHidden = identitySection?.classList.contains('hidden');
console.log('real_name section hidden:', !!realNameHidden, ', identity section hidden:', !!identityHidden);
if (realNameHidden || identityHidden) {
  console.log('FAIL: 两个字段都缺失时，section 都不应被隐藏');
  process.exit(1);
}
console.log('OK: 两个 section 都正确显示');

console.log('\n=== ALL TWO BUGS REGRESSION PASSED ===');
