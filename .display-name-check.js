// 验证显示名解析函数的输出格式
//   getDisplayName   → 短名：仅昵称
//   getFullDisplayName → 长名：昵称（真实姓名）
//
// 用 jsdom + 真实执行 app.js 的方式拿到 App 实例。
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
// 去除 <script> 标签避免 jsdom 试图执行 tailwind 等外部依赖
const stripped = html.replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(stripped, {
  url: 'http://localhost:8080/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});
const { window } = dom;

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
// 老版本用 dbManager（idb），新版本用 cloudDBManager → 两者都 stub 一下
window.dbManager = { initDB: async () => {}, getTimelines: async () => [] };
window.cloudDBManager = {
  isConfigured: () => false,
  getClient: () => null,
  getTimelines: async () => [],
  init: async () => {},
};
// 兼容 app.js 末尾对 cloudDBManager / authManager 的全局引用
window.authManager = { getCurrentUser: () => null, isLoggedIn: () => false };

// 屏蔽 jsdom 沙箱里跑 app.js 时的未处理拒绝
process.on('unhandledRejection', () => {});

// 在 window 上下文里直接 eval app.js，捕获 app 引用
const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');

// 在 jsdom 沙箱里跑：声明 class App，构造时 app 暴露到 window 上
// 注意：App 构造里会调 init()，jsdom 缺 dbManager 等依赖 → init 会抛错
//       我们用 try/catch 吞掉这个抛错，只取 app 的方法
const wrapped = appJs + `
;window.__vexApp = app;
`;
try {
  window.eval(wrapped);
} catch (e) {
  // 即使 init 抛错，App 实例已构造好，__vexApp 也已设置
  // 仅在 app 不存在时才报错
  if (!window.__vexApp) {
    console.log('FAIL: cannot evaluate app.js in jsdom:', e.message);
    process.exit(1);
  }
}
const app = window.__vexApp;
if (!app) {
  console.log('FAIL: window.__vexApp not set');
  process.exit(1);
}
if (typeof app.getDisplayName !== 'function' || typeof app.getFullDisplayName !== 'function') {
  console.log('FAIL: app missing getDisplayName / getFullDisplayName methods');
  process.exit(1);
}

const getDisplayName    = (u) => app.getDisplayName(u);
const getFullDisplayName = (u) => app.getFullDisplayName(u);

const cases = [
  {
    name: '短名：仅 nickname',
    input: { nickname: '小张', username: 'zhangsan', real_name: '张三' },
    expectShort: '小张',
    expectFull: '小张（张三）',
  },
  {
    name: '老用户 fallback：username 顶上',
    input: { username: 'laowang', nickname: null, real_name: '' },
    expectShort: 'laowang',
    expectFull: 'laowang',
  },
  {
    name: '老师仅填姓：昵称（X 老师）',
    input: { nickname: '王队', username: 'wang', real_name: '王', identity: 'teacher', name_only_surname: true },
    expectShort: '王队',
    expectFull: '王队（王老师）',
  },
  {
    name: '家长仅填姓：昵称（X），不自动加"老师"后缀',
    input: { nickname: '张爸', username: 'zhangbaba', real_name: '张', identity: 'parent', name_only_surname: true },
    expectShort: '张爸',
    expectFull: '张爸（张）',     // parent 不带"老师"后缀
  },
  {
    name: '学生：昵称（真实姓名）',
    input: { nickname: '东炜', username: 'zdw', real_name: '张东炜', identity: 'student' },
    expectShort: '东炜',
    expectFull: '东炜（张东炜）',
  },
  {
    name: '真实姓名为空：退化为仅昵称',
    input: { nickname: 'momo', username: 'momo', real_name: '' },
    expectShort: 'momo',
    expectFull: 'momo',
  },
  {
    name: 'null user 兜底',
    input: null,
    expectShort: 'User',
    expectFull: 'User',
  },
];

let passed = 0;
for (const c of cases) {
  const gotShort = getDisplayName(c.input);
  const gotFull  = getFullDisplayName(c.input);
  const okShort = gotShort === c.expectShort;
  const okFull  = gotFull === c.expectFull;
  if (!okShort || !okFull) {
    console.log(`FAIL: ${c.name}`);
    console.log(`   input: ${JSON.stringify(c.input)}`);
    console.log(`   expectShort: "${c.expectShort}", got: "${gotShort}" ${okShort ? '✓' : '✗'}`);
    console.log(`   expectFull : "${c.expectFull}",  got: "${gotFull}" ${okFull ? '✓' : '✗'}`);
    process.exit(1);
  }
  console.log(`OK: ${c.name}`);
  passed++;
}

console.log(`\n=== DISPLAY NAME FORMAT PASSED (${passed}/${cases.length}) ===`);
