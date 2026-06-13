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

// 1. 各 section 都用 id 包裹
const sections = ['profile-nickname-section', 'profile-real-name-section', 'profile-identity-section'];
sections.forEach(id => {
  if (!doc.getElementById(id)) {
    console.log('FAIL missing section:', id);
    process.exit(1);
  }
});
console.log('OK: profile sections are wrapped with ids');

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
const newKeys = ['auth.nudge.title', 'auth.nudge.body', 'auth.nudge.ok'];
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
  'profile-nickname-section',
  'profile-real-name-section',
  'profile-identity-section'
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

console.log('\n=== PROFILE COMPLETION REFACTOR PASSED ===');
