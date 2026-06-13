// 验证"老用户没 nickname 字段时，弹窗应自动隐藏昵称 section"这一行为。
// 由于 app.js 的 App 类只暴露在模块作用域（不挂 window），无法直接 new，
// 这里只做静态源码校验：openProfileCompletionModal 里的 hide 逻辑是否
// 把"u?.nickname || u?.username"作为隐藏条件之一。
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');

// 1) 源码里必须存在 username 兜底
const pattern = /hasNickname\s*=\s*!!\(u\?\.nickname\s*\|\|\s*u\?\.username\)/;
if (!pattern.test(appJs)) {
  console.log('FAIL: app.js should fall back to u.username when u.nickname is empty');
  process.exit(1);
}
console.log('OK: openProfileCompletionModal falls back to u.username');

// 2) 提交逻辑里也要兜底 username
const submitPattern = /authManager\.getCurrentUser\(\)\?\.nickname\s*\|\|\s*authManager\.getCurrentUser\(\)\?\.username/;
if (!submitPattern.test(appJs)) {
  console.log('FAIL: handleProfileCompletionSubmit should fall back to username for hidden nickname');
  process.exit(1);
}
console.log('OK: handleProfileCompletionSubmit falls back to username');

// 3) 迁移 007 必须存在
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
