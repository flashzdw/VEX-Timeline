// 验证赛队权限系统修复 + 成员角色胶囊
//   Bug 1: canEditRecord 应按赛队角色判定（不再误用 user_id 匹配）
//   Bug 2: 成员列表每行应包含身份胶囊 + 角色胶囊
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

process.on('unhandledRejection', () => {});

const appJs = fs.readFileSync(path.join(__dirname, 'src/js/app.js'), 'utf-8');
const wrapped = appJs + `;window.__vexApp = app;`;
try { window.eval(wrapped); } catch (e) {
  if (!window.__vexApp) { console.log('FAIL: cannot eval app.js:', e.message); process.exit(1); }
}
const app = window.__vexApp;

// ============================================================
// Part 1: canEditRecord 行为验证
// ============================================================
const myId = 'u-me';
const otherId = 'u-other';
const myUser = { id: myId, username: 'me', nickname: 'me', identity: 'student' };

// 准备一个 team timeline（由别人创建）
app.timelines = [
  { id: 'tl-personal', name: '个人时间轴', type: 'personal', owner_id: myId },
  { id: 'tl-team', name: '赛队时间轴', type: 'team', owner_id: 'u-someone-else' },
];
app.currentTimelineId = 'tl-team';

// 辅助：设置当前用户（authManager stub）
function setCurrentUser(u) {
  window.authManager.getCurrentUser = () => u;
  window.authManager.isLoggedIn = () => !!u;
}
// 默认 stub
window.authManager = {
  getCurrentUser: () => myUser,
  isLoggedIn: () => true,
};

const cases = [
  {
    name: '1. captain 在别人创建的赛队中 → 可改别人记录（核心 bug 修复）',
    role: 'captain',
    recordUserId: otherId,
    expect: true,
  },
  {
    name: '2. teacher 在别人创建的赛队中 → 可改别人记录',
    role: 'teacher',
    recordUserId: otherId,
    expect: true,
  },
  {
    name: '3. owner 在自己创建的赛队中 → 可改任何记录',
    role: 'owner',
    recordUserId: otherId,
    expect: true,
  },
  {
    name: '4. member → 仅可改自己的记录',
    role: 'member',
    recordUserId: myId,
    expect: true,
  },
  {
    name: '5. member → 不可改别人的记录',
    role: 'member',
    recordUserId: otherId,
    expect: false,
  },
  {
    name: '6. visitor → 不可改任何记录',
    role: 'visitor',
    recordUserId: otherId,
    expect: false,
  },
  {
    name: '7. 个人时间轴（role=null）→ 可改',
    role: null,
    recordUserId: otherId,
    expect: true,
  },
];

console.log('--- Part 1: canEditRecord ---');
let passed = 0;
for (const c of cases) {
  // 个人时间轴场景：切换到 personal
  if (c.role === null) {
    app.currentTimelineId = 'tl-personal';
    app._currentTimelineRole = null;
  } else {
    app.currentTimelineId = 'tl-team';
    app._currentTimelineRole = c.role;
  }
  const record = { user_id: c.recordUserId, id: 'r1' };
  const got = app.canEditRecord(record);
  // canDeleteRecord 转调 canEditRecord，一并验证
  const gotDel = app.canDeleteRecord(record);
  if (got !== c.expect || gotDel !== c.expect) {
    console.log(`FAIL: ${c.name}`);
    console.log(`   expect: edit=${c.expect} delete=${c.expect}`);
    console.log(`   got   : edit=${got} delete=${gotDel}`);
    process.exit(1);
  }
  console.log(`OK: ${c.name}  (edit=${got} delete=${gotDel})`);
  passed++;
}
console.log(`\n=== canEditRecord PASSED (${passed}/${cases.length}) ===`);

// ============================================================
// Part 2: 成员列表渲染验证（角色胶囊必须存在）
// ============================================================
console.log('\n--- Part 2: 成员列表渲染（角色胶囊）---');

