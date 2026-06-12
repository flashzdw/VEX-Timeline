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
      'home.hero.subtitle': '为 VEX 战队打造的时间轴工具。',
      'home.hero.cta.primary': '开始使用',
      'home.hero.cta.secondary': '了解更多',
      'home.hero.feature.cloud': '云端同步',
      'home.hero.feature.team': '赛队协作',
      'home.hero.feature.media': '图片记录',

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
      'auth.username': '用户名',
      'auth.password': '密码',
      'auth.username.ph': '输入用户名',
      'auth.password.ph': '输入密码',
      'auth.login': '登录',
      'auth.register': '注册',
      'auth.back': '返回首页',
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

      'common.loading': '加载中…',
      'common.backHome': '返回首页',

      'home.toast.loginSuccess': '登录成功，正在进入应用…',
      'home.toast.enterNow': '立即进入'
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
      'home.hero.subtitle': 'A timeline tool built for VEX teams.',
      'home.hero.cta.primary': 'Get started',
      'home.hero.cta.secondary': 'Learn more',
      'home.hero.feature.cloud': 'Cloud sync',
      'home.hero.feature.team': 'Team collab',
      'home.hero.feature.media': 'Image notes',

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
      'auth.username': 'Username',
      'auth.password': 'Password',
      'auth.username.ph': 'Enter username',
      'auth.password.ph': 'Enter password',
      'auth.login': 'Sign in',
      'auth.register': 'Create account',
      'auth.back': 'Back to home',
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

      'common.loading': 'Loading…',
      'common.backHome': 'Back to home',

      'home.toast.loginSuccess': 'Signed in, entering app…',
      'home.toast.enterNow': 'Enter now'
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

  function t(key) {
    if (key == null) return '';
    var value = lookup(key, currentLang);
    if (value != null) return value;
    if (currentLang !== FALLBACK_LANG) {
      value = lookup(key, FALLBACK_LANG);
      if (value != null) return value;
    }
    return key;
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
  }

  function applyI18n() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var root = document.documentElement;
    root.setAttribute('lang', currentLang);
    root.setAttribute('dir', 'ltr');

    if (typeof document.body === 'undefined' || !document.body) return;
    var nodes = document.querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]');
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
