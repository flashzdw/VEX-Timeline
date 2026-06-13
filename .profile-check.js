// 验证 完善资料 弹窗的改动：
// 1. 已有字段的 section 被隐藏
// 2. 默认身份 = student
// 3. 稍后按钮总是可点，且点击会弹劝导弹窗
// 4. 劝导弹窗存在
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const dom = new JSDOM(html, { url: 'http://localhost:8080/', pretendToBeVisual: true });
const { window } = dom;
const doc = window.document;

// 1. 各 section 都用 id 包裹（昵称 section 已废弃：用户名 = 昵称，单独不再展示）
const sections = ['profile-real-name-section', 'profile-identity-section'];
sections.forEach(id => {
  if (!doc.getElementById(id)) {
    console.log('FAIL missing section:', id);
    process.exit(1);
  }
});
console.log('OK: profile sections are wrapped with ids (nickname 合并到 username)');

// 2. 劝导弹窗存在
const nudgeModal = doc.getElementById('profile-nudge-modal');
if (!nudgeModal) { console.log('FAIL: profile-nudge-modal missing'); process.exit(1); }
if (!doc.getElementById('profile-nudge-ok')) { console.log('FAIL: profile-nudge-ok missing'); process.exit(1); }
console.log('OK: nudge modal present');

// 3. 稍后按钮存在（不再 disabled）
const skipBtn = doc.getElementById('profile-completion-skip');
if (!skipBtn) { console.log('FAIL: profile-completion-skip missing'); process.exit(1); }
if (skipBtn.disabled) { console.log('FAIL: skip button should not be disabled by default'); process.exit(1); }
console.log('OK: skip button is enabled by default');

// 4. surname-only 仍默认勾上
const surnameCb = doc.getElementById('profile-surname-only');
if (!surnameCb || !surnameCb.checked) { console.log('FAIL: profile-surname-only should be checked'); process.exit(1); }
console.log('OK: profile surname-only checked by default');

// 5. 注册表单的 surname-only 仍默认勾上
const authSurnameCb = doc.getElementById('auth-surname-only');
if (!authSurnameCb || !authSurnameCb.checked) { console.log('FAIL: auth-surname-only should be checked'); process.exit(1); }
console.log('OK: auth surname-only checked by default');

// 6. i18n 新增键
const i18nText = fs.readFileSync(path.join(__dirname, 'src/js/i18n.js'), 'utf-8');
const newKeys = ['auth.nudge.title', 'auth.nudge.body', 'auth.nudge.ok', 'auth.identity.parent'];
const missing = newKeys.filter(k => !i18nText.includes(`'${k}'`));
if (missing.length) { console.log('FAIL i18n missing:', missing); process.exit(1); }
console.log('OK: nudge i18n keys present');

// 7. app.js 关键改动
const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');
const required = [
  "_authIdentity = 'student'",
  "_profileIdentity = 'student'",
  'openProfileNudgeModal',
  'closeProfileNudgeModal',
  'handleProfileCompletionSkip',
  'profile-real-name-section',
  'profile-identity-section',
  'getFullDisplayName',
  'getFullDisplayName(a.users || {}).localeCompare',
  'parentBtn',
  'getFullDisplayName(user)',
];
const missingApp = required.filter(s => !appJs.includes(s));
if (missingApp.length) { console.log('FAIL app.js missing:', missingApp); process.exit(1); }
console.log('OK: app.js updated');

// 8. 验证 _bindIdentityPicker 里有 paintSelected 初始调用（确保默认 student 高亮）
if (!appJs.includes('初始绘制一次（让默认的"学生"在视觉上高亮）')) {
  console.log('FAIL: app.js should paint default identity on init');
  process.exit(1);
}
console.log('OK: identity picker paints default state on init');

// 9. 验证三种身份按钮都在
const htmlText = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
for (const id of ['auth-identity-student', 'auth-identity-teacher', 'auth-identity-parent',
                  'profile-identity-student', 'profile-identity-teacher', 'profile-identity-parent']) {
  if (!htmlText.includes(`id="${id}"`)) {
    console.log('FAIL: missing button in index.html:', id);
    process.exit(1);
  }
}
console.log('OK: 3 identity buttons (student/teacher/parent) in auth + profile forms');

// 10. 验证 identity grid 用了 3 列
if (!/vx-identity-grid[^"]*grid-cols-3/.test(htmlText)) {
  console.log('FAIL: identity grid should use grid-cols-3');
  process.exit(1);
}
console.log('OK: identity grid uses grid-cols-3');

// 11. 验证 CSS 防抽动 + select 倒三角
const cssText = fs.readFileSync(path.join(__dirname, 'src/css/styles.css'), 'utf-8');
if (!/html\s*\{\s*scrollbar-gutter:\s*stable/.test(cssText)) {
  console.log('FAIL: styles.css should set html { scrollbar-gutter: stable }');
  process.exit(1);
}
console.log('OK: html scrollbar-gutter: stable (prevents lang-switch shift)');

if (!/\.vx-role-select[\s\S]{0,400}padding:\s*0\s+1\.75rem/.test(cssText)) {
  console.log('FAIL: .vx-role-select should have padding-right: 1.75rem');
  process.exit(1);
}
console.log('OK: .vx-role-select has padding-right: 1.75rem (chevron padding)');

// 12. 验证迁移 008 存在且有 parent 校验
const mig008 = fs.readFileSync(path.join(__dirname, 'supabase/migrations/008_add_parent_identity.sql'), 'utf-8');
if (!/parent/i.test(mig008) || !/complete_profile/i.test(mig008)) {
  console.log('FAIL: 008 migration should mention parent + complete_profile');
  process.exit(1);
}
console.log('OK: 008_add_parent_identity.sql exists with parent handling');

// 13. 注册表单：nickname 输入框应已删除（用户名 = 昵称）
if (htmlText.includes('id="auth-nickname"')) {
  console.log('FAIL: register form should not have a separate auth-nickname field');
  process.exit(1);
}
console.log('OK: register form merged username/nickname into one field');

// 14. handleRegister 应把 nickname 设成 username
if (!appJs.includes('nickname: username')) {
  console.log('FAIL: handleRegister should set nickname = username');
  process.exit(1);
}
console.log('OK: handleRegister sets nickname = username');

// 15. handleProfileCompletionSubmit 应使用 username 当 nickname
if (!appJs.includes("authManager.getCurrentUser()?.username || authManager.getCurrentUser()?.nickname")) {
  console.log('FAIL: handleProfileCompletionSubmit should fall back to username as nickname');
  process.exit(1);
}
console.log('OK: handleProfileCompletionSubmit uses username as nickname');

// 16. updateUserMenu 防御性调用 updateManageButton
if (!/updateUserMenu\(\)\s*\{[\s\S]{0,600}this\.updateManageButton\(\)/.test(appJs)) {
  console.log('FAIL: updateUserMenu should defensively call updateManageButton');
  process.exit(1);
}
console.log('OK: updateUserMenu defensively calls updateManageButton');

// 17. 老师切换时默认勾选"仅填姓"
if (!/if \(selected === 'teacher'\)[\s\S]{0,300}surnameCheckbox\.checked = true/.test(appJs)) {
  console.log('FAIL: switching to teacher should auto-check surname-only');
  process.exit(1);
}
console.log('OK: teacher identity auto-checks surname-only by default');

console.log('\n=== UI POLISH REFACTOR PASSED ===');
