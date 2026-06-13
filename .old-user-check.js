// 验证"老用户没 nickname 字段时"的行为：用户名 = 昵称，
// 弹窗应该把 nickname section 永远移除（不再询问昵称），
// handleProfileCompletionSubmit 用 username 当 nickname 兜底。
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

// 1) HTML 不应再出现 profile-nickname-section
if (/id="profile-nickname-section"/.test(html)) {
  console.log('FAIL: profile-nickname-section should be removed (username = nickname)');
  process.exit(1);
}
console.log('OK: profile-nickname-section removed (用户名 = 昵称)');

// 2) 也不应有 auth-nickname 输入框（注册表单）
if (/id="auth-nickname"/.test(html)) {
  console.log('FAIL: auth-nickname should be removed (username = nickname)');
  process.exit(1);
}
console.log('OK: auth-nickname removed');

// 3) openProfileCompletionModal 不应再引用 nickname section
if (/openProfileCompletionModal[\s\S]{0,2000}profile-nickname-section/.test(appJs)) {
  console.log('FAIL: openProfileCompletionModal should not reference profile-nickname-section');
  process.exit(1);
}
console.log('OK: openProfileCompletionModal no longer references nickname section');

// 4) handleProfileCompletionSubmit 用 username 兜底 nickname
if (!/handleProfileCompletionSubmit[\s\S]{0,1500}authManager\.getCurrentUser\(\)\?\.username\s*\|\|\s*authManager\.getCurrentUser\(\)\?\.nickname/.test(appJs)) {
  console.log('FAIL: handleProfileCompletionSubmit should fall back to username as nickname');
  process.exit(1);
}
console.log('OK: handleProfileCompletionSubmit uses username as nickname fallback');

// 5) 迁移 007 仍存在（兜底老数据库：nickname 同步为 username）
const migrationPath = path.join(__dirname, 'supabase/migrations/007_backfill_nickname_from_username.sql');
if (!fs.existsSync(migrationPath)) {
  console.log('FAIL: 007_backfill_nickname_from_username.sql missing');
  process.exit(1);
}
const sql = fs.readFileSync(migrationPath, 'utf-8');
if (!/UPDATE\s+public\.users/i.test(sql) || !/SET\s+nickname\s*=\s*username/i.test(sql)) {
  console.log('FAIL: 007 migration should UPDATE users SET nickname = username');
  process.exit(1);
}
console.log('OK: 007 backfill migration present and correct');

console.log('\n=== OLD-USER NICKNAME FALLBACK PASSED ===');
