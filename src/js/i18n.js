/**
 * VEX-Timeline · i18n framework
 * - Simple IIFE, attached to window.i18n (no ES modules).
 * - Translation fallback chain: current language → English → the key itself.
 * - DOM application: scans [data-i18n] / [data-i18n-placeholder] / [data-i18n-title] / [data-i18n-aria-label]
 *   and replaces the text/attribute with the translation. Strings containing "<br/>" use innerHTML.
 */
(function () {
  'use strict';

  var DICT = {
    'zh-CN': {
      'site.name': 'VEX-Timeline',
      'site.tagline': '记录备赛每一天。',

      'nav.features': '功能',
      'nav.howto': '使用说明',
      'nav.faq': '常见问题',
      'nav.start': '开始使用',
      'nav.back': '返回首页',
      'nav.lang.label': '语言',
      'nav.lang.zh': '中文',
      'nav.lang.en': 'English',

      'home.hero.eyebrow': 'VEX ROBOTICS · 备赛时间轴',
      'home.hero.title': '记录备赛<br/>每一天。',
      'home.hero.subtitle': '让 VEX 团队的每一次设计、测试和优化都有迹可循。',
      'home.hero.cta.primary': '开始使用',
      'home.hero.cta.secondary': '了解更多',
      'home.hero.feature.cloud': '云端同步',
      'home.hero.feature.team': '赛队协作',
      'home.hero.feature.media': '图片记录',

      // Hero 右侧产品预览 mockup 文案（静态示意，与真实 UI 风格一致）
      'home.hero.mockup.tag.today': '今天 · 3 条记录',
      'home.hero.mockup.tag.cloud': '已同步',
      'home.hero.mockup.view.timeline': '时间轴',
      'home.hero.mockup.view.month': '月历',
      'home.hero.mockup.filter.label': '重要性',
      'home.hero.mockup.filter.all': '全部',
      'home.hero.mockup.filter.high': '高',
      'home.hero.mockup.filter.medium': '中',
      'home.hero.mockup.filter.low': '低',
      'home.hero.mockup.day1': '11 月 12 日 · 周三',
      'home.hero.mockup.day2': '11 月 11 日 · 周二',
      'home.hero.mockup.day3': '11 月 10 日 · 周一',
      'home.hero.mockup.record1.title': '调试底盘 · 重新校准陀螺仪',
      'home.hero.mockup.record1.content': '14:30 · 王潇 · 2 张图',
      'home.hero.mockup.record2.title': '测试新 intake 设计',
      'home.hero.mockup.record2.content': '10:15 · 团队',
      'home.hero.mockup.record3.title': '完成 CAD 初版',
      'home.hero.mockup.record3.content': '16:40 · 李想',
      'home.hero.mockup.record4.title': '团队讨论赛季策略',
      'home.hero.mockup.record4.content': '19:00 · 全员',

      'home.features.eyebrow': '核心功能',
      'home.features.title': '为备赛而生的四件套',
      'home.features.item1.title': '时间轴记录',
      'home.features.item1.desc': '按天记录每一次调试、改车、讨论，回看完整备赛路径。',
      'home.features.item2.title': '月历总览',
      'home.features.item2.desc': '一眼看到哪天有记录、哪天缺席，整月节奏尽在掌握。',
      'home.features.item3.title': '个人与赛队',
      'home.features.item3.desc': '个人时间轴与赛队时间轴自由切换，邀请码即可加入协作。',
      'home.features.item4.title': '云端同步',
      'home.features.item4.desc': '基于 Supabase 的实时同步，换设备也不丢数据。',

      'home.howto.eyebrow': '三步开始',
      'home.howto.title': '简单到不能再简单',
      'home.howto.step1.title': '注册账号',
      'home.howto.step1.desc': '一个用户名 + 密码，30 秒搞定。',
      'home.howto.step2.title': '创建时间轴',
      'home.howto.step2.desc': '个人时间轴用于私人记录，赛队时间轴可邀请队友。',
      'home.howto.step3.title': '添加每日记录',
      'home.howto.step3.desc': '标题 + 内容 + 重要性 + 图片（可选），随时回顾。',

      'home.faq.eyebrow': '常见问题',
      'home.faq.title': '你可能想知道',
      'home.faq.q1': '离线能用吗？',
      'home.faq.a1': '可以。数据会缓存到本地 IndexedDB，恢复网络后自动同步。',
      'home.faq.q2': '数据安全吗？',
      'home.faq.a2': '所有数据通过 Supabase 加密传输与存储；RLS 策略保证只有队友能看到赛队内容。',
      'home.faq.q3': '是否收费？',
      'home.faq.a3': '完全免费，源码 MIT 协议。',
      'home.faq.q4': '怎么邀请队友？',
      'home.faq.a4': '创建赛队时间轴后会生成 6 位邀请码，队友输入即可加入。',

      'home.cta.title': '准备好开始记录了吗？',
      'home.cta.subtitle': '下一个赛季，从今天开始。',
      'home.cta.button': '开始使用',

      'home.footer.copyright': '© 2026 VEX-Timeline · MIT License',
      'home.footer.built': 'Built with care for VEX teams.',

      'auth.welcome': '欢迎回来',
      'auth.subtitle': '登录 · 注册',
      'auth.hero.title': '记录备赛<br/>每一天。',
      'auth.hero.eyebrow': 'Personal & team timeline for VEX robotics.',
      'auth.hero.cloud': '云端同步',
      'auth.hero.team': '赛队协作',
      'auth.hero.media': '图片记录',
      'auth.username': '用户名',
      'auth.password': '密码',
      'auth.username.ph': '输入用户名',
      'auth.password.ph': '输入密码',
      'auth.nickname': '昵称',
      'auth.nickname.ph': '输入昵称（用于显示）',
      'auth.realName': '真实姓名',
      'auth.realName.ph': '输入真实姓名',
      'auth.identity': '身份',
      'auth.identity.student': '学生',
      'auth.identity.teacher': '老师',
      'auth.identity.teacher.surnameOnly': '仅填姓（推荐）',
      'auth.login': '登录',
      'auth.register': '注册',
      'auth.back': '返回首页',
      'auth.completion.title': '完善资料',
      'auth.completion.desc': '为了在赛队中更好地协作，请补全以下信息。',
      'auth.completion.skip': '稍后',
      'auth.completion.submit': '保存',
      'auth.error.notConfigured': '云端未配置，请联系管理员',
      'auth.error.required': '请输入用户名和密码',
      'auth.error.shortPassword': '密码长度至少 6 位',
      'auth.error.usernameFormat': '用户名只能包含字母、数字和下划线',
      'auth.error.invalid': '用户名或密码错误',
      'auth.error.emailConfirm': '请先在 Supabase 控制台确认邮箱',
      'auth.error.taken': '用户名已被占用',
      'auth.error.usernameRequired': '请输入用户名',
      'auth.error.passwordRequired': '请输入密码',
      'auth.error.usernameLength': '用户名长度需在 2-20 个字符之间',
      'auth.error.nicknameRequired': '请填写昵称',
      'auth.error.realNameRequired': '请填写真实姓名',
      'auth.error.identityRequired': '请选择身份（学生/老师）',
      'auth.error.realNameStudentTooShort': '学生姓名至少 2 个字符',
      'auth.error.realNameTeacherTooShort': '老师姓名至少 2 个字符',
      'auth.error.realNameTeacherSurname': '老师仅填姓时，姓名必须是 1 个字符',
      'auth.error.profileSaveFailed': '保存失败：',

      // === 主应用（时间轴 / 月历 / 模态框 / FAB / 错误） ===
      'app.view.timeline': '时间轴',
      'app.view.month': '月历',
      'app.timeline.unselected': '未选择',
      'app.timeline.all': '所有时间轴',
      'app.timeline.create': '创建时间轴',
      'app.timeline.createTitle': '创建时间轴',
      'app.timeline.name': '时间轴名称',
      'app.timeline.namePh': '输入时间轴名称',
      'app.timeline.type.personal': '个人',
      'app.timeline.type.team': '赛队',
      'app.term.personalTimeline': '个人时间轴',
      'app.term.teamTimeline': '赛队时间轴',
      'app.timeline.created': '已创建时间轴',
      'app.timeline.createFail': '创建失败: ',
      'app.timeline.inviteCode': '邀请码',
      'app.timeline.copy': '复制邀请码',
      'app.timeline.copied': '已复制',
      'app.timeline.refresh': '点击刷新云端',

      'app.filter.label': '重要性',
      'app.filter.all': '全部',
      'app.filter.high': '高',
      'app.filter.medium': '中',
      'app.filter.low': '低',
      'app.importance.high': '高',
      'app.importance.medium': '中',
      'app.importance.low': '低',

      'app.fab.add': '添加记录',
      'app.fab.cantAdd': '云端连接失败，无法添加记录',
      'app.fab.readOnly': '访客权限，仅可查看',

      'app.modal.addTitle': '添加记录',
      'app.modal.editTitle': '编辑记录',
      'app.modal.date': '日期',
      'app.modal.time': '时间',
      'app.modal.importance': '重要性',
      'app.modal.title': '标题',
      'app.modal.titlePh': '请输入标题',
      'app.modal.content': '内容',
      'app.modal.contentPh': '请输入内容',
      'app.modal.image': '图片',
      'app.modal.chooseFile': '选择文件',
      'app.modal.noFile': '未选择任何文件',
      'app.modal.fileSelected': '已选择图片',
      'app.modal.cancel': '取消',
      'app.modal.save': '保存',
      'app.modal.titleReq': '请输入标题',
      'app.modal.dateReq': '请选择日期',
      'app.modal.confirmDelete': '确定要删除这条记录吗？',
      'app.modal.saved': '已保存',
      'app.modal.deleted': '已删除',
      'app.modal.unknownError': '未知错误',

      'app.team.createTitle': '创建赛队时间轴',
      'app.team.joinTitle': '加入赛队',
      'app.team.manageTitle': '管理赛队',
      'app.team.nameLabel': '时间轴名称',
      'app.team.namePh': '输入赛队时间轴名称',
      'app.team.inviteCode': '邀请码',
      'app.team.members': '成员列表',
      'app.team.roleOwner': '所有者',
      'app.team.roleCaptain': '队长',
      'app.team.roleTeacher': '老师',
      'app.team.roleMember': '队员',
      'app.team.roleVisitor': '访客',
      'app.team.deleteTeam': '删除赛队',
      'app.team.confirmDeleteTeam': '确定要删除这个赛队时间轴吗？此操作不可撤销。',
      'app.team.teamDeleted': '赛队已删除',
      'app.team.teamDeleteFail': '删除赛队失败：',
      'app.team.regenerateInvite': '重置邀请码',
      'app.team.regenerateInviteConfirm': '重置邀请码后旧码将立即失效，确定吗？',
      'app.team.inviteRegenerated': '邀请码已重置',
      'app.team.noMembers': '暂无成员',
      'app.team.membersFail': '加载成员失败: ',
      'app.team.memberRemoved': '已移除成员',
      'app.team.removeFail': '移除失败: ',
      'app.team.confirmRemoveMember': '确定要移除该成员吗？',
      'app.team.roleUpdateFail': '更新角色失败：',
      'app.team.roleUpdated': '角色已更新',
      'app.team.selectTeam': '请先在时间轴下拉中选择一个赛队',
      'app.team.create': '创建赛队',
      'app.team.join': '加入赛队',
      'app.team.manage': '管理赛队',
      'app.team.joined': '已加入赛队',
      'app.team.joinFail': '加入失败',
      'app.team.close': '关闭',

      'app.user.logout': '登出',
      'app.user.unlogged': '未登录',
      'app.user.unknown': '未知',
      'app.user.you': '你',
      'app.user.account': '账号',

      'app.day.sun': '日',
      'app.day.mon': '一',
      'app.day.tue': '二',
      'app.day.wed': '三',
      'app.day.thu': '四',
      'app.day.fri': '五',
      'app.day.sat': '六',
      'app.day.full.sun': '周日',
      'app.day.full.mon': '周一',
      'app.day.full.tue': '周二',
      'app.day.full.wed': '周三',
      'app.day.full.thu': '周四',
      'app.day.full.fri': '周五',
      'app.day.full.sat': '周六',
      'app.month.1': '1月',
      'app.month.2': '2月',
      'app.month.3': '3月',
      'app.month.4': '4月',
      'app.month.5': '5月',
      'app.month.6': '6月',
      'app.month.7': '7月',
      'app.month.8': '8月',
      'app.month.9': '9月',
      'app.month.10': '10月',
      'app.month.11': '11月',
      'app.month.12': '12月',
      'app.dateFormat': '{y}年{m}月{d}日 {wd}',
      'app.dateFormat.short': '{y}年 {m}',

      'app.empty.timeline': '请先选择时间轴',
      'app.empty.records': '暂无记录',
      'app.empty.loading': '加载中…',
      'app.empty.fail': '加载失败: ',

      'app.cloud.notConfigured': '云端未配置',
      'app.cloud.connected': '云端已连接',
      'app.cloud.syncing': '同步中',
      'app.cloud.error': '云端错误: ',
      'app.cloud.offline': '离线',
      'app.cloud.unknown': '未知',
      'app.cloud.refreshing': '正在从云端刷新…',
      'app.cloud.refreshed': '云端数据已同步',
      'app.cloud.refreshFailed': '刷新失败: ',
      'app.cloud.retryFailed': '重试失败: ',
      'app.cloud.broken': '云端服务暂不可用，请稍后再试或联系管理员',
      'app.cloud.syncFail': '同步云端记录失败: ',
      'app.cloud.unreachable': '无法连接到云端',
      'app.cloud.retry': '重试',

      'app.toast.loginFirst': '请先登录并选择时间轴',
      'app.toast.syncing': '正在同步中，请稍候',
      'app.toast.profileSaved': '资料已保存',
      'app.toast.retrying': '正在重试…',
      'app.toast.copied': '已复制',

      'app.action.edit': '编辑',
      'app.action.delete': '删除',
      'app.action.copied': '已复制',

      'app.diag.urlSet': '<span class="text-secondary font-bold">✓</span> 已设置',
      'app.diag.urlUnset': '<span class="text-primary font-bold">✗ 未配置</span>',
      'app.diag.keySet': '<span class="text-secondary font-bold">✓</span> 已设置',
      'app.diag.keyUnset': '<span class="text-primary font-bold">✗ 未配置</span>',
      'app.diag.sessionOut': '<span class="text-accent font-bold">⊘ 未登录</span>',
      'app.diag.sessionIn': '<span class="text-secondary font-bold">✓ 已登录</span>',
      'app.diag.timeline': '时间轴: ',
      'app.diag.urlLabel': 'URL: ',
      'app.diag.keyLabel': 'Key: ',
      'app.diag.sessionLabel': 'Session: ',

      'common.loading': '加载中…',
      'common.backHome': '返回首页',

      'home.toast.loginSuccess': '登录成功',
      'home.toast.enterNow': '立即进入',

      'app.modal.preview': '预览',
      'app.picker.currentMonth': '当前月份',
      'app.team.invitePh': '输入 6 位邀请码',
      'app.team.inviteTitle': '邀请成员',
      'app.cloud.errorTitle': '云端连接失败',

      'app.drawer.shortcut': '快捷操作',
      'app.drawer.add': '添加记录',
      'app.drawer.refreshCloud': '刷新云端',
      'app.drawer.timelines': '时间轴',
      'app.drawer.teams': '赛队'
    },
    'en': {
      'site.name': 'VEX-Timeline',
      'site.tagline': 'Track every day of your build season.',

      'nav.features': 'Features',
      'nav.howto': 'How to use',
      'nav.faq': 'FAQ',
      'nav.start': 'Get started',
      'nav.back': 'Back to home',
      'nav.lang.label': 'Language',
      'nav.lang.zh': '中文',
      'nav.lang.en': 'English',

      'home.hero.eyebrow': 'VEX ROBOTICS · BUILD TIMELINE',
      'home.hero.title': 'Track every day<br/>of build season.',
      'home.hero.subtitle': 'Every design, test, and iteration — traceable for your VEX team.',
      'home.hero.cta.primary': 'Get started',
      'home.hero.cta.secondary': 'Learn more',
      'home.hero.feature.cloud': 'Cloud sync',
      'home.hero.feature.team': 'Team collab',
      'home.hero.feature.media': 'Image notes',

      // Hero right-side product preview mockup copy (static illustration matching real UI)
      'home.hero.mockup.tag.today': 'Today · 3 logs',
      'home.hero.mockup.tag.cloud': 'Synced',
      'home.hero.mockup.view.timeline': 'Timeline',
      'home.hero.mockup.view.month': 'Month',
      'home.hero.mockup.filter.label': 'Importance',
      'home.hero.mockup.filter.all': 'All',
      'home.hero.mockup.filter.high': 'High',
      'home.hero.mockup.filter.medium': 'Med',
      'home.hero.mockup.filter.low': 'Low',
      'home.hero.mockup.day1': 'Nov 12 · Wed',
      'home.hero.mockup.day2': 'Nov 11 · Tue',
      'home.hero.mockup.day3': 'Nov 10 · Mon',
      'home.hero.mockup.record1.title': 'Chassis tuning · IMU recalibration',
      'home.hero.mockup.record1.content': '14:30 · Alex · 2 photos',
      'home.hero.mockup.record2.title': 'New intake prototype test',
      'home.hero.mockup.record2.content': '10:15 · Team',
      'home.hero.mockup.record3.title': 'CAD v1 locked in',
      'home.hero.mockup.record3.content': '16:40 · Sam',
      'home.hero.mockup.record4.title': 'Season strategy meeting',
      'home.hero.mockup.record4.content': '19:00 · All hands',

      'home.features.eyebrow': 'CORE FEATURES',
      'home.features.title': 'Four essentials for build season',
      'home.features.item1.title': 'Timeline logging',
      'home.features.item1.desc': 'Log every tweak, every test, every meeting — by day.',
      'home.features.item2.title': 'Calendar overview',
      'home.features.item2.desc': 'See your whole month at a glance.',
      'home.features.item3.title': 'Solo & team',
      'home.features.item3.desc': 'Switch between personal and team timelines, join via invite code.',
      'home.features.item4.title': 'Cloud sync',
      'home.features.item4.desc': 'Supabase-backed realtime sync, your data follows you.',

      'home.howto.eyebrow': 'GET STARTED IN 3 STEPS',
      'home.howto.title': 'As simple as it gets',
      'home.howto.step1.title': 'Create an account',
      'home.howto.step1.desc': 'A username and a password — that\'s it.',
      'home.howto.step2.title': 'Create a timeline',
      'home.howto.step2.desc': 'Personal for solo work, team for shared logs.',
      'home.howto.step3.title': 'Add daily logs',
      'home.howto.step3.desc': 'Title, notes, importance, optional image.',

      'home.faq.eyebrow': 'FAQ',
      'home.faq.title': 'Things you may want to know',
      'home.faq.q1': 'Can I use it offline?',
      'home.faq.a1': 'Yes. Data is cached in IndexedDB and synced when you\'re back online.',
      'home.faq.q2': 'Is my data safe?',
      'home.faq.a2': 'All data is encrypted in transit and at rest via Supabase; RLS keeps team data private.',
      'home.faq.q3': 'Is it free?',
      'home.faq.a3': 'Completely free, MIT licensed.',
      'home.faq.q4': 'How do I invite teammates?',
      'home.faq.a4': 'After creating a team timeline, share the 6-digit invite code.',

      'home.cta.title': 'Ready to start logging?',
      'home.cta.subtitle': 'Your next season starts today.',
      'home.cta.button': 'Get started',

      'home.footer.copyright': '© 2026 VEX-Timeline · MIT License',
      'home.footer.built': 'Built with care for VEX teams.',

      'auth.welcome': 'Welcome back',
      'auth.subtitle': 'Sign in · Sign up',
      'auth.hero.title': 'Track every day<br/>of build season.',
      'auth.hero.eyebrow': 'Personal & team timeline for VEX robotics.',
      'auth.hero.cloud': 'Cloud sync',
      'auth.hero.team': 'Team collab',
      'auth.hero.media': 'Image logs',
      'auth.username': 'Username',
      'auth.password': 'Password',
      'auth.username.ph': 'Enter username',
      'auth.password.ph': 'Enter password',
      'auth.nickname': 'Nickname',
      'auth.nickname.ph': 'Enter nickname (for display)',
      'auth.realName': 'Real name',
      'auth.realName.ph': 'Enter your real name',
      'auth.identity': 'Identity',
      'auth.identity.student': 'Student',
      'auth.identity.teacher': 'Teacher',
      'auth.identity.teacher.surnameOnly': 'Surname only (recommended)',
      'auth.login': 'Sign in',
      'auth.register': 'Create account',
      'auth.back': 'Back to home',
      'auth.completion.title': 'Complete your profile',
      'auth.completion.desc': 'To collaborate with your team, please fill in the following info.',
      'auth.completion.skip': 'Later',
      'auth.completion.submit': 'Save',
      'auth.error.notConfigured': 'Cloud not configured, contact admin',
      'auth.error.required': 'Please enter username and password',
      'auth.error.shortPassword': 'Password must be at least 6 characters',
      'auth.error.usernameFormat': 'Username may only contain letters, digits and underscore',
      'auth.error.invalid': 'Invalid username or password',
      'auth.error.emailConfirm': 'Please confirm your email in Supabase first',
      'auth.error.taken': 'Username already taken',
      'auth.error.usernameRequired': 'Please enter your username',
      'auth.error.passwordRequired': 'Please enter your password',
      'auth.error.usernameLength': 'Username must be 2-20 characters',
      'auth.error.nicknameRequired': 'Please enter a nickname',
      'auth.error.realNameRequired': 'Please enter your real name',
      'auth.error.identityRequired': 'Please choose an identity (student/teacher)',
      'auth.error.realNameStudentTooShort': 'Student name must be at least 2 characters',
      'auth.error.realNameTeacherTooShort': 'Teacher name must be at least 2 characters',
      'auth.error.realNameTeacherSurname': 'When surname-only, name must be exactly 1 character',
      'auth.error.profileSaveFailed': 'Save failed: ',

      // === Main app (timeline / calendar / modal / FAB / errors) ===
      'app.view.timeline': 'Timeline',
      'app.view.month': 'Month',
      'app.timeline.unselected': 'Unselected',
      'app.timeline.all': 'All timelines',
      'app.timeline.create': 'Create timeline',
      'app.timeline.createTitle': 'Create timeline',
      'app.timeline.name': 'Timeline name',
      'app.timeline.namePh': 'Enter timeline name',
      'app.timeline.type.personal': 'Personal',
      'app.timeline.type.team': 'Team',
      'app.term.personalTimeline': 'Personal timeline',
      'app.term.teamTimeline': 'Team timeline',
      'app.timeline.created': 'Timeline created',
      'app.timeline.createFail': 'Create failed: ',
      'app.timeline.inviteCode': 'Invite code',
      'app.timeline.copy': 'Copy invite code',
      'app.timeline.copied': 'Copied',
      'app.timeline.refresh': 'Click to refresh cloud',

      'app.filter.label': 'Importance',
      'app.filter.all': 'All',
      'app.filter.high': 'High',
      'app.filter.medium': 'Medium',
      'app.filter.low': 'Low',
      'app.importance.high': 'High',
      'app.importance.medium': 'Medium',
      'app.importance.low': 'Low',

      'app.fab.add': 'Add record',
      'app.fab.cantAdd': 'Cloud unavailable, cannot add',
      'app.fab.readOnly': 'Visitor: read-only',

      'app.modal.addTitle': 'Add record',
      'app.modal.editTitle': 'Edit record',
      'app.modal.date': 'Date',
      'app.modal.time': 'Time',
      'app.modal.importance': 'Importance',
      'app.modal.title': 'Title',
      'app.modal.titlePh': 'Enter title',
      'app.modal.content': 'Content',
      'app.modal.contentPh': 'Enter content',
      'app.modal.image': 'Image',
      'app.modal.chooseFile': 'Choose file',
      'app.modal.noFile': 'No file chosen',
      'app.modal.fileSelected': 'Image selected',
      'app.modal.cancel': 'Cancel',
      'app.modal.save': 'Save',
      'app.modal.titleReq': 'Title is required',
      'app.modal.dateReq': 'Date is required',
      'app.modal.confirmDelete': 'Delete this record?',
      'app.modal.saved': 'Saved',
      'app.modal.deleted': 'Deleted',
      'app.modal.unknownError': 'Unknown error',

      'app.team.createTitle': 'Create team timeline',
      'app.team.joinTitle': 'Join team',
      'app.team.manageTitle': 'Manage team',
      'app.team.nameLabel': 'Timeline name',
      'app.team.namePh': 'Enter team timeline name',
      'app.team.inviteCode': 'Invite code',
      'app.team.members': 'Members',
      'app.team.roleOwner': 'Owner',
      'app.team.roleCaptain': 'Captain',
      'app.team.roleTeacher': 'Teacher',
      'app.team.roleMember': 'Member',
      'app.team.roleVisitor': 'Visitor',
      'app.team.deleteTeam': 'Delete team',
      'app.team.confirmDeleteTeam': 'Delete this team timeline? This cannot be undone.',
      'app.team.teamDeleted': 'Team deleted',
      'app.team.teamDeleteFail': 'Delete team failed: ',
      'app.team.regenerateInvite': 'Reset invite code',
      'app.team.regenerateInviteConfirm': 'Reset invite code? The old code will be invalidated immediately.',
      'app.team.inviteRegenerated': 'Invite code reset',
      'app.team.noMembers': 'No members yet',
      'app.team.membersFail': 'Load members failed: ',
      'app.team.memberRemoved': 'Member removed',
      'app.team.removeFail': 'Remove failed: ',
      'app.team.confirmRemoveMember': 'Remove this member?',
      'app.team.roleUpdateFail': 'Update role failed: ',
      'app.team.roleUpdated': 'Role updated',
      'app.team.selectTeam': 'Please pick a team timeline from the dropdown first',
      'app.team.create': 'Create team',
      'app.team.join': 'Join team',
      'app.team.manage': 'Manage team',
      'app.team.joined': 'Joined team',
      'app.team.joinFail': 'Join failed',
      'app.team.close': 'Close',

      'app.user.logout': 'Sign out',
      'app.user.unlogged': 'Not signed in',
      'app.user.unknown': 'Unknown',
      'app.user.you': 'You',
      'app.user.account': 'Account',

      'app.day.sun': 'Sun',
      'app.day.mon': 'Mon',
      'app.day.tue': 'Tue',
      'app.day.wed': 'Wed',
      'app.day.thu': 'Thu',
      'app.day.fri': 'Fri',
      'app.day.sat': 'Sat',
      'app.day.full.sun': 'Sunday',
      'app.day.full.mon': 'Monday',
      'app.day.full.tue': 'Tuesday',
      'app.day.full.wed': 'Wednesday',
      'app.day.full.thu': 'Thursday',
      'app.day.full.fri': 'Friday',
      'app.day.full.sat': 'Saturday',
      'app.month.1': 'Jan',
      'app.month.2': 'Feb',
      'app.month.3': 'Mar',
      'app.month.4': 'Apr',
      'app.month.5': 'May',
      'app.month.6': 'Jun',
      'app.month.7': 'Jul',
      'app.month.8': 'Aug',
      'app.month.9': 'Sep',
      'app.month.10': 'Oct',
      'app.month.11': 'Nov',
      'app.month.12': 'Dec',
      'app.dateFormat': '{wd}, {m} {d}, {y}',
      'app.dateFormat.short': '{m} {y}',

      'app.empty.timeline': 'Pick a timeline first',
      'app.empty.records': 'No records yet',
      'app.empty.loading': 'Loading…',
      'app.empty.fail': 'Load failed: ',

      'app.cloud.notConfigured': 'Cloud not configured',
      'app.cloud.connected': 'Cloud connected',
      'app.cloud.syncing': 'Syncing',
      'app.cloud.error': 'Cloud error: ',
      'app.cloud.offline': 'Offline',
      'app.cloud.unknown': 'Unknown',
      'app.cloud.refreshing': 'Refreshing from cloud…',
      'app.cloud.refreshed': 'Cloud data synced',
      'app.cloud.refreshFailed': 'Refresh failed: ',
      'app.cloud.retryFailed': 'Retry failed: ',
      'app.cloud.broken': 'Cloud service unavailable. Retry later or contact admin.',
      'app.cloud.syncFail': 'Cloud sync failed: ',
      'app.cloud.unreachable': 'Could not connect to cloud',
      'app.cloud.retry': 'Retry',

      'app.toast.loginFirst': 'Sign in and pick a timeline first',
      'app.toast.syncing': 'Syncing, please wait',
      'app.toast.profileSaved': 'Profile saved',
      'app.toast.retrying': 'Retrying…',
      'app.toast.copied': 'Copied',

      'app.action.edit': 'Edit',
      'app.action.delete': 'Delete',
      'app.action.copied': 'Copied',

      'app.diag.urlSet': '<span class="text-secondary font-bold">✓</span> set',
      'app.diag.urlUnset': '<span class="text-primary font-bold">✗ missing</span>',
      'app.diag.keySet': '<span class="text-secondary font-bold">✓</span> set',
      'app.diag.keyUnset': '<span class="text-primary font-bold">✗ missing</span>',
      'app.diag.sessionOut': '<span class="text-accent font-bold">⊘ signed out</span>',
      'app.diag.sessionIn': '<span class="text-secondary font-bold">✓ signed in</span>',
      'app.diag.timeline': 'Timeline: ',
      'app.diag.urlLabel': 'URL: ',
      'app.diag.keyLabel': 'Key: ',
      'app.diag.sessionLabel': 'Session: ',

      'common.loading': 'Loading…',
      'common.backHome': 'Back to home',

      'home.toast.loginSuccess': 'Signed in',
      'home.toast.enterNow': 'Enter now',

      'app.modal.preview': 'Preview',
      'app.picker.currentMonth': 'Current month',
      'app.team.invitePh': 'Enter 6-digit invite code',
      'app.team.inviteTitle': 'Invite members',
      'app.cloud.errorTitle': 'Cloud connection failed',

      'app.drawer.shortcut': 'Shortcuts',
      'app.drawer.add': 'Add record',
      'app.drawer.refreshCloud': 'Refresh cloud',
      'app.drawer.timelines': 'Timelines',
      'app.drawer.teams': 'Teams'
    }
  };

  var STORAGE_KEY = 'vex.lang';
  var AVAILABLE = ['zh-CN', 'en'];
  var FALLBACK_LANG = 'en';

  function isSupported(lang) {
    return AVAILABLE.indexOf(lang) !== -1;
  }

  function getInitialLanguage() {
    try {
      var stored = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if (isSupported(stored)) return stored;
    } catch (e) { /* ignore */ }
    return 'zh-CN';
  }

  var currentLang = getInitialLanguage();

  function lookup(key, lang) {
    var dict = DICT[lang];
    if (dict && Object.prototype.hasOwnProperty.call(dict, key) && dict[key] != null) {
      return dict[key];
    }
    return null;
  }

  function t(key, vars) {
    if (key == null) return '';
    var value = lookup(key, currentLang);
    if (value == null && currentLang !== FALLBACK_LANG) {
      value = lookup(key, FALLBACK_LANG);
    }
    if (value == null) value = key;
    if (vars && typeof value === 'string') {
      value = value.replace(/\{(\w+)\}/g, function (_m, name) {
        return (vars[name] != null) ? String(vars[name]) : _m;
      });
    }
    return value;
  }

  function containsBr(s) {
    return typeof s === 'string' && s.indexOf('<br/>') !== -1;
  }

  function setText(node, value) {
    if (containsBr(value)) {
      node.innerHTML = value;
    } else {
      node.textContent = value;
    }
  }

  function applyToElement(node) {
    if (!node || node.nodeType !== 1) return;

    var key = node.getAttribute('data-i18n');
    if (key) {
      setText(node, t(key));
    }

    var phKey = node.getAttribute('data-i18n-placeholder');
    if (phKey) {
      node.setAttribute('placeholder', t(phKey));
    }

    var titleKey = node.getAttribute('data-i18n-title');
    if (titleKey) {
      node.setAttribute('title', t(titleKey));
    }

    var ariaKey = node.getAttribute('data-i18n-aria-label');
    if (ariaKey) {
      node.setAttribute('aria-label', t(ariaKey));
    }

    var altKey = node.getAttribute('data-i18n-alt');
    if (altKey) {
      node.setAttribute('alt', t(altKey));
    }
  }

  function applyI18n() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var root = document.documentElement;
    root.setAttribute('lang', currentLang);
    root.setAttribute('dir', 'ltr');

    if (typeof document.body === 'undefined' || !document.body) return;
    var nodes = document.querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-alt]');
    if (!nodes || !nodes.length) return; // no nodes yet — do nothing silently
    for (var i = 0; i < nodes.length; i++) {
      applyToElement(nodes[i]);
    }
  }

  function setLanguage(lang) {
    if (!isSupported(lang)) lang = 'zh-CN';
    currentLang = lang;
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* ignore quota / privacy mode */ }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', 'ltr');
    }
    if (typeof document !== 'undefined') {
      document.title = (lang === 'en')
        ? 'VEX-Timeline — Build Season Timeline'
        : 'VEX-Timeline';
    }
    applyI18n();
  }

  function getLanguage() {
    return currentLang;
  }

  function getAvailableLanguages() {
    return AVAILABLE.slice();
  }

  window.i18n = {
    t: t,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    applyI18n: applyI18n,
    getAvailableLanguages: getAvailableLanguages
  };
})();