const ownerUser = { id: 'u-owner', username: 'owner', nickname: 'owner', identity: 'student', real_name: '王老师' };
const captainUser = { id: 'u-cap', username: 'cap', nickname: 'cap', identity: 'student' };
const memberUser = { id: 'u-mem', username: 'mem', nickname: 'mem', identity: 'student' };
const visitorUser = { id: 'u-vis', username: 'vis', nickname: 'vis', identity: 'parent' };

// 模拟"我是 owner 看自己的赛队" — canManage=true
window.authManager.getCurrentUser = () => ({ id: myId, username: 'me', nickname: 'me' });
app._currentTimelineRole = 'owner';
app.currentTimelineId = 'tl-team';
app.timelines = [{ id: 'tl-team', name: '赛队时间轴', type: 'team', owner_id: myId }];

// 直接复用 _refreshMembersList 的渲染逻辑：mock getTimelineMembers 返回一组
window.cloudDBManager.getTimelineMembers = async () => [
  { user_id: 'u-owner', role: 'owner',  users: ownerUser },
  { user_id: 'u-cap',    role: 'captain', users: captainUser },
  { user_id: 'u-mem',    role: 'member',  users: memberUser },
  { user_id: 'u-vis',    role: 'visitor', users: visitorUser },
];

(async () => {
  await app._refreshMembersList();
  const html = doc.getElementById('members-list').innerHTML;

  // 期望：4 个角色胶囊（owner / captain / member / visitor）+ 3 个下拉（非 owner 行）
  const expectedTags = [
    'vx-member-role-tag--owner',
    'vx-member-role-tag--captain',
    'vx-member-role-tag--member',
    'vx-member-role-tag--visitor',
  ];
  for (const cls of expectedTags) {
    if (!html.includes(cls)) {
      console.log(`FAIL: 成员列表缺少角色胶囊 class "${cls}"`);
      process.exit(1);
    }
    console.log(`OK: 成员列表包含 ${cls}`);
  }

  // 期望：owner 行 不包含下拉（isOwnerRow 永远不可管理）
  // 通过 DOM 结构判断：找到含 vx-member-role-tag--owner 的行，检查该行是否含 vx-role-select
  const ownerRowMatch = html.match(/<div class="vx-member-row">[\s\S]*?vx-member-role-tag--owner[\s\S]*?<\/div>\s*<\/div>/);
  if (ownerRowMatch && ownerRowMatch[0].includes('vx-role-select')) {
    console.log('FAIL: owner 行不应包含 vx-role-select（下拉）');
    process.exit(1);
  }
  console.log('OK: owner 行不显示下拉');

  // 期望：captain / member / visitor 行有下拉（canManage=true && !isOwnerRow）
  if (!html.match(/<select class="vx-role-select" data-user-id="u-cap">/)) {
    console.log('FAIL: captain 行应有 vx-role-select');
    process.exit(1);
  }
  console.log('OK: captain 行有 vx-role-select');

  // 期望：身份胶囊 + 角色胶囊 并排显示（中间允许其他 HTML，但同一行内）
  // 简单断言：身份胶囊和角色胶囊都出现在同一行的 vx-member-name 内
  const sampleRow = html.match(/<div class="vx-member-name">[\s\S]*?<\/div>/);
  if (!sampleRow) { console.log('FAIL: 找不到 vx-member-name 容器'); process.exit(1); }
  const rowHtml = sampleRow[0];
  if (!rowHtml.includes('vx-member-identity-tag') || !rowHtml.includes('vx-member-role-tag')) {
    console.log('FAIL: 成员行内未同时包含身份胶囊和角色胶囊');
    process.exit(1);
  }
  console.log('OK: 成员行内同时包含身份胶囊 + 角色胶囊（并排显示）');

  console.log('\n=== 成员列表渲染验证 PASSED ===');
  console.log('\n=== PERMISSION + ROLE PILL ALL PASSED ===');
  process.exit(0);
})();
