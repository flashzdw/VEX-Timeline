/**
 * VEX-Timeline 主应用类
 * ----------------------------------------
 * 业务逻辑（DB / Supabase / IndexedDB 同步）保持与 v1 兼容；
 * UI 选择器、菜单交互、渲染模板已迁移到 DESIGN.md 规范
 * （Flat Design / Tailwind class / lucide 图标 / 色块化）。
 */
class App {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'timeline';
    this.records = [];
    this.editingRecord = null;
    this.currentFilter = 'all';
    this.tempImageData = null;
    this.tempImageFileName = null;  // 新建场景下用户当前选中的文件 name；编辑模式 / 未选时为 null
    this.currentTimelineId = this._loadStoredTimelineId() || null;
    this.timelines = [];
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.cloudSyncStatus = 'unknown';
    this.cloudErrorMessage = '';

    this.init();
  }

  // ============================================================
  // 持久化
  // ============================================================
  _loadStoredTimelineId() {
    try { return localStorage.getItem('vex_current_timeline_id'); }
    catch (e) { return null; }
  }

  _saveStoredTimelineId(id) {
    try {
      if (id) localStorage.setItem('vex_current_timeline_id', id);
      else localStorage.removeItem('vex_current_timeline_id');
    } catch (e) { /* ignore */ }
  }

  // ============================================================
  // 初始化
  // ============================================================
  async init() {
    await dbManager.initDB();
    supabaseManager.init();
    await authManager.init();

    // 关键：等 user profile 就绪（session 可能先就绪，profile 还在加载中），
    // 否则后续 onLoginSuccess 中访问 authManager.getCurrentUser().id 会 throw
    await this._waitForUserProfile(3000);

    this.bindEvents();
    this.setupNetworkListener();
    this.renderDiagnosticBar();

    // Round 5：启动 5 分钟自动刷新云端
    this._startAutoRefresh();

    if (authManager.isLoggedIn()) {
      if (supabaseManager.isConfigured()) {
        // 冷启动且已登录 → 直接进入主应用（保留既有用户习惯）
        await this.onLoginSuccess({ directToApp: true });
      } else {
        console.warn('[VEX-Timeline] Session exists but Supabase not configured. Clearing session.');
        await authManager.logout();
        this.showHomePage();
      }
    } else {
      // 未登录 → 显示首页（首屏）
      this.showHomePage();
    }
  }

  /**
   * 等待 user profile 就绪（最多 maxMs 毫秒）
   * - 已就绪 → 立即返回 true
   * - 未登录（无 session）→ 立即返回 false
   * - 已登录但 profile 还在加载中 → 轮询等待
   * - 超时 → 返回 false（外层会显示错误条）
   */
  async _waitForUserProfile(maxMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (authManager.getCurrentUser()) return true;
      if (!authManager.session) return false;  // 未登录直接退出
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  // ============================================================
  // 页面切换：首页 / 登录页 / 主应用
  // ============================================================
  /**
   * 显示官网首页（首屏）
   * - 隐藏登录页与主应用容器
   * - 顶栏：显示锚点导航 + "开始使用"，隐藏"返回首页"
   * - 隐藏冷启动遮罩
   */
  showHomePage() {
    this._hideAppLoading();
    const home = document.getElementById('home-page');
    const auth = document.getElementById('auth-page');
    const container = document.querySelector('.container');
    if (home) home.classList.remove('hidden');
    if (auth) auth.classList.add('hidden');
    if (container) container.classList.add('hidden');
    this._syncSiteHeader('home');
    // 每次切到首页都滚到顶部
    try { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); } catch (e) { window.scrollTo(0, 0); }
  }

  /** 隐藏首页（用于登录成功或登出时短暂停留后离开） */
  hideHomePage() {
    const home = document.getElementById('home-page');
    if (home) home.classList.add('hidden');
  }

  /**
   * 显示登录页（第二屏）
   * - 从首页 / 登出后进入
   * - 顶栏：隐藏锚点导航与"开始使用"，显示"返回首页"
   */
  goToAuth() {
    const home = document.getElementById('home-page');
    const auth = document.getElementById('auth-page');
    const container = document.querySelector('.container');
    if (home) home.classList.add('hidden');
    if (auth) auth.classList.remove('hidden');
    if (container) container.classList.add('hidden');
    this._syncSiteHeader('auth');
    // 每次进入登录页：默认显示登录视图（防止上次切到注册视图残留）
    this.switchAuthView('login');
    try { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); } catch (e) { window.scrollTo(0, 0); }
  }

  /**
   * 进入主应用（`.container`）
   * - 隐藏首页 + 登录页
   * - 顶栏：完全隐藏（主应用内部有自己的 header）
   */
  showMainApp() {
    const home = document.getElementById('home-page');
    const auth = document.getElementById('auth-page');
    const container = document.querySelector('.container');
    if (home) home.classList.add('hidden');
    if (auth) auth.classList.add('hidden');
    if (container) container.classList.remove('hidden');
    this._syncSiteHeader('app');
    try { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); } catch (e) { window.scrollTo(0, 0); }
  }

  /**
   * 同步共用顶栏在不同场景下的可见性
   * 使用 `<body data-scene="home|auth|app">` 作为唯一真相源，CSS 决定显隐
   *  - 'home'：完整顶栏（logo + 锚点导航 + 语言 + 开始使用）
   *  - 'auth'：完全隐藏顶栏（auth 页自带 "返回首页" 链接）
   *  - 'app'：完全隐藏（主应用使用内部 header）
   */
  _syncSiteHeader(scene) {
    document.body.setAttribute('data-scene', scene || 'home');
  }

  // 兼容旧调用名（部分旧代码可能仍引用 showAuthPage / hideAuthPage）
  showAuthPage() { this.goToAuth(); }
  hideAuthPage() { /* no-op: 主应用通过 showMainApp() 切换；保留以兼容旧代码 */ }

  /**
   * 同步语言切换器按钮 UI（单按钮：根据当前语言显示"中" / "EN"）
   * 同时更新首页 (#site-lang-label) 和主应用 (#app-lang-label) 两个按钮
   */
  _updateLangToggle() {
    if (!window.i18n) return;
    const current = window.i18n.getLanguage();
    const text = current === 'zh-CN' ? '中' : 'EN';
    const siteLabel = document.getElementById('site-lang-label');
    const appLabel = document.getElementById('app-lang-label');
    if (siteLabel) siteLabel.textContent = text;
    if (appLabel) appLabel.textContent = text;
  }

  /**
   * 切语言后重新渲染主应用（按需：仅在主应用已挂载时）
   *  - 重新调用 applyI18n 扫描 data-i18n 节点
   *  - 重渲染当前视图、时间标题、视图切换高亮、云状态图标、用户菜单
   */
  _refreshAppOnLangChange() {
    if (!window.i18n || !window.i18n.applyI18n) return;
    window.i18n.applyI18n();
    this._updateLangToggle();
    // 仅在主应用场景下重渲染数据视图
    const scene = document.body.getAttribute('data-scene');
    if (scene === 'app') {
      try { this.renderDate(); } catch (e) { /* noop */ }
      try { this.renderView(); } catch (e) { /* noop */ }
      try { this.renderFilterChips(); } catch (e) { /* noop */ }
      try { this.updateCloudStatusIcon(); } catch (e) { /* noop */ }
      try { this.renderDiagnosticBar(); } catch (e) { /* noop */ }
      try { this.renderUserMenu(); } catch (e) { /* noop */ }
      // 关键：applyI18n() 会把 <span id="timeline-select-label"> 上的 data-i18n 重新应用
      // 一次，导致 label 被覆盖成「未选择/Unselected」。这里再调一次 updateTimelineSelector()
      // 把它写回当前时间轴的（已翻译过的）名字。
      try { this.updateTimelineSelector(); } catch (e) { /* noop */ }
      // 同步：record-image-name 也要按当前语言重渲（file.name 不动，没图时回退到「未选择」/「No file chosen」）
      try { this._updateRecordImageName(); } catch (e) { /* noop */ }
    }
  }

  /**
   * 关闭冷启动遮罩（#app-loading）
   * 流程：先 200ms 淡出再 display:none，避免视觉跳变
   * 必须在 showAuthPage（未登录）和 onLoginSuccess 完成后（已登录）各调一次
   */
  _hideAppLoading() {
    const el = document.getElementById('app-loading');
    if (!el || el.classList.contains('is-hiding') || el.style.display === 'none') return;
    el.classList.add('is-hiding');
    setTimeout(() => { el.style.display = 'none'; }, 220);
  }

  // ============================================================
  // 登录成功/失败
  // ============================================================
  /**
   * 登录成功入口
   * @param {object} [opts]
   * @param {boolean} [opts.directToApp=false]  为 true 时跳过"首页 + toast"过渡，
   *        直接进入主应用（用于冷启动时已登录场景，保持原行为）
   */
  async onLoginSuccess(opts = {}) {
    const directToApp = !!opts.directToApp;

    // 保留 #user-info 上的 `hidden lg:flex` 类。`lg:flex` 会在 ≥lg 视口下自动覆盖 `hidden`，
    // 因此在 mobile (<lg) 上始终隐藏，在 desktop (≥lg) 上正常显示，无需 JS 干预。
    this.updateUserMenu();
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.textContent = this.getDisplayName(authManager.getCurrentUser()).charAt(0).toUpperCase();

    // 重置状态
    this._clearCloudError();

    // 第一步：拉取所有 timeline 列表
    const loadResult = await this.loadTimelines();

    if (!loadResult.success) {
      // 拉取失败 → 显示错误条 + 隐藏 add 按钮
      this.cloudSyncStatus = 'error';
      this.cloudErrorMessage = loadResult.error || this._i18n('app.cloud.unreachable', '无法连接到云端');
      this.updateCloudStatusIcon();
      this._setCloudError(this.cloudErrorMessage);
      this._setAddEnabled(false);
    } else {
      this.cloudSyncStatus = 'ok';
      this.cloudErrorMessage = '';
      this.updateCloudStatusIcon();
      this._setAddEnabled(true);

      // 第二步：等云同步完成后才渲染（避免首次空数据闪烁）
      try {
        await this.syncFromCloud();
      } catch (e) {
        this._setCloudError(this._i18n('app.cloud.syncFail', '同步云端记录失败: ') + (e.message || e));
        // sync 失败不影响渲染本地已有数据
      }
    }

    this.renderDate();
    await this.renderView();

    // 冷启动遮罩：进入首页或主应用后即可关闭
    this._hideAppLoading();

    if (directToApp) {
      // 冷启动且已登录：直接进入主应用（保留既有用户习惯）
      this.showMainApp();
      // 老用户补全资料弹窗
      this.checkProfileCompletion();
      return;
    }

    // 修复：主动登录 / 注册后直接进入主应用，不再闪回到宣传首页 3 秒
    // - 避免 "登录成功 → 整页宣传页 hero/features 重新渲染" 给用户造成「页面 reload」的错觉
    // - 保留一个简短的成功 toast 作为反馈
    this.showMainApp();
    const message = (window.i18n && window.i18n.t) ? window.i18n.t('home.toast.loginSuccess', '登录成功') : '登录成功';
    this.showToast(message, { duration: 2000, type: 'success' });
    // 老用户补全资料弹窗
    this.checkProfileCompletion();
  }

  // ============================================================
  // 云端错误条（顶部红条 + 重试按钮）
  // ============================================================
  _setCloudError(msg) {
    const bar = document.getElementById('cloud-error-bar');
    const msgEl = document.getElementById('cloud-error-message');
    if (!bar) return;
    if (msgEl) msgEl.textContent = msg || this._i18n('app.modal.unknownError', '未知错误');
    bar.classList.remove('hidden');
    // lucide 图标在 bar 内，确保渲染
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  _clearCloudError() {
    const bar = document.getElementById('cloud-error-bar');
    if (bar) bar.classList.add('hidden');
  }

  _showCloudError(msg) {
    console.error('[VEX-Timeline] Cloud error:', msg);
  }

  _setAddEnabled(enabled) {
    // 添加按钮已统一为浮动 FAB（#mobile-fab）
    const fab = document.getElementById('mobile-fab');
    if (fab) {
      fab.style.display = enabled ? 'flex' : 'none';
      fab.disabled = !enabled;
      fab.title = enabled ? this._i18n('app.fab.add', '添加记录') : this._i18n('app.fab.cantAdd', '云端连接失败，无法添加记录');
    }
  }

  /**
   * 根据当前赛队角色刷新"添加记录"按钮的可见性
   * - visitor → 隐藏 FAB 与 mobile-add-btn
   * - 其余 → 显示
   * 在 renderView 顶部调用，确保切完 timeline 后立即生效
   */
  _refreshAddButtonByRole() {
    const canAdd = this.canAddRecord();
    const fab = document.getElementById('mobile-fab');
    if (fab) {
      // 仅当 _currentTimelineRole 已被设置时（赛队时间轴）才按权限控制；
      // 个人时间轴或非赛队情形下保持原有 _setAddEnabled 的控制
      if (this._currentTimelineRole) {
        fab.style.display = canAdd ? 'flex' : 'none';
        fab.disabled = !canAdd;
        fab.title = canAdd
          ? this._i18n('app.fab.add', '添加记录')
          : this._i18n('app.fab.readOnly', '访客权限，仅可查看');
      }
    }
    const mobileAdd = document.getElementById('mobile-add-btn');
    if (mobileAdd && this._currentTimelineRole) {
      mobileAdd.classList.toggle('hidden', !canAdd);
    }
  }

  onGuestMode() {
    // Round 4：离线模式已取消；保留此方法为 no-op 避免旧代码引用错误
    console.warn('[VEX-Timeline] onGuestMode 已废弃：所有功能必须先登录');
  }

  // ============================================================
  // 时间轴加载 & 自定义下拉
  // ============================================================
  async loadTimelines() {
    if (!authManager.isLoggedIn() || !supabaseManager.isConfigured()) {
      this.updateTimelineSelector();
      return { success: false, error: this._i18n('app.cloud.notConfigured', 'Supabase 未配置') };
    }

    let lastErr = null;
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.timelines = await cloudDBManager.getTimelinesForUser();
        lastErr = null;
        break;
      } catch (e) {
        console.warn(`[VEX-Timeline] loadTimelines attempt ${attempt} failed:`, e);
        lastErr = e;
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (lastErr) {
      this.timelines = [];
      this.updateTimelineSelector();
      // 防御性：拉取失败时也刷新一次管理赛队按钮可见性（此时是个人时间轴也不会显示）
      this.updateManageButton();
      return { success: false, error: lastErr.message || String(lastErr) };
    }

    if (this.timelines.length > 0 && (!this.currentTimelineId || !this.timelines.find(t => t.id === this.currentTimelineId))) {
      const personal = this.timelines.find(t => t.type === 'personal');
      this.currentTimelineId = personal ? personal.id : this.timelines[0].id;
      this._saveStoredTimelineId(this.currentTimelineId);
    }

    this.updateTimelineSelector();
    // 关键：loadTimelines 后 currentTimelineId 可能刚被改成 personal timeline（个人时间轴），
    // 但 updateManageButton 只在切时间轴事件 / updateUserMenu 路径里被调用。
    // 这里补一次，确保 manage-team-btn / mobile-manage-team-btn 状态正确。
    this.updateManageButton();
    return { success: true };
  }

  /**
   * 重新填充时间轴下拉菜单
   */
  updateTimelineSelector() {
    const menu = document.getElementById('timeline-menu');
    const mobileList = document.getElementById('mobile-timeline-list');
    if (!menu) return;

    // Round 4：取消本地时间轴概念，只渲染云端时间轴
    // label 走 _findTimelineName()：默认名（个人/赛队时间轴）会按当前语言翻译；
    // 用户自定义名原样保留。顶部选中态 label 也是同一个函数，两边永远一致。
    const items = this.timelines.map(t => ({ id: t.id, label: this._findTimelineName(t.id), type: t.type }));

    // 桌面菜单渲染
    menu.innerHTML = items.map(item => `
      <button type="button" class="vx-timeline-menu-item${item.id === this.currentTimelineId ? ' active' : ''}" data-timeline-value="${item.id}">
        <i data-lucide="${item.type === 'team' ? 'users' : 'user'}" class="w-4 h-4 text-fg/60"></i>
        <span>${this._escapeHtml(item.label)}</span>
      </button>
    `).join('');

    // 移动端列表
    if (mobileList) {
      mobileList.innerHTML = items.map(item => `
        <button type="button" class="vx-timeline-menu-item${item.id === this.currentTimelineId ? ' active' : ''}" data-timeline-value="${item.id}">
          <i data-lucide="${item.type === 'team' ? 'users' : 'user'}" class="w-4 h-4 text-fg/60"></i>
          <span>${this._escapeHtml(item.label)}</span>
        </button>
      `).join('');
    }

    // 重新渲染 lucide 图标
    if (window.lucide && lucide.createIcons) lucide.createIcons();

    // 绑定选择事件
    document.querySelectorAll('[data-timeline-value]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.timelineValue;
        if (id === this.currentTimelineId) {
          // 同一时间轴：不重新拉取，关闭菜单
          this.closeAllMenus();
          return;
        }
        this.currentTimelineId = id;
        this._saveStoredTimelineId(this.currentTimelineId);
        this.updateTimelineSelector();
        this.updateTimelineLabel(this._findTimelineName(id));
        this.updateManageButton();
        // 切换时间轴 → 重新拉取赛队角色（决定权限）
        this._loadCurrentTimelineRole().catch(e => console.warn('load role', e));
        this.closeAllMenus();
        await this.renderView();         // 先用本地缓存快速渲染
        this.syncFromCloud();             // Round 5：后台拉取云端最新数据
      });
    });

    this.updateTimelineLabel(this._findTimelineName(this.currentTimelineId));
    this.updateManageButton();
    // 启动时拉取当前时间轴的角色
    this._loadCurrentTimelineRole().catch(e => console.warn('load role', e));

    const isLoggedIn = authManager.isLoggedIn();
    const desktop = document.getElementById('timeline-selector');
    if (desktop) desktop.classList.toggle('hidden', !isLoggedIn);
  }

  /**
   * 已知时间轴「默认名」 →  对应的 i18n key
   * - 旧账号里早就存了「个人时间轴」「赛队时间轴」等中文名
   * - 切换到英文模式时，这些名字应该自动翻译成 "Personal timeline" / "Team timeline"
   * - 用户自定义名（非默认）原样保留，不做翻译
   */
  static DEFAULT_TIMELINE_NAME_KEYS = {
    // zh-CN 默认
    '个人时间轴': 'app.term.personalTimeline',
    '赛队时间轴': 'app.term.teamTimeline',
    // en 默认
    'Personal timeline': 'app.term.personalTimeline',
    'Personal Timeline': 'app.term.personalTimeline',
    'Team timeline': 'app.term.teamTimeline',
    'Team Timeline': 'app.term.teamTimeline'
  };

  _findTimelineName(id) {
    if (!id) return this._i18n('app.timeline.unselected', '未选择');
    const t = this.timelines.find(x => x.id === id);
    if (!t) return this._i18n('app.timeline.unselected', '未选择');
    // 默认名 → 走 i18n 翻译
    const i18nKey = App.DEFAULT_TIMELINE_NAME_KEYS[t.name];
    if (i18nKey) return this._i18n(i18nKey, t.name);
    // 用户自定义名：原样展示
    return t.name;
  }

  updateTimelineLabel(name) {
    const label = document.getElementById('timeline-select-label');
    if (label) label.textContent = name;
  }

  /**
   * 短显示名：仅昵称（用于头像、顶栏 user-name）
   * 优先级：nickname > username
   * @param {object|null} u  users 行（或 { username, nickname, real_name, name_only_surname, identity }）
   */
  getDisplayName(u) {
    if (!u) return 'User';
    return u.nickname || u.username || 'User';
  }

  /**
   * 长显示名：昵称（真实姓名），用于成员列表 / 下拉菜单头部
   * - 老师仅填姓时：昵称（X 老师）
   * - 家长：填的是孩子的全名 → 昵称（孩子名家长），自动追加"家长"后缀
   * - 其他情形：昵称（真实姓名）
   * - 真实姓名为空时：退化为只显示昵称
   */
  getFullDisplayName(u) {
    if (!u) return 'User';
    const nick = u.nickname || u.username || 'User';
    if (!u.real_name) return nick;
    if (u.identity === 'parent') {
      // 家长：用户填的是孩子的名字，系统统一加"家长"后缀
      return `${nick}（${u.real_name}家长）`;
    }
    if (u.name_only_surname && u.identity === 'teacher') {
      return `${nick}（${u.real_name}老师）`;
    }
    return `${nick}（${u.real_name}）`;
  }

  /**
   * 用户菜单 / 顶栏信息刷新
   * 顺便刷新"管理赛队"按钮可见性（个人时间轴下绝对不显示）
   */
  updateUserMenu() {
    const u = authManager.getCurrentUser();
    // 顶栏短名（仅昵称）
    const shortName = this.getDisplayName(u);
    // 下拉里长名（昵称 + 真实姓名）
    const fullName = this.getFullDisplayName(u);
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = shortName;
    const userMenuNameEl = document.getElementById('user-menu-name');
    if (userMenuNameEl) userMenuNameEl.textContent = fullName;
    // 防御性：每次刷新菜单时同步管理赛队按钮可见性
    this.updateManageButton();
  }

  updateManageButton() {
    // 管理赛队按钮的可见性：
    // - 个人时间轴：所有设备端均不显示
    // - 赛队时间轴：所有用户均显示（点开后弹窗内容按角色动态渲染）
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    const isTeam = !!(current && current.type === 'team');
    const desktopBtn = document.getElementById('manage-team-btn');
    const mobileBtn = document.getElementById('mobile-manage-team-btn');
    [desktopBtn, mobileBtn].forEach(btn => {
      if (btn) btn.classList.toggle('hidden', !isTeam);
    });
  }

  // ============================================================
  // 二级权限：基于赛队角色的权限判定
  // ============================================================
  /**
   * 当前用户在本赛队中的角色
   * @returns {Promise<string|null>}
   */
  async _loadCurrentTimelineRole() {
    if (!this.currentTimelineId) {
      this._currentTimelineRole = null;
      return null;
    }
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    if (!current || current.type !== 'team') {
      this._currentTimelineRole = null;
      return null;
    }
    const role = await cloudDBManager.getMemberRole(this.currentTimelineId);
    this._currentTimelineRole = role;
    return role;
  }

  /** 添加记录：owner/captain/teacher/member 可见，visitor 不可见 */
  canAddRecord() {
    const r = this._currentTimelineRole;
    if (!r) return true; // 个人时间轴或非赛队 → 视为可加
    return r !== 'visitor';
  }
  /** 编辑记录：owner/captain/teacher/member 均可（visitor 不可；个人时间轴可） */
  canEditRecord(record) {
    const r = this._currentTimelineRole;
    if (!r) return true; // 个人时间轴
    if (r === 'visitor') return false;
    return true; // owner / captain / teacher / member
  }
  /** 删除记录：同 canEditRecord */
  canDeleteRecord(record) {
    return this.canEditRecord(record);
  }
  /** 管理成员（调整角色 / 移除）：owner/captain/teacher */
  canManageMembers() {
    const r = this._currentTimelineRole;
    return r === 'owner' || r === 'captain' || r === 'teacher';
  }
  /** 重置邀请码：owner/captain/teacher */
  canResetInvite() {
    return this.canManageMembers();
  }
  /** 查看邀请码：owner/captain/teacher/member（visitor 不可见） */
  canViewInvite() {
    const r = this._currentTimelineRole;
    if (!r) return false;
    return r !== 'visitor';
  }
  /** 删除整个赛队：仅 owner */
  canDeleteTimeline() {
    return this._currentTimelineRole === 'owner';
  }

  // ============================================================
  // 云端状态指示器
  // ============================================================
  updateCloudStatusIcon() {
    const el = document.getElementById('cloud-status');
    if (!el) return;
    let iconName = 'cloud', label = this._i18n('app.cloud.unknown', '未知'), cls = '';

    if (!supabaseManager.isConfigured()) {
      iconName = 'alert-triangle'; label = this._i18n('app.cloud.notConfigured', 'Supabase 未配置'); cls = 'is-error';
    } else if (this.cloudSyncStatus === 'error') {
      iconName = 'alert-triangle'; label = this._i18n('app.cloud.error', '云端错误: ') + (this.cloudErrorMessage || this._i18n('app.cloud.unknown', '未知')); cls = 'is-error';
    } else if (!this.isOnline) {
      iconName = 'cloud-off'; label = this._i18n('app.cloud.offline', '离线'); cls = 'is-offline';
    } else if (this.syncInProgress) {
      iconName = 'refresh-cw'; label = this._i18n('app.cloud.syncing', '同步中'); cls = 'is-syncing';
    } else {
      iconName = 'cloud'; label = this._i18n('app.cloud.connected', '云端已连接'); cls = 'is-ok';
    }

    el.className = 'vx-cloud-status' + (cls ? ' ' + cls : '');
    el.title = label;
    const iconWrap = el.querySelector('.vx-cloud-icon');
    if (iconWrap) {
      iconWrap.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    }
  }

  // ============================================================
  // 诊断条（已下线：保留为 no-op 以兼容历史调用）
  // ============================================================
  renderDiagnosticBar() {
    // DOM 中已删除 #diagnostic-bar 与调试字段；此方法保留为 no-op，
    // 以避免在 handleLogin/handleRegister/handleLogout 中调用时抛 null 引用。
    const el = document.getElementById('diagnostic-bar');
    if (!el) return;

    // 下面是仅在调试 DOM 存在时才会执行的旧逻辑（理论上不会触发）
    const status = supabaseManager.getConfigStatus();
    const isLoggedIn = authManager.isLoggedIn();
    const username = authManager.getUsername() || this._i18n('app.user.unlogged', '未登录');
    const sessionOk = !!authManager.session;
    const cloudOk = status.isValid;

    const urlEl = document.getElementById('diag-url');
    const keyEl = document.getElementById('diag-key');
    const sessEl = document.getElementById('diag-session');
    const userEl = document.getElementById('diag-user');
    const tlEl = document.getElementById('diag-timeline');

    if (urlEl) {
      urlEl.innerHTML = status.hasUrl
        ? `URL: <span class="text-secondary font-bold">✓</span> <code>${this._escapeHtml(status.urlPrefix || '已设置')}</code>`
        : `URL: <span class="text-primary font-bold">✗ 未配置</span>`;
    }
    if (keyEl) {
      keyEl.innerHTML = status.hasKey
        ? `Key: <span class="text-secondary font-bold">✓</span> 已设置`
        : `Key: <span class="text-primary font-bold">✗ 未配置</span>`;
    }
    if (sessEl) {
      sessEl.innerHTML = isLoggedIn
        ? `Session: <span class="text-secondary font-bold">✓ 已登录</span> (${this._escapeHtml(username)})`
        : `Session: <span class="text-accent font-bold">⊘ 未登录</span>`;
    }
    if (userEl) {
      userEl.innerHTML = sessionOk ? `Token: <span class="text-secondary font-bold">✓</span>` : `Token: <span class="text-primary font-bold">✗</span>`;
    }
    if (tlEl) {
      const tlName = this._findTimelineName(this.currentTimelineId);
      tlEl.innerHTML = `时间轴: <code>${this._escapeHtml(tlName)}</code>`;
    }

    // 用户友好的提示（不再使用红色 banner）
    const banner = document.getElementById('diag-banner');
    if (banner) {
      if (!cloudOk) {
        banner.classList.remove('hidden');
        banner.textContent = this._i18n('app.cloud.broken', '云端服务暂不可用，请稍后再试或联系管理员。');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  // ============================================================
  // 同步
  // ============================================================
  async syncFromCloud() {
    if (!authManager.isLoggedIn() || !supabaseManager.isConfigured() || !this.currentTimelineId) return;
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    this.updateCloudStatusIcon();

    try {
      const cloudRecords = await cloudDBManager.pullAllData(this.currentTimelineId);
      await dbManager.replaceRecordsForTimeline(this.currentTimelineId, cloudRecords.map(r => ({
        ...r,
        timeline_id: r.timeline_id,
        cloud_id: r.id
      })));
      await this.processSyncQueue();
      // 同步重载当前赛队角色：让"管理赛队"按钮 / 编辑 / 删除 / 添加按钮
      // 在切换权限后能立即按新角色显示
      await this._loadCurrentTimelineRole();
      this.updateManageButton();
      await this.renderView();
      this.cloudSyncStatus = 'ok';
    } catch (e) {
      this.cloudSyncStatus = 'error';
      this.cloudErrorMessage = e.message || String(e);
      console.warn('[VEX-Timeline] syncFromCloud failed:', e);
    }

    this.syncInProgress = false;
    this.updateCloudStatusIcon();
  }

  async processSyncQueue() {
    if (!this.isOnline || !authManager.isLoggedIn()) return;
    const queue = await dbManager.getSyncQueue();
    let succeeded = 0, failed = 0;
    for (const item of queue) {
      try {
        await this.executeSyncOperation(item);
        await dbManager.removeFromSyncQueue(item.id);
        succeeded++;
      } catch (e) {
        // 失败项不删除、也不 break；保留在队列等待下次重试（自愈）
        failed++;
        console.warn(`[VEX-Timeline] Sync queue item ${item.id} (${item.operation}) failed, will retry:`, e.message || e);
      }
    }
    if (succeeded > 0 || failed > 0) {
      console.log(`[VEX-Timeline] Sync queue: ${succeeded} succeeded, ${failed} failed (kept in queue)`);
    }
  }

  async executeSyncOperation(item) {
    if (!supabaseManager.isConfigured()) return;
    switch (item.operation) {
      case 'add':    await cloudDBManager.addRecord(item.data.timeline_id, item.data); break;
      case 'update':
        if (item.data.cloud_id) await cloudDBManager.updateRecord(item.data.cloud_id, item.data);
        break;
      case 'delete':
        if (item.data.cloud_id) await cloudDBManager.deleteRecord(item.data.cloud_id);
        break;
    }
  }

  setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateCloudStatusIcon();
      if (authManager.isLoggedIn()) this.processSyncQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateCloudStatusIcon();
    });
  }

  // ============================================================
  // 事件绑定
  // ============================================================
  bindEvents() {
    // 视图切换
    document.querySelectorAll('[data-view-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.viewToggle;
        this.currentView = view;
        this.syncViewToggleState();
        this.renderDate();
        this.renderView();
      });
    });

    // 浮动添加按钮（FAB，所有屏幕尺寸统一入口）
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) mobileFab.addEventListener('click', () => this.openModal());

    // ============ 首页 / 登录页 / 顶栏 事件 ============
    // 首页 → 登录页
    const goToAuthHandler = (e) => { if (e) e.preventDefault(); this.goToAuth(); };
    const ctaStart = document.getElementById('site-cta-start');
    if (ctaStart) ctaStart.addEventListener('click', goToAuthHandler);
    const heroCtaPrimary = document.getElementById('home-hero-cta-primary');
    if (heroCtaPrimary) heroCtaPrimary.addEventListener('click', goToAuthHandler);
    const ctaButton = document.getElementById('home-cta-button');
    if (ctaButton) ctaButton.addEventListener('click', goToAuthHandler);

    // 登录页 → 首页
    const backHome = document.getElementById('site-back-home');
    if (backHome) backHome.addEventListener('click', (e) => { e.preventDefault(); this.showHomePage(); });

    // 登录页 → 首页（auth-back-home：在 auth 页表单内）
    const authBackHome = document.getElementById('auth-back-home');
    if (authBackHome) authBackHome.addEventListener('click', (e) => { e.preventDefault(); this.showHomePage(); });

    // Logo（首页 / 登录页）→ 滚到 Hero 顶部（首页有效）
    const headerLogo = document.getElementById('site-header-logo');
    if (headerLogo) {
      headerLogo.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHomePage();
        try { document.getElementById('home-hero').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { /* ignore */ }
      });
    }

    // 语言切换：单按钮（首页 + 主应用共用）
    // 防抽动：切语前先给按钮加 is-loading 类，rAF 后再 setLanguage
    //        （配合 CSS 的 html { scrollbar-gutter: stable } 彻底解决横移）
    const toggleLang = () => {
      if (!window.i18n) return;
      const current = window.i18n.getLanguage();
      const next = current === 'zh-CN' ? 'en' : 'zh-CN';
      const btn = document.activeElement;
      const isLangBtn = btn && (btn.id === 'site-lang-toggle' || btn.id === 'app-lang-toggle');
      if (isLangBtn) {
        btn.classList.add('is-loading');
        btn.disabled = true;
      }
      // 推迟到下一帧让样式先生效，避免与抽动竞争
      requestAnimationFrame(() => {
        window.i18n.setLanguage(next);
        this._updateLangToggle();
        this._refreshAppOnLangChange();
        if (isLangBtn) {
          setTimeout(() => {
            btn.classList.remove('is-loading');
            btn.disabled = false;
          }, 120);
        }
      });
    };
    const langBtn = document.getElementById('site-lang-toggle');
    if (langBtn) langBtn.addEventListener('click', toggleLang);
    const appLangBtn = document.getElementById('app-lang-toggle');
    if (appLangBtn) appLangBtn.addEventListener('click', toggleLang);
    this._updateLangToggle();

    // 记录模态框
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('save-btn').addEventListener('click', () => this.saveRecord());
    document.getElementById('record-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecord();
    });
    document.getElementById('record-modal').addEventListener('click', (e) => {
      if (e.target.id === 'record-modal') this.closeModal();
    });

    // 重要性按钮（模态框内）
    document.querySelectorAll('#importance-selector [data-importance]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.currentTarget.dataset.importance;
        this.setImportance(val);
      });
    });

    document.getElementById('record-image').addEventListener('change', (e) => this.handleImageUpload(e));
    document.getElementById('remove-image-btn').addEventListener('click', () => this.removeImage());

    // 自定义「选择文件」按钮 → 触发隐藏的原生 <input type="file">
    const imgTrigger = document.getElementById('record-image-trigger');
    if (imgTrigger) {
      imgTrigger.addEventListener('click', () => {
        document.getElementById('record-image').click();
      });
    }

    // 过滤器
    document.querySelectorAll('#filter-bar [data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentFilter = e.currentTarget.dataset.filter;
        this.syncFilterState();
        this.renderTimeline();
      });
    });

    // 日历导航
    document.getElementById('prev-month').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderDate();
      this.renderView();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderDate();
      this.renderView();
    });

    // 日内记录浮层
    document.getElementById('close-day-records').addEventListener('click', () => this.closeDayRecords());
    document.getElementById('day-records-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'day-records-overlay') this.closeDayRecords();
    });

    // 登录/注册 — 分离的登录视图与注册视图
    document.getElementById('auth-login-btn').addEventListener('click', () => this.handleLogin());
    document.getElementById('auth-register-btn').addEventListener('click', () => this.handleRegister());

    // Enter 提交
    ['auth-username-login', 'auth-password-login'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });
    });
    ['auth-username-register', 'auth-password-register', 'auth-nickname', 'auth-real-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleRegister(); });
    });

    // 视图切换：登录 ↔ 注册
    const goRegister = document.getElementById('auth-go-register-btn');
    if (goRegister) goRegister.addEventListener('click', () => this.switchAuthView('register'));
    const goLogin = document.getElementById('auth-go-login-btn');
    if (goLogin) goLogin.addEventListener('click', () => this.switchAuthView('login'));

    // 一级权限：身份单选按钮（学生 / 老师）
    this._bindIdentityPicker('auth');

    // 老用户补全资料弹窗事件
    const profileSubmit = document.getElementById('profile-completion-submit');
    if (profileSubmit) profileSubmit.addEventListener('click', () => this.handleProfileCompletionSubmit());
    const profileSkip = document.getElementById('profile-completion-skip');
    if (profileSkip) profileSkip.addEventListener('click', () => this.handleProfileCompletionSkip());
    this._bindIdentityPicker('profile');
    const profileRealName = document.getElementById('profile-real-name');
    if (profileRealName) profileRealName.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleProfileCompletionSubmit(); });
    const profileNickname = document.getElementById('profile-nickname');
    if (profileNickname) profileNickname.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleProfileCompletionSubmit(); });

    // "稍后" 劝导弹窗：OK 按钮 → 关闭弹窗 + 焦点回到主弹窗的第一个未填字段
    const nudgeOk = document.getElementById('profile-nudge-ok');
    if (nudgeOk) {
      nudgeOk.addEventListener('click', () => {
        this.closeProfileNudgeModal();
        // 焦点回到主弹窗第一个未填且仍可见的字段
        setTimeout(() => {
          const candidates = ['profile-nickname', 'profile-real-name', 'profile-identity-student', 'profile-identity-teacher'];
          for (const id of candidates) {
            const el = document.getElementById(id);
            if (!el) continue;
            const section = el.closest('div.flex.flex-col');
            if (section && !section.classList.contains('hidden')) {
              el.focus();
              break;
            }
          }
        }, 100);
      });
    }

    // 登出（桌面 + 移动）
    document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
    const mobileLogout = document.getElementById('mobile-logout-btn');
    if (mobileLogout) mobileLogout.addEventListener('click', () => this.handleLogout());

    // 时间轴下拉（自定义）
    const tlBtn = document.getElementById('timeline-select-btn');
    if (tlBtn) {
      tlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('timeline-menu', 'user-menu');
      });
    }

    // Round 5：云状态指示器 → 刷新按钮
    const cloudStatusBtn = document.getElementById('cloud-status');
    if (cloudStatusBtn) {
      cloudStatusBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!authManager.isLoggedIn() || !this.currentTimelineId) {
          this.showToast(this._i18n('app.toast.loginFirst', '请先登录并选择时间轴'), 'warning');
          return;
        }
        if (this.syncInProgress) {
          this.showToast(this._i18n('app.toast.syncing', '正在同步中，请稍候'), 'info');
          return;
        }
        this.showToast(this._i18n('app.cloud.refreshing', '正在从云端刷新…'), 'info');
        try {
          await this.syncFromCloud();
          this.showToast(this._i18n('app.cloud.refreshed', '云端数据已同步'), 'success');
        } catch (err) {
          this.showToast(this._i18n('app.cloud.refreshFailed', '刷新失败: ') + (err.message || err), 'error');
        }
      });
    }

    // 用户菜单
    const userMenuBtn = document.getElementById('user-menu-btn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu('user-menu', 'timeline-menu');
      });
    }

    // 赛队操作（事件委托到 document，包括移动端和桌面端的下拉项）
    document.addEventListener('click', (e) => {
      const teamBtn = e.target.closest('[data-team-action]');
      if (teamBtn) {
        const action = teamBtn.dataset.teamAction;
        this.handleTeamAction(action);
        this.closeAllMenus();
        this.closeMobileDrawer();
        return;
      }
      // 用户操作（个人设置等"非赛队"的账号操作）
      const userBtn = e.target.closest('[data-user-action]');
      if (userBtn) {
        const action = userBtn.dataset.userAction;
        if (action === 'settings') this.openSettingsModal();
        this.closeAllMenus();
        this.closeMobileDrawer();
      }
    });

    // 移动端汉堡菜单
    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) mobileBtn.addEventListener('click', () => this.openMobileDrawer());
    const mobileClose = document.getElementById('mobile-drawer-close');
    if (mobileClose) mobileClose.addEventListener('click', () => this.closeMobileDrawer());

    // 移动端快捷操作：添加记录 / 刷新云端
    const mobileAdd = document.getElementById('mobile-add-btn');
    if (mobileAdd) {
      mobileAdd.addEventListener('click', () => {
        this.closeMobileDrawer();
        this.openModal();
      });
    }
    const mobileCloudRefresh = document.getElementById('mobile-cloud-refresh-btn');
    if (mobileCloudRefresh) {
      mobileCloudRefresh.addEventListener('click', async () => {
        this.closeMobileDrawer();
        if (!authManager.isLoggedIn() || !this.currentTimelineId) {
          this.showToast(this._i18n('app.toast.loginFirst', '请先登录并选择时间轴'), 'warning');
          return;
        }
        if (this.syncInProgress) {
          this.showToast(this._i18n('app.toast.syncing', '正在同步中，请稍候'), 'info');
          return;
        }
        this.showToast(this._i18n('app.cloud.refreshing', '正在从云端刷新…'), 'info');
        try {
          await this.syncFromCloud();
          this.showToast(this._i18n('app.cloud.refreshed', '云端数据已同步'), 'success');
        } catch (err) {
          this.showToast(this._i18n('app.cloud.refreshFailed', '刷新失败: ') + (err.message || err), 'error');
        }
      });
    }

    // 点击外部关闭所有菜单
    document.addEventListener('click', (e) => {
      const inMenu = e.target.closest('#timeline-menu, #timeline-select-btn, #user-menu, #user-menu-btn, #mobile-drawer, #mobile-menu-btn');
      if (!inMenu) this.closeAllMenus();
    });

    // 移动端"关闭"按钮：关闭抽屉
    const mobileMenuClose = document.getElementById('mobile-menu-close-btn');
    if (mobileMenuClose) {
      mobileMenuClose.addEventListener('click', () => this.closeMobileDrawer());
    }

    // 赛队模态框
    document.getElementById('cancel-team-btn').addEventListener('click', () => this.closeModalById('create-team-modal'));
    document.getElementById('save-team-btn').addEventListener('click', () => this.handleCreateTeam());
    document.getElementById('create-team-modal').addEventListener('click', (e) => {
      if (e.target.id === 'create-team-modal') this.closeModalById('create-team-modal');
    });

    document.getElementById('cancel-join-btn').addEventListener('click', () => this.closeModalById('join-team-modal'));
    document.getElementById('confirm-join-btn').addEventListener('click', () => this.handleJoinTeam());
    document.getElementById('join-team-modal').addEventListener('click', (e) => {
      if (e.target.id === 'join-team-modal') this.closeModalById('join-team-modal');
    });

    document.getElementById('close-invite-btn').addEventListener('click', () => this.closeModalById('invite-modal'));
    document.getElementById('invite-modal').addEventListener('click', (e) => {
      if (e.target.id === 'invite-modal') this.closeModalById('invite-modal');
    });

    document.getElementById('copy-invite-btn').addEventListener('click', () => this.copyInviteCode());

    // 重置邀请码
    const regenBtn = document.getElementById('regenerate-invite-btn');
    if (regenBtn) {
      regenBtn.addEventListener('click', async () => {
        if (!this.currentTimelineId) return;
        if (!this.canResetInvite()) {
          this.showToast(this._i18n('app.team.regenerateInvite', '重置邀请码'), 'warning');
          return;
        }
        if (!confirm(this._i18n('app.team.regenerateInviteConfirm', '重置邀请码后旧码将立即失效，确定吗？'))) return;
        try {
          const newCode = await cloudDBManager.regenerateInviteCode(this.currentTimelineId);
          document.getElementById('invite-code-display').textContent = newCode;
          this.showToast(this._i18n('app.team.inviteRegenerated', '邀请码已重置'), 'success');
        } catch (e) {
          this.showToast(this._i18n('app.team.roleUpdateFail', '更新失败：') + (e.message || e), 'error');
        }
      });
    }

    // 删除赛队（仅 owner 可见）
    const deleteTeamBtn = document.getElementById('delete-team-btn');
    if (deleteTeamBtn) {
      deleteTeamBtn.addEventListener('click', async () => {
        if (!this.currentTimelineId) return;
        if (!this.canDeleteTimeline()) return;
        if (!confirm(this._i18n('app.team.confirmDeleteTeam', '确定要删除这个赛队时间轴吗？此操作不可撤销。'))) return;
        try {
          await cloudDBManager.deleteTimeline(this.currentTimelineId);
          this.showToast(this._i18n('app.team.teamDeleted', '赛队已删除'), 'success');
          this.closeModalById('invite-modal');
          // 从本地列表移除
          this.timelines = this.timelines.filter(t => t.id !== this.currentTimelineId);
          this.currentTimelineId = this.timelines[0]?.id || null;
          this._saveStoredTimelineId(this.currentTimelineId);
          this.updateTimelineSelector();
          this.updateTimelineLabel(this._findTimelineName(this.currentTimelineId));
          this.updateManageButton();
          this._loadCurrentTimelineRole().catch(() => {});
          await this.renderView();
        } catch (e) {
          this.showToast(this._i18n('app.team.teamDeleteFail', '删除赛队失败：') + (e.message || e), 'error');
        }
      });
    }

    // 云端重试按钮
    const retryBtn = document.getElementById('cloud-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        this._clearCloudError();
        this._setCloudError(this._i18n('app.toast.retrying', '正在重试…'));
        try {
          await this.onLoginSuccess();
        } catch (e) {
          this._setCloudError(this._i18n('app.cloud.retryFailed', '重试失败: ') + (e.message || e));
        }
      });
    }

    // FAQ 手风琴：开一关一（容器整体位置稳定）
    // 注意：重构成 button + div 模式（不用 <details>），避免浏览器默认 toggle 行为
    // 用 requestAnimationFrame 把 class 切换推迟到下一帧，避免点击瞬间的 micro-stutter
    const faqItems = document.querySelectorAll('.vx-faq-item');
    faqItems.forEach(item => {
      const button = item.querySelector('.vx-faq-summary');
      if (!button) return;
      button.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        // 互斥：先关所有
        faqItems.forEach(other => {
          if (other.classList.contains('is-open')) {
            other.classList.remove('is-open');
            const otherBtn = other.querySelector('.vx-faq-summary');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });
        // 用 rAF 把状态变更推迟到下一帧，让点击反馈（按下）和过渡（动画）解耦
        requestAnimationFrame(() => {
          if (!isOpen) {
            item.classList.add('is-open');
            button.setAttribute('aria-expanded', 'true');
          }
        });
      });
    });
  }

  // ============================================================
  // 菜单 / 抽屉 控制
  // ============================================================
  toggleMenu(openId, closeId) {
    const target = document.getElementById(openId);
    const other = document.getElementById(closeId);
    if (!target) return;
    const willOpen = !target.classList.contains('open');
    if (other) other.classList.remove('open');
    target.classList.toggle('open', willOpen);
  }

  closeAllMenus() {
    document.querySelectorAll('.vx-user-menu, .vx-timeline-menu').forEach(m => m.classList.remove('open'));
  }

  openMobileDrawer() {
    const d = document.getElementById('mobile-drawer');
    if (d) d.classList.add('open');
  }

  closeMobileDrawer() {
    const d = document.getElementById('mobile-drawer');
    if (d) d.classList.remove('open');
  }

  // ============================================================
  // 同步视图/过滤器激活样式
  // ============================================================
  syncViewToggleState() {
    // Round 4：用 classList 显式管理，避免正则替换残留（解决月历态无强调 bug）
    document.querySelectorAll('[data-view-toggle]').forEach(btn => {
      const isActive = btn.dataset.viewToggle === this.currentView;
      btn.classList.remove(
        'bg-fg', 'text-canvas',
        'bg-muted', 'text-fg/60',
        'bg-canvas', 'text-fg',
        'hover:text-fg'
      );
      if (isActive) {
        btn.classList.add('bg-fg', 'text-canvas');
      } else {
        btn.classList.add('text-fg/60', 'hover:text-fg');
      }
    });
  }

  syncFilterState() {
    // Round 4：选中态用对应语义色（红/黄/绿），而非统一黑色
    const filterClasses = {
      all:    ['bg-fg',        'text-canvas'],
      high:   ['bg-danger',    'text-canvas'],
      medium: ['bg-accent',    'text-canvas'],
      low:    ['bg-secondary', 'text-canvas']
    };
    document.querySelectorAll('#filter-bar [data-filter]').forEach(btn => {
      const f = btn.dataset.filter;
      const isActive = f === this.currentFilter;
      btn.classList.remove('bg-fg', 'bg-danger', 'bg-accent', 'bg-secondary', 'text-canvas', 'bg-canvas', 'text-fg');
      if (isActive) {
        filterClasses[f].forEach(c => btn.classList.add(c));
      } else {
        btn.classList.add('bg-canvas', 'text-fg');
      }
    });
  }

  // 语义化颜色：选中态 = 红/黄/绿；未选中态 = 灰
  importanceSelectedClasses = {
    high:   ['bg-danger',     'text-canvas', 'border-danger'],
    medium: ['bg-accent',     'text-canvas', 'border-accent'],
    low:    ['bg-secondary',  'text-canvas', 'border-secondary']
  };

  // Round 5：dataURL（base64）转 File 对象（用于上传到 Supabase Storage）
  _dataURLtoFile(dataURL, filename = 'image.png') {
    try {
      const [meta, base64] = dataURL.split(',');
      const mimeMatch = meta.match(/data:([^;]+);base64/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      return new File([array], filename, { type: mime });
    } catch (e) {
      console.error('[VEX-Timeline] dataURL → File 转换失败:', e);
      return null;
    }
  }

  setImportance(val) {
    document.querySelectorAll('#importance-selector [data-importance]').forEach(btn => {
      const v = btn.dataset.importance;
      const isSelected = v === val;
      // 清除所有相关类
      btn.classList.remove(
        'bg-fg', 'text-canvas', 'bg-muted', 'text-fg/60',
        'bg-danger', 'bg-accent', 'bg-secondary',
        'border-danger', 'border-accent', 'border-secondary'
      );
      // Round 5：用 data-selected 属性追踪选中态（更可靠，不依赖 class）
      if (isSelected) {
        btn.setAttribute('data-selected', 'true');
        this.importanceSelectedClasses[v].forEach(c => btn.classList.add(c));
      } else {
        btn.removeAttribute('data-selected');
        btn.classList.add('bg-muted', 'text-fg/60');
      }
    });
  }

  // ============================================================
  // 登录/注册/登出
  // ============================================================
  _i18n(key, fallback) {
    return (window.i18n && window.i18n.t) ? window.i18n.t(key) : fallback;
  }

  async handleLogin() {
    const usernameInput = document.getElementById('auth-username-login');
    const passwordInput = document.getElementById('auth-password-login');
    const errorEl = document.getElementById('auth-error-login');
    const username = (usernameInput?.value || '').trim();
    const password = passwordInput?.value || '';
    if (errorEl) errorEl.textContent = '';

    if (!supabaseManager.isConfigured()) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.notConfigured', '云端未配置，请联系管理员');
      this.renderDiagnosticBar();
      return;
    }
    if (!username) { if (errorEl) errorEl.textContent = this._i18n('auth.error.usernameRequired', '请输入用户名'); return; }
    if (!password) { if (errorEl) errorEl.textContent = this._i18n('auth.error.passwordRequired', '请输入密码'); return; }

    const btn = document.getElementById('auth-login-btn');
    const label = this._i18n('auth.login', '登录');
    await this._withAuthButtonLoading(btn, label, async () => {
      try {
        await authManager.login(username, password);
        await this.onLoginSuccess();
        this.renderDiagnosticBar();
      } catch (e) {
        if (errorEl) errorEl.textContent = e.message || e;
      }
    });
  }

  async handleRegister() {
    const usernameInput = document.getElementById('auth-username-register');
    const passwordInput = document.getElementById('auth-password-register');
    const errorEl = document.getElementById('auth-error-register');
    const username = (usernameInput?.value || '').trim();
    const password = passwordInput?.value || '';
    if (errorEl) errorEl.textContent = '';

    if (!supabaseManager.isConfigured()) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.notConfigured', '云端未配置，请联系管理员');
      this.renderDiagnosticBar();
      return;
    }
    if (!username) { if (errorEl) errorEl.textContent = this._i18n('auth.error.usernameRequired', '请输入用户名'); return; }
    if (!password || password.length < 6) { if (errorEl) errorEl.textContent = this._i18n('auth.error.shortPassword', '密码长度至少 6 位'); return; }

    const profile = {
      // 用户名 = 昵称（display name），不再单独收集
      nickname: username,
      realName: (document.getElementById('auth-real-name')?.value || '').trim(),
      // 家长不享受"仅填姓"（填的是孩子全名），强制关闭
      nameOnlySurname: this._authIdentity === 'parent'
        ? false
        : !!document.getElementById('auth-surname-only')?.checked,
      identity: this._authIdentity
    };

    const btn = document.getElementById('auth-register-btn');
    const label = this._i18n('auth.register', '注册');
    await this._withAuthButtonLoading(btn, label, async () => {
      try {
        await authManager.register(username, password, profile);
        await this.onLoginSuccess();
        this.renderDiagnosticBar();
      } catch (e) {
        if (errorEl) errorEl.textContent = e.message || e;
      }
    });
  }

  /**
   * 切换登录/注册视图
   * @param {'login'|'register'} view
   */
  switchAuthView(view) {
    const loginForm = document.getElementById('auth-form-login');
    const registerForm = document.getElementById('auth-form-register');
    const titleEl = document.getElementById('auth-title');
    const subtitleEl = document.getElementById('auth-subtitle');
    // 清空错误信息
    const loginErr = document.getElementById('auth-error-login');
    const registerErr = document.getElementById('auth-error-register');
    if (loginErr) loginErr.textContent = '';
    if (registerErr) registerErr.textContent = '';
    if (view === 'register') {
      if (loginForm) loginForm.classList.add('hidden');
      if (registerForm) registerForm.classList.remove('hidden');
      if (titleEl) titleEl.textContent = this._i18n('auth.createAccount', '创建账号');
      if (subtitleEl) subtitleEl.textContent = this._i18n('auth.subtitle.register', '创建新账号');
      // 仅填姓默认勾上
      const surnameCb = document.getElementById('auth-surname-only');
      if (surnameCb) surnameCb.checked = true;
      // 自动聚焦第一个空字段
      setTimeout(() => {
        const first = document.getElementById('auth-username-register');
        if (first) first.focus();
      }, 60);
    } else {
      if (loginForm) loginForm.classList.remove('hidden');
      if (registerForm) registerForm.classList.add('hidden');
      if (titleEl) titleEl.textContent = this._i18n('auth.welcomeBack', '欢迎回来');
      if (subtitleEl) subtitleEl.textContent = this._i18n('auth.subtitle.login', '登录到你的账号');
      setTimeout(() => {
        const first = document.getElementById('auth-username-login');
        if (first) first.focus();
      }, 60);
    }
  }

  // ============================================================
  // 一级权限：身份选择器（学生 / 老师 / 家长）
  // - 默认选中「学生」：绝大多数用户是学生，少点一下 = 提升效率
  // ============================================================
  _authIdentity = 'student';     // 注册表单当前选中的身份（默认学生）
  _profileIdentity = 'student';  // 补全资料弹窗当前选中的身份（默认学生）
  _settingsIdentity = 'student'; // 个人设置弹窗当前选中的身份（默认学生）

  /**
   * 绑定身份选择器（学生 / 老师 / 家长）
   * @param {'auth'|'profile'|'settings'} scope
   *   - 'auth'     : 注册表单（_authIdentity）
   *   - 'profile'  : profile-completion 弹窗（_profileIdentity）
   *   - 'settings' : 个人设置弹窗（_settingsIdentity）
   */
  _bindIdentityPicker(scope) {
    // scope → 元素 id 前缀 + 状态键
    const SCOPES = {
      auth:     { prefix: 'auth-identity',     stateKey: '_authIdentity',     surnameWrap: 'auth-surname-only-wrap',     surnameCb: 'auth-surname-only',     realNameLabel: 'auth-real-name-label',     realNameInput: 'auth-real-name',     realNameHint: 'auth-real-name-hint'     },
      profile:  { prefix: 'profile-identity',  stateKey: '_profileIdentity',  surnameWrap: 'profile-surname-only-wrap',  surnameCb: 'profile-surname-only',  realNameLabel: 'profile-real-name-label',  realNameInput: 'profile-real-name',  realNameHint: 'profile-real-name-hint'  },
      settings: { prefix: 'settings-identity', stateKey: '_settingsIdentity', surnameWrap: 'settings-surname-only-wrap', surnameCb: 'settings-surname-only', realNameLabel: 'settings-real-name-label', realNameInput: 'settings-real-name', realNameHint: 'settings-real-name-hint' },
    };
    const cfg = SCOPES[scope];
    if (!cfg) {
      // 未知 scope 静默跳过（避免抛错打断 init）
      return;
    }
    const { prefix, stateKey } = cfg;
    const studentBtn = document.getElementById(`${prefix}-student`);
    const teacherBtn = document.getElementById(`${prefix}-teacher`);
    const parentBtn  = document.getElementById(`${prefix}-parent`);
    const surnameWrap = document.getElementById(cfg.surnameWrap);
    const surnameCheckbox = document.getElementById(cfg.surnameCb);
    const realNameLabel = document.getElementById(cfg.realNameLabel);
    const realNameInput = document.getElementById(cfg.realNameInput);
    const realNameHint  = document.getElementById(cfg.realNameHint);

    const buttons = { student: studentBtn, teacher: teacherBtn, parent: parentBtn };

    // 切换身份时同步真实姓名字段的标签/占位/提示，以及仅填姓的可见性
    const syncRealNameField = (selected) => {
      const t = (k, d) => (window.i18n && window.i18n.t ? window.i18n.t(k, d) : (d || k));
      if (selected === 'parent') {
        if (realNameLabel) realNameLabel.textContent = t('auth.realName.parent', '孩子的姓名');
        if (realNameInput) realNameInput.placeholder = t('auth.realName.parent.ph', '请输入孩子的真实姓名');
        if (realNameHint)  realNameHint.classList.remove('hidden');
        // 家长不享受"仅填姓"，强制隐藏 + 取消勾选
        if (surnameWrap) {
          surnameWrap.classList.add('hidden');
          surnameWrap.classList.remove('flex');
        }
        if (surnameCheckbox) surnameCheckbox.checked = false;
      } else {
        if (realNameLabel) realNameLabel.textContent = t('auth.realName', '真实姓名');
        if (realNameInput) realNameInput.placeholder = t('auth.realName.ph', '输入真实姓名');
        if (realNameHint)  realNameHint.classList.add('hidden');
        if (surnameWrap) {
          if (selected === 'teacher') {
            surnameWrap.classList.remove('hidden');
            surnameWrap.classList.add('flex');
            // 老师账号注册时：默认勾选"仅填姓"（隐私更友好，也是推荐项）
            if (surnameCheckbox) surnameCheckbox.checked = true;
          } else {
            surnameWrap.classList.add('hidden');
            surnameWrap.classList.remove('flex');
            if (surnameCheckbox) surnameCheckbox.checked = false;
          }
        }
      }
    };

    // 让当前选中的按钮立刻在视觉上高亮
    const paintSelected = () => {
      const sel = this[stateKey];
      const setActive = (btn, isActive) => {
        if (!btn) return;
        btn.classList.toggle('bg-primary', isActive);
        btn.classList.toggle('text-canvas', isActive);
        btn.classList.toggle('bg-muted', !isActive);
        btn.classList.toggle('text-fg/60', !isActive);
        btn.classList.toggle('border-2', isActive);
        btn.classList.toggle('border-primary', isActive);
      };
      setActive(studentBtn, sel === 'student');
      setActive(teacherBtn, sel === 'teacher');
      setActive(parentBtn,  sel === 'parent');
      syncRealNameField(sel);
    };
    // 给三个按钮都绑 click
    Object.entries(buttons).forEach(([key, btn]) => {
      if (!btn) return;
      // 避免重复绑定（用户连续打开 settings modal 不会重复累加 listener）
      if (btn.__identityBound) return;
      btn.__identityBound = true;
      btn.addEventListener('click', () => {
        this[stateKey] = key;
        if (key === 'student' && surnameCheckbox) surnameCheckbox.checked = false;
        paintSelected();
      });
    });
    // 初始绘制一次（让默认的"学生"在视觉上高亮）
    paintSelected();
  }

  // ============================================================
  // 一级权限：老用户补全资料
  // ============================================================
  _ensureProfileIdentity() {
    // 如果 currentUser.identity 已有值，预填到 picker（即便 section 隐藏也同步内部状态）
    if (authManager.getCurrentUser()?.identity) {
      this._profileIdentity = authManager.getCurrentUser().identity;
      this._bindIdentityPicker('profile');
    }
  }

  /**
   * 主应用初始化后调用：若需要补全资料，弹出弹窗
   */
  checkProfileCompletion() {
    if (!authManager.isLoggedIn()) return;
    if (!authManager.needsProfileCompletion()) return;
    this._ensureProfileIdentity();
    this.openProfileCompletionModal();
  }

  openProfileCompletionModal() {
    const modal = document.getElementById('profile-completion-modal');
    if (!modal) return;
    const u = authManager.getCurrentUser();

    // 1) 根据已有数据隐藏已存在的字段：
    //    - 昵称已合并到用户名（永远不显示输入框）
    //    - 真实姓名 / 身份：已有 → 整段隐藏
    const realNameSection = document.getElementById('profile-real-name-section');
    const identitySection = document.getElementById('profile-identity-section');
    const realInput = document.getElementById('profile-real-name');
    const surnameCheckbox = document.getElementById('profile-surname-only');
    const surnameWrap = document.getElementById('profile-surname-only-wrap');

    // 真实姓名：已存在 → 整段隐藏
    if (u?.real_name) {
      if (realNameSection) {
        realNameSection.classList.add('hidden');
        // surname-only 与 real_name 绑定；real_name 已有则隐藏 surname-only
        if (surnameWrap) {
          surnameWrap.classList.add('hidden');
          surnameWrap.classList.remove('flex');
        }
      }
    } else {
      if (realNameSection) realNameSection.classList.remove('hidden');
    }

    // 身份：已存在 → 整段隐藏
    if (u?.identity) {
      if (identitySection) {
        identitySection.classList.add('hidden');
        if (surnameWrap) {
          surnameWrap.classList.add('hidden');
          surnameWrap.classList.remove('flex');
        }
      }
    } else {
      if (identitySection) identitySection.classList.remove('hidden');
    }

    // 2) 预填已存在的字段值（即使 section 显示也保留兜底）
    //    注意：昵称字段已合并到 username（index.html 已删掉 nickname input），
    //    这里不再读 / 写 nickInput，避免 ReferenceError 中断整个 modal 打开流程。
    if (realInput && u?.real_name) realInput.value = u.real_name;
    if (surnameCheckbox && u?.name_only_surname) surnameCheckbox.checked = true;

    // 3) 兜底：让"保存"按钮一定可用（不再根据 identity 是否存在禁用 skip）
    //    "稍后"按钮改为始终可点，但点击后弹"劝导弹窗"（见 handleProfileCompletionSkip）

    modal.classList.add('active');
    // i18n re-render
    if (window.i18n) window.i18n.apply();
  }

  closeProfileCompletionModal() {
    const modal = document.getElementById('profile-completion-modal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * 打开"你必须填哦"劝导弹窗（来自点击"稍后"）
   */
  openProfileNudgeModal() {
    const modal = document.getElementById('profile-nudge-modal');
    if (!modal) return;
    modal.classList.add('active');
    if (window.lucide && lucide.createIcons) lucide.createIcons();
    // 自动聚焦"好的，我去填"按钮
    setTimeout(() => {
      const ok = document.getElementById('profile-nudge-ok');
      if (ok) ok.focus();
    }, 80);
  }

  closeProfileNudgeModal() {
    const modal = document.getElementById('profile-nudge-modal');
    if (modal) modal.classList.remove('active');
  }

  async handleProfileCompletionSubmit() {
    const errorEl = document.getElementById('profile-completion-error');
    if (errorEl) errorEl.textContent = '';
    // 昵称已经合并到用户名（username），不需要用户再填
    // 真实姓名 / 身份 section：已存在时整段隐藏，未存在时显示
    const realNameSection = document.getElementById('profile-real-name-section');
    const identitySection = document.getElementById('profile-identity-section');
    const wantRealName = realNameSection && !realNameSection.classList.contains('hidden');
    const wantIdentity = identitySection && !identitySection.classList.contains('hidden');

    // nickname 永远 = username（用户级显示名）
    const nickname = authManager.getCurrentUser()?.username || authManager.getCurrentUser()?.nickname || '';
    const realName = wantRealName
      ? (document.getElementById('profile-real-name')?.value || '').trim()
      : (authManager.getCurrentUser()?.real_name || '');
    // 家长强制关闭 surname-only（不享受"仅填姓"逻辑）
    const identity = wantIdentity ? this._profileIdentity : (authManager.getCurrentUser()?.identity || '');
    const surnameOnly = identity === 'parent'
      ? false
      : !!document.getElementById('profile-surname-only')?.checked;

    // 只校验"需要补全"的字段
    if (wantRealName && !realName) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.realNameRequired', '请填写真实姓名');
      return;
    }
    if (wantIdentity && !identity) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.identityRequired', '请选择身份');
      return;
    }
    if (identity === 'student' && realName && realName.length < 2) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.realNameStudentTooShort', '学生姓名至少 2 个字符');
      return;
    }
    if (identity === 'teacher' && surnameOnly && realName.length !== 1) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.realNameTeacherSurname', '老师仅填姓时，姓名必须是 1 个字符');
      return;
    }
    if (identity === 'teacher' && !surnameOnly && realName && realName.length < 2) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.realNameTeacherTooShort', '老师姓名至少 2 个字符');
      return;
    }
    // 家长：必须 >= 2 字符（孩子全名），不享受 surname-only
    if (identity === 'parent' && realName && realName.length < 2) {
      if (errorEl) errorEl.textContent = this._i18n('auth.error.realNameParentTooShort', '孩子的姓名至少 2 个字符');
      return;
    }

    const btn = document.getElementById('profile-completion-submit');
    const label = this._i18n('auth.completion.submit', '保存');
    await this._withAuthButtonLoading(btn, label, async () => {
      try {
        await authManager.completeProfile({
          nickname, realName, nameOnlySurname: surnameOnly, identity
        });
        this.closeProfileCompletionModal();
        // 标记完成（防止中途刷新重复弹窗）
        try { localStorage.setItem('vex.profile_completed', 'true'); } catch (e) { /* ignore */ }
        // 刷新用户显示
        this.updateUserMenu();
        this.showToast(this._i18n('app.toast.profileSaved', '资料已保存'), 'success');
      } catch (e) {
        if (errorEl) errorEl.textContent = this._i18n('auth.error.profileSaveFailed', '保存失败：') + (e.message || e);
      }
    });
  }

  /**
   * "稍后"按钮 → 弹一个俏皮劝导弹窗（让用户觉得网站有性格）
   * - 不再直接关闭 / 跳过
   * - 关闭劝导弹窗后焦点回到主弹窗的第一个未填字段
   */
  handleProfileCompletionSkip() {
    this.openProfileNudgeModal();
  }

  /**
   * 包装登录/注册按钮的 loading 态：
   * 1. 禁用按钮（避免重复点击 + 触发 hover 缩放）
   * 2. 替换内容为 spinner + "登录中…" / "注册中…"
   * 3. 无论成功失败都 finally 还原（保证异常路径下按钮不卡死）
   * 用箭头函数保留 this。
   */
  async _withAuthButtonLoading(btn, label, fn) {
    if (!btn) return fn();
    if (btn.disabled) return;            // 防止双击
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="vx-spinner vx-spinner-sm" aria-hidden="true"></span><span>${label}…</span>`;
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  async handleLogout() {
    // Round 5：停止自动刷新（避免内存泄漏 + 登出后继续拉取）
    this._stopAutoRefresh();
    await authManager.logout();
    this.currentTimelineId = null;
    this._saveStoredTimelineId(null);
    this.timelines = [];
    // 登出 → 回到首页（不直接回登录页，用户需主动点击首页 CTA）
    this.showHomePage();
    // 清空两个表单的字段与错误信息
    ['auth-username-login', 'auth-password-login', 'auth-username-register',
     'auth-password-register', 'auth-nickname', 'auth-real-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const err1 = document.getElementById('auth-error-login');
    const err2 = document.getElementById('auth-error-register');
    if (err1) err1.textContent = '';
    if (err2) err2.textContent = '';
    // 切回登录视图
    this.switchAuthView('login');
    this._setAddEnabled(true);
    this.cloudSyncStatus = 'unknown';
    this.cloudErrorMessage = '';
    this.updateCloudStatusIcon();
    this.renderDiagnosticBar();
  }

  // ============================================================
  // Round 5：5 分钟自动刷新云端
  // ============================================================
  _startAutoRefresh() {
    if (this._autoRefreshInterval) clearInterval(this._autoRefreshInterval);
    this._autoRefreshInterval = setInterval(async () => {
      if (!authManager.isLoggedIn() || !this.currentTimelineId || !this.isOnline) return;
      if (this.syncInProgress) return;                            // 避免重叠
      if (this.cloudSyncStatus === 'error') return;                // 错误态不重试
      try {
        await this.syncFromCloud();
        console.log('[VEX-Timeline] Auto refresh @', new Date().toLocaleTimeString());
      } catch (e) {
        console.warn('[VEX-Timeline] Auto refresh failed:', e.message || e);
      }
    }, 5 * 60 * 1000);
  }

  _stopAutoRefresh() {
    if (this._autoRefreshInterval) {
      clearInterval(this._autoRefreshInterval);
      this._autoRefreshInterval = null;
    }
  }

  // ============================================================
  // 赛队操作
  // ============================================================
  handleTeamAction(action) {
    if (action === 'create') this.openModalById('create-team-modal');
    else if (action === 'join') this.openModalById('join-team-modal');
    else if (action === 'manage') this.handleManageTeam();
  }

  // ============================================================
  // 个人设置：账号管理弹窗
  // 入口：顶栏下拉菜单 / 移动端汉堡菜单里的 "data-user-action='settings'"
  // 内容：基本信息（真实姓名 / 身份）/ 用户名 / 更改密码 —— 三个独立表单
  // ============================================================
  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const u = authManager.getCurrentUser();
    if (!u) return;

    // 1) 预填基本信息
    const realInput = document.getElementById('settings-real-name');
    if (realInput) realInput.value = u.real_name || '';
    const surnameCheckbox = document.getElementById('settings-surname-only');
    if (surnameCheckbox) surnameCheckbox.checked = !!u.name_only_surname;
    const usernameInput = document.getElementById('settings-username');
    if (usernameInput) usernameInput.value = u.username || '';

    // 2) 身份选择器：复用 _bindIdentityPicker 的 'settings' scope
    this._settingsIdentity = u.identity || 'student';
    this._bindIdentityPicker('settings');

    // 3) 绑定三个表单的 submit（避免重复绑定）
    const basicForm = document.getElementById('settings-basic-form');
    if (basicForm && !basicForm.__bound) {
      basicForm.__bound = true;
      basicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleSettingsBasicSubmit();
      });
    }
    const usernameForm = document.getElementById('settings-username-form');
    if (usernameForm && !usernameForm.__bound) {
      usernameForm.__bound = true;
      usernameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleSettingsUsernameSubmit();
      });
    }
    const passwordForm = document.getElementById('settings-password-form');
    if (passwordForm && !passwordForm.__bound) {
      passwordForm.__bound = true;
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleSettingsPasswordSubmit();
      });
    }

    // 4) 绑定顶部 tab 切换（事件委托到 nav 容器，避免重复绑 3 个 button）
    const tabNav = document.getElementById('settings-tab-nav');
    if (tabNav && !tabNav.__bound) {
      tabNav.__bound = true;
      tabNav.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-settings-tab]');
        if (!tabBtn) return;
        this._switchSettingsTab(tabBtn.dataset.settingsTab);
      });
    }

    // 5) 绑定取消按钮（事件委托到 modal 容器，3 个 tab 各有一个"取消"按钮）
    if (!modal.__cancelBound) {
      modal.__cancelBound = true;
      modal.addEventListener('click', (e) => {
        const cancelBtn = e.target.closest('[data-settings-action="cancel"]');
        if (!cancelBtn) return;
        modal.classList.remove('active');
      });
    }

    // 5) 重置到 default tab (basic)
    this._switchSettingsTab('basic');

    // 6) 清空错误提示 / 密码框
    const clearErr = (sel) => { const el = document.querySelector(sel); if (el) el.textContent = ''; };
    clearErr('#settings-basic-form .settings-error');
    clearErr('#settings-username-form .settings-username-error');
    clearErr('#settings-password-form .settings-password-error');
    ['settings-old-password', 'settings-new-password', 'settings-confirm-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // 7) 打开弹窗 + i18n 重新渲染 + 注入 lucide icons
    modal.classList.add('active');
    if (window.i18n) window.i18n.apply();
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  /**
   * 切换 settings modal 的 tab
   * @param {'basic'|'username'|'password'} tabKey
   */
  _switchSettingsTab(tabKey) {
    const validTabs = ['basic', 'username', 'password'];
    if (!validTabs.includes(tabKey)) return;

    // 1) 更新所有 tab button 的视觉态
    document.querySelectorAll('#settings-tab-nav [data-settings-tab]').forEach(btn => {
      const isActive = btn.dataset.settingsTab === tabKey;
      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('text-primary', isActive);
      btn.classList.toggle('border-primary', isActive);
      btn.classList.toggle('text-fg/40', !isActive);
      btn.classList.toggle('border-transparent', !isActive);
    });

    // 2) 显示对应 panel，隐藏其他（用 vx-settings-panel-hidden 类，
    //    保留 layout 占位 — body 是 grid + 三 panel 同 cell，高度永远 = 最高 panel 高度，
    //    切 tab 时弹窗总高度不会跳动）
    document.querySelectorAll('[data-settings-panel]').forEach(panel => {
      const shouldShow = panel.dataset.settingsPanel === tabKey;
      panel.classList.toggle('vx-settings-panel-hidden', !shouldShow);
    });
  }

  /**
   * 提交：基本信息（真实姓名 + 身份）
   * 复用 auth.completeProfile，避开业务规则（家长>=2字符、老师仅填姓等）
   */
  async _handleSettingsBasicSubmit() {
    const errEl = document.querySelector('#settings-basic-form .settings-error');
    if (errEl) errEl.textContent = '';
    const realName = (document.getElementById('settings-real-name')?.value || '').trim();
    const surnameOnly = this._settingsIdentity === 'parent'
      ? false
      : !!document.getElementById('settings-surname-only')?.checked;
    const identity = this._settingsIdentity;
    const u = authManager.getCurrentUser();
    if (!u) return;

    try {
      // username 已等于 nickname（合并），所以 nickname 字段直接传 username
      await authManager.completeProfile({
        nickname: u.username || '',
        realName,
        nameOnlySurname: surnameOnly,
        identity,
      });
      // 刷新顶栏 / 用户菜单 / 主视图（赛队成员身份胶囊会跟着更新）
      this.updateUserMenu();
      if (typeof this.renderView === 'function') this.renderView();
      // 关弹窗
      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.remove('active');
      if (typeof this.showToast === 'function') {
        this.showToast(this._i18n('app.user.basicInfoSaved', '基本信息已更新'));
      }
    } catch (e) {
      if (errEl) errEl.textContent = (e && e.message) ? e.message : String(e);
    }
  }

  /**
   * 提交：改用户名
   * username 实际存放在 auth.users.email（"xxx@vex-timeline.local"）
   * 流程：唯一性检查 → updateUser({ email }) → 同步 public.users.username
   */
  async _handleSettingsUsernameSubmit() {
    const errEl = document.querySelector('#settings-username-form .settings-username-error');
    if (errEl) errEl.textContent = '';
    const newUsername = (document.getElementById('settings-username')?.value || '').trim();
    const u = authManager.getCurrentUser();
    if (!u) return;

    // 校验
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(newUsername)) {
      if (errEl) errEl.textContent = this._i18n('app.user.usernameInvalid', '用户名只能是 3-20 位字母/数字/_-');
      return;
    }
    if (newUsername === u.username) {
      if (errEl) errEl.textContent = this._i18n('app.user.usernameUnchanged', '用户名未变化');
      return;
    }

    try {
      const supabase = (window.supabaseManager && window.supabaseManager.getClient)
        ? window.supabaseManager.getClient()
        : null;
      if (!supabase) {
        if (errEl) errEl.textContent = 'Supabase 未配置';
        return;
      }
      // 1) 唯一性检查
      const { data: existing, error: chkErr } = await supabase
        .from('users')
        .select('id')
        .eq('username', newUsername)
        .neq('id', u.id)
        .maybeSingle();
      if (chkErr) throw chkErr;
      if (existing) {
        if (errEl) errEl.textContent = this._i18n('auth.error.taken', '用户名已被占用');
        return;
      }
      // 2) 改 auth.users.email
      const { error: updErr } = await supabase.auth.updateUser({
        email: newUsername + '@vex-timeline.local',
      });
      if (updErr) throw updErr;
      // 3) 同步 public.users.username
      const { error: syncErr } = await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('id', u.id);
      if (syncErr) throw syncErr;

      // 4) 重新加载 profile + 刷新 UI
      if (typeof authManager._loadUserProfile === 'function') {
        await authManager._loadUserProfile(u.id);
      }
      this.updateUserMenu();
      if (typeof this.renderView === 'function') this.renderView();
      if (typeof this.showToast === 'function') {
        this.showToast(this._i18n('app.user.usernameSaved', '用户名已更新，下次登录请用新用户名'));
      }
    } catch (e) {
      if (errEl) errEl.textContent = (e && e.message) ? e.message : String(e);
    }
  }

  /**
   * 提交：改密码（先验证旧密码，再 updateUser({ password })）
   */
  async _handleSettingsPasswordSubmit() {
    const errEl = document.querySelector('#settings-password-form .settings-password-error');
    if (errEl) errEl.textContent = '';
    const oldPw = document.getElementById('settings-old-password')?.value || '';
    const newPw = document.getElementById('settings-new-password')?.value || '';
    const confirmPw = document.getElementById('settings-confirm-password')?.value || '';
    const u = authManager.getCurrentUser();
    if (!u) return;

    // 校验
    if (oldPw.length < 6 || newPw.length < 6) {
      if (errEl) errEl.textContent = this._i18n('auth.error.shortPassword', '密码至少 6 位');
      return;
    }
    if (newPw !== confirmPw) {
      if (errEl) errEl.textContent = this._i18n('auth.error.passwordMismatch', '两次输入的新密码不一致');
      return;
    }
    if (oldPw === newPw) {
      if (errEl) errEl.textContent = this._i18n('auth.error.passwordUnchanged', '新密码不能与旧密码相同');
      return;
    }

    try {
      const supabase = (window.supabaseManager && window.supabaseManager.getClient)
        ? window.supabaseManager.getClient()
        : null;
      if (!supabase) {
        if (errEl) errEl.textContent = 'Supabase 未配置';
        return;
      }
      // 1) 旧密码验证（signInWithPassword 在已登录 session 下不刷新 token）
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: (u.username || '') + '@vex-timeline.local',
        password: oldPw,
      });
      if (signInErr) {
        if (errEl) errEl.textContent = this._i18n('app.user.oldPasswordWrong', '旧密码错误');
        return;
      }
      // 2) 改密码
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
      if (pwErr) throw pwErr;

      // 3) 清空三个密码输入框（避免留在 DOM 里被 XSS 抓）
      ['settings-old-password', 'settings-new-password', 'settings-confirm-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      if (typeof this.showToast === 'function') {
        this.showToast(this._i18n('app.user.passwordSaved', '密码已更新'));
      }
    } catch (e) {
      if (errEl) errEl.textContent = (e && e.message) ? e.message : String(e);
    }
  }

  openModalById(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }

  closeModalById(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  async handleCreateTeam() {
    const nameInput = document.getElementById('team-name');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
      if (supabaseManager.isConfigured()) {
        const timeline = await cloudDBManager.createTimeline(name, 'team');
        this.timelines.push(timeline);
        this.currentTimelineId = timeline.id;
        this.updateTimelineSelector();
        this._loadCurrentTimelineRole().catch(() => {});
      }
    } catch (e) {
      console.error('[VEX-Timeline] createTimeline failed:', e);
    }

    nameInput.value = '';
    this.closeModalById('create-team-modal');
    await this.renderView();
  }

  async handleJoinTeam() {
    const codeInput = document.getElementById('invite-code-input');
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return;

    try {
      if (supabaseManager.isConfigured()) {
        const timeline = await cloudDBManager.joinTimelineByInviteCode(code);
        this.timelines.push(timeline);
        this.currentTimelineId = timeline.id;
        this.updateTimelineSelector();
        this._loadCurrentTimelineRole().catch(() => {});
        await this.renderView();
      }
    } catch (e) {
      alert(e.message || this._i18n('app.team.joinFail', '加入失败'));
    }

    codeInput.value = '';
    this.closeModalById('join-team-modal');
  }

  async handleManageTeam() {
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    if (!current || current.type !== 'team') {
      // 个人时间轴下管理赛队按钮已经被 updateManageButton 隐藏，这里是兜底：
      // 极端 race condition 进入此函数时直接 return，不再弹 toast
      // （避免给个人时间轴下的用户弹出"请切换到赛队"等无意义提示）
      return;
    }

    // 1. 按角色控制邀请码 / 重置邀请码 / 删除赛队 的可见性
    const role = await this._loadCurrentTimelineRole();
    const inviteSection = document.getElementById('invite-code-section');
    const regenBtn = document.getElementById('regenerate-invite-btn');
    const deleteBtn = document.getElementById('delete-team-btn');
    if (inviteSection) inviteSection.classList.toggle('hidden', !this.canViewInvite());
    if (regenBtn) regenBtn.classList.toggle('hidden', !this.canResetInvite());
    if (deleteBtn) deleteBtn.classList.toggle('hidden', !this.canDeleteTimeline());

    // 2. 显示邀请码
    document.getElementById('invite-code-display').textContent = current.invite_code || '---';

    // 3. 加载成员列表
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = `<div class="px-4 py-3 text-sm text-fg/60">${this._i18n('app.empty.loading', '加载中…')}</div>`;

    try {
      const members = await cloudDBManager.getTimelineMembers(this.currentTimelineId);
      const canManage = this.canManageMembers();

      if (!members || members.length === 0) {
        membersList.innerHTML = `<div class="px-4 py-3 text-sm text-fg/60">${this._i18n('app.team.noMembers', '暂无成员')}</div>`;
      } else {
        // 拥有者置顶，其余按 displayName 升序
        const sortedMembers = [...members].sort((a, b) => {
          if (a.role === 'owner' && b.role !== 'owner') return -1;
          if (a.role !== 'owner' && b.role === 'owner') return 1;
          return this.getFullDisplayName(a.users || {}).localeCompare(this.getFullDisplayName(b.users || {}));
        });
        const roleLabel = {
          owner: this._i18n('app.team.roleOwner', '所有者'),
          captain: this._i18n('app.team.roleCaptain', '队长'),
          teacher: this._i18n('app.team.roleTeacher', '老师'),
          member: this._i18n('app.team.roleMember', '队员'),
          visitor: this._i18n('app.team.roleVisitor', '访客')
        };
        const ROLE_OPTIONS = ['captain', 'teacher', 'member', 'visitor'];

        membersList.innerHTML = sortedMembers.map(member => {
          const user = member.users || {};
          const displayName = this._escapeHtml(this.getFullDisplayName(user));
          // 一级权限（identity）只是给队长参考；二级权限（role）才是真正维度，队长给出后不再显示一级身份胶囊
          const isOwnerRow = member.role === 'owner';
          const currentRoleLabel = roleLabel[member.role] || member.role;
          // 角色胶囊：每个成员名后都展示（owner 永远显示，不可管理时也显示，可管理时仍显示 — 与下拉并存）
          const roleTag = `<span class="vx-member-role-tag vx-member-role-tag--${member.role}">${this._escapeHtml(currentRoleLabel)}</span>`;
          const roleSelectHtml = (canManage && !isOwnerRow) ? `
            <select class="vx-role-select" data-user-id="${member.user_id}">
              ${ROLE_OPTIONS.map(r => `<option value="${r}" ${r === member.role ? 'selected' : ''}>${this._escapeHtml(roleLabel[r] || r)}</option>`).join('')}
            </select>
          ` : '';
          const removeBtnHtml = (canManage && !isOwnerRow) ? `
            <button class="vx-member-remove-btn" data-user-id="${member.user_id}" title="${this._escapeHtml(this._i18n('app.action.delete', '删除'))}" aria-label="${this._escapeHtml(this._i18n('app.action.delete', '删除'))}">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          ` : '';
          return `
            <div class="vx-member-row">
              <div class="vx-member-name">${displayName}${roleTag}</div>
              ${roleSelectHtml}
              ${removeBtnHtml}
            </div>
          `;
        }).join('');
      }

      if (window.lucide && lucide.createIcons) lucide.createIcons();

      // 角色下拉 change → 更新角色
      membersList.querySelectorAll('.vx-role-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const userId = e.currentTarget.dataset.userId;
          const newRole = e.currentTarget.value;
          e.currentTarget.disabled = true;
          try {
            await cloudDBManager.updateMemberRole(this.currentTimelineId, userId, newRole);
            this.showToast(this._i18n('app.team.roleUpdated', '角色已更新'), 'success');
            // 刷新成员列表（保持排序与显示名一致）
            await this._refreshMembersList();
          } catch (err) {
            console.error(err);
            this.showToast(this._i18n('app.team.roleUpdateFail', '更新角色失败：') + (err.message || err), 'error');
          } finally {
            e.currentTarget.disabled = false;
          }
        });
      });

      // X 按钮 click → 弹出确认 → removeMember
      membersList.querySelectorAll('.vx-member-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const userId = e.currentTarget.dataset.userId;
          const row = e.currentTarget.closest('.vx-member-row');
          const displayName = row ? row.querySelector('.vx-member-name')?.textContent || '' : '';
          if (!confirm(this._i18n('app.team.confirmRemoveMember', '确定要移除该成员吗？') + (displayName ? ` (${displayName})` : ''))) return;
          try {
            await cloudDBManager.removeMember(this.currentTimelineId, userId);
            this.showToast(this._i18n('app.team.memberRemoved', '已移除成员'), 'success');
            await this._refreshMembersList();
          } catch (err) {
            console.error(err);
            this.showToast(this._i18n('app.team.removeFail', '移除失败: ') + (err.message || err), 'error');
          }
        });
      });
    } catch (e) {
      console.error('[VEX-Timeline] getTimelineMembers failed:', e);
      membersList.innerHTML = `<div class="px-4 py-3 text-sm text-danger">${this._i18n('app.empty.fail', '加载失败: ')}${this._escapeHtml(e.message || String(e))}</div>`;
      this.showToast(this._i18n('app.team.membersFail', '加载成员失败: ') + (e.message || e), 'error');
    }

    this.openModalById('invite-modal');
  }

  /** 重新渲染成员列表（保留加载中/错误态逻辑） */
  async _refreshMembersList() {
    if (!this.currentTimelineId) return;
    const membersList = document.getElementById('members-list');
    try {
      const members = await cloudDBManager.getTimelineMembers(this.currentTimelineId);
      const canManage = this.canManageMembers();
      if (!members || members.length === 0) {
        membersList.innerHTML = `<div class="px-4 py-3 text-sm text-fg/60">${this._i18n('app.team.noMembers', '暂无成员')}</div>`;
        return;
      }
      const sortedMembers = [...members].sort((a, b) => {
        if (a.role === 'owner' && b.role !== 'owner') return -1;
        if (a.role !== 'owner' && b.role === 'owner') return 1;
        return this.getFullDisplayName(a.users || {}).localeCompare(this.getFullDisplayName(b.users || {}));
      });
      const roleLabel = {
        owner: this._i18n('app.team.roleOwner', '所有者'),
        captain: this._i18n('app.team.roleCaptain', '队长'),
        teacher: this._i18n('app.team.roleTeacher', '老师'),
        member: this._i18n('app.team.roleMember', '队员'),
        visitor: this._i18n('app.team.roleVisitor', '访客')
      };
      const ROLE_OPTIONS = ['captain', 'teacher', 'member', 'visitor'];
      membersList.innerHTML = sortedMembers.map(member => {
        const user = member.users || {};
        const displayName = this._escapeHtml(this.getFullDisplayName(user));
        // 一级权限（identity）只是给队长参考；二级权限（role）才是真正维度，队长给出后不再显示一级身份胶囊
        const isOwnerRow = member.role === 'owner';
        const currentRoleLabel = roleLabel[member.role] || member.role;
        // 角色胶囊：每个成员名后都展示（owner 永远显示；可管理时与下拉并存；不可管理时单独显示）
        const roleTag = `<span class="vx-member-role-tag vx-member-role-tag--${member.role}">${this._escapeHtml(currentRoleLabel)}</span>`;
        const roleSelectHtml = (canManage && !isOwnerRow) ? `
          <select class="vx-role-select" data-user-id="${member.user_id}">
            ${ROLE_OPTIONS.map(r => `<option value="${r}" ${r === member.role ? 'selected' : ''}>${this._escapeHtml(roleLabel[r] || r)}</option>`).join('')}
          </select>
        ` : '';
        const removeBtnHtml = (canManage && !isOwnerRow) ? `
          <button class="vx-member-remove-btn" data-user-id="${member.user_id}" title="${this._escapeHtml(this._i18n('app.action.delete', '删除'))}" aria-label="${this._escapeHtml(this._i18n('app.action.delete', '删除'))}">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        ` : '';
        return `
          <div class="vx-member-row">
            <div class="vx-member-name">${displayName}${roleTag}</div>
            ${roleSelectHtml}
            ${removeBtnHtml}
          </div>
        `;
      }).join('');
      if (window.lucide && lucide.createIcons) lucide.createIcons();
      // 重新绑定 change / click 事件
      membersList.querySelectorAll('.vx-role-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const userId = e.currentTarget.dataset.userId;
          const newRole = e.currentTarget.value;
          e.currentTarget.disabled = true;
          try {
            await cloudDBManager.updateMemberRole(this.currentTimelineId, userId, newRole);
            this.showToast(this._i18n('app.team.roleUpdated', '角色已更新'), 'success');
            await this._refreshMembersList();
          } catch (err) {
            this.showToast(this._i18n('app.team.roleUpdateFail', '更新角色失败：') + (err.message || err), 'error');
          } finally {
            e.currentTarget.disabled = false;
          }
        });
      });
      membersList.querySelectorAll('.vx-member-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const userId = e.currentTarget.dataset.userId;
          const row = e.currentTarget.closest('.vx-member-row');
          const displayName = row ? row.querySelector('.vx-member-name')?.textContent || '' : '';
          if (!confirm(this._i18n('app.team.confirmRemoveMember', '确定要移除该成员吗？') + (displayName ? ` (${displayName})` : ''))) return;
          try {
            await cloudDBManager.removeMember(this.currentTimelineId, userId);
            this.showToast(this._i18n('app.team.memberRemoved', '已移除成员'), 'success');
            await this._refreshMembersList();
          } catch (err) {
            this.showToast(this._i18n('app.team.removeFail', '移除失败: ') + (err.message || err), 'error');
          }
        });
      });
    } catch (e) {
      membersList.innerHTML = `<div class="px-4 py-3 text-sm text-danger">${this._i18n('app.empty.fail', '加载失败: ')}${this._escapeHtml(e.message || String(e))}</div>`;
    }
  }

  // ============================================================
  // Toast 提示（替代 alert / 静默 return）
  // ============================================================
  /**
   * 顶部 / 底部 toast
   * @param {string} message  文案
   * @param {string|object} [typeOrOptions]  'info' | 'success' | 'warning' | 'error'，或
   *                                         { type, duration, actionLabel, action }
   * @param {object} [legacyOpts] 兼容旧调用：{ duration, actionLabel, action }
   */
  showToast(message, typeOrOptions = 'info', legacyOpts) {
    const t = document.getElementById('vx-toast');
    if (!t) return;
    let type = 'info';
    let duration = 3000;
    let actionLabel = null;
    let action = null;
    if (typeof typeOrOptions === 'string') {
      type = typeOrOptions;
      if (legacyOpts && typeof legacyOpts === 'object') {
        duration = legacyOpts.duration || duration;
        actionLabel = legacyOpts.actionLabel || actionLabel;
        action = legacyOpts.action || action;
      }
    } else if (typeOrOptions && typeof typeOrOptions === 'object') {
      type = typeOrOptions.type || type;
      duration = typeOrOptions.duration || duration;
      actionLabel = typeOrOptions.actionLabel || actionLabel;
      action = typeOrOptions.action || action;
    }
    const colors = {
      info:    'bg-fg text-canvas',
      success: 'bg-secondary text-canvas',
      warning: 'bg-accent text-canvas',
      error:   'bg-danger text-canvas'
    };
    t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-md text-sm font-semibold z-[200] shadow-none flex items-center gap-3 ${colors[type] || colors.info}`;
    if (actionLabel && typeof action === 'function') {
      t.innerHTML = `<span></span><button type="button" class="vx-toast-action"></button>`;
      t.querySelector('span').textContent = message;
      const btn = t.querySelector('button.vx-toast-action');
      btn.textContent = actionLabel;
      btn.style.cssText = 'background:rgba(255,255,255,0.18);padding:0.25rem 0.625rem;border-radius:4px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;font-size:0.6875rem;cursor:pointer;border:0;color:inherit;';
      btn.addEventListener('click', () => { try { action(); } catch (e) { console.warn('[VEX-Timeline] toast action failed:', e); } });
    } else {
      t.textContent = message;
    }
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
  }

  copyInviteCode() {
    const code = document.getElementById('invite-code-display').textContent;
    if (!code || code === '---') return;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('copy-invite-btn');
      if (!btn) return;
      const original = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
      if (window.lucide && lucide.createIcons) lucide.createIcons();
      setTimeout(() => { btn.innerHTML = original; if (window.lucide && lucide.createIcons) lucide.createIcons(); }, 1500);
    });
  }

  // ============================================================
  // 图片上传
  // ============================================================
  handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.tempImageFileName = file.name;
    this._updateRecordImageName();
    const reader = new FileReader();
    reader.onload = (event) => {
      this.tempImageData = event.target.result;
      const preview = document.getElementById('image-preview');
      const previewImg = document.getElementById('preview-img');
      previewImg.src = this.tempImageData;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.tempImageData = null;
    this.tempImageFileName = null;
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');
    preview.classList.add('hidden');
    previewImg.src = '';
    imageInput.value = '';
    this._updateRecordImageName();
  }

  /**
   * 维护「record-image-name」文本：
   * - 选了本地文件：显示 file.name（用户最关心的）
   * - 编辑模式（云端/IndexedDB 已有图，但拿不到原 file.name）：显示「已选择图片/Image selected」占位
   * - 都没图：显示「未选择任何文件/No file chosen」占位
   * - 切语言时由 _refreshAppOnLangChange 之后再次调用，按当前语言重渲
   */
  _updateRecordImageName() {
    const span = document.getElementById('record-image-name');
    if (!span) return;
    if (this.tempImageFileName) {
      span.textContent = this.tempImageFileName;
    } else if (this.tempImageData) {
      span.textContent = this._i18n('app.modal.fileSelected', '已选择图片');
    } else {
      span.textContent = this._i18n('app.modal.noFile', '未选择任何文件');
    }
  }

  // ============================================================
  // 记录模态框
  // ============================================================
  openModal(record = null) {
    this.editingRecord = record;
    this.tempImageData = null;
    this.tempImageFileName = null;  // 每次开 modal 都重置：旧文件选择不再有效
    const modal = document.getElementById('record-modal');
    const modalTitle = document.getElementById('modal-title');
    const dateInput = document.getElementById('record-date');
    const timeInput = document.getElementById('record-time');
    const titleInput = document.getElementById('record-title');
    const contentInput = document.getElementById('record-content');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');

    if (record) {
      modalTitle.textContent = this._i18n('app.modal.editTitle', '编辑记录');
      dateInput.value = record.date;
      timeInput.value = record.time || '';
      titleInput.value = record.title;
      contentInput.value = record.content || '';
      this.setImportance(record.importance || 'medium');

      if (record.image || record.image_url) {
        this.tempImageData = record.image || record.image_url;
        previewImg.src = this.tempImageData;
        imagePreview.classList.remove('hidden');
      } else {
        imagePreview.classList.add('hidden');
        previewImg.src = '';
      }
    } else {
      modalTitle.textContent = this._i18n('app.modal.addTitle', '添加记录');
      dateInput.value = this.formatDate(new Date());
      timeInput.value = this.formatTime(new Date());
      titleInput.value = '';
      contentInput.value = '';
      this.setImportance('medium');
      imagePreview.classList.add('hidden');
      previewImg.src = '';
      this.tempImageData = null;
    }

    imageInput.value = '';
    this._updateRecordImageName();  // 把文件名校为「未选择」/「已选择图片」/file.name
    modal.classList.add('active');
    setTimeout(() => titleInput.focus(), 50);
  }

  closeModal() {
    this.editingRecord = null;
    this.tempImageData = null;
    this.tempImageFileName = null;
    const modal = document.getElementById('record-modal');
    modal.classList.remove('active');
  }

  async saveRecord() {
    const dateInput = document.getElementById('record-date');
    const timeInput = document.getElementById('record-time');
    const titleInput = document.getElementById('record-title');
    const contentInput = document.getElementById('record-content');
    // Round 5：三重 fallback 选择器（data-selected → 语义色 class → 第一个按钮）
    const activeImportanceBtn = document.querySelector('#importance-selector [data-importance][data-selected="true"]') ||
                                 document.querySelector('#importance-selector [data-importance].bg-danger, #importance-selector [data-importance].bg-accent, #importance-selector [data-importance].bg-secondary') ||
                                 document.querySelector('#importance-selector [data-importance]');

    const date = dateInput.value;
    const time = timeInput.value;
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const importance = activeImportanceBtn ? activeImportanceBtn.dataset.importance : 'medium';
    let imageUrl = this.tempImageData;

    if (!title) { alert(this._i18n('app.modal.titleReq', '请输入标题')); return; }
    if (!date)  { alert(this._i18n('app.modal.dateReq', '请选择日期')); return; }

    // Round 5：图片上传到 Supabase Storage（避免 base64 超过列长度导致丢失）
    if (imageUrl && imageUrl.startsWith('data:')) {
      try {
        const file = this._dataURLtoFile(imageUrl, 'image.png');
        if (file) {
          imageUrl = await cloudDBManager.uploadImage(file, this.currentTimelineId);
          console.log('[VEX-Timeline] 图片已上传:', imageUrl);
        }
      } catch (e) {
        console.warn('[VEX-Timeline] 图片上传失败，保存原 base64（云端可能丢失）:', e);
        // 降级：继续保存 base64，IndexedDB 还在，云端可能没图
      }
    }

    const recordData = { date, time, title, content, importance, image: imageUrl, timeline_id: this.currentTimelineId };

    if (this.editingRecord) {
      await dbManager.updateRecord(this.editingRecord.id, recordData);
      if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId) {
        if (this.isOnline) {
          try {
            const cloudId = this.editingRecord.cloud_id;
            if (cloudId) {
              await cloudDBManager.updateRecord(cloudId, { date, time, title, content, importance, image_url: imageUrl });
            }
          } catch (e) {
            await dbManager.addToSyncQueue('update', { ...recordData, cloud_id: this.editingRecord.cloud_id });
          }
        } else {
          await dbManager.addToSyncQueue('update', { ...recordData, cloud_id: this.editingRecord.cloud_id });
        }
      }
    } else {
      const localId = await dbManager.addRecord(recordData);
      if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId) {
        if (this.isOnline) {
          try {
            const cloudRecord = await cloudDBManager.addRecord(this.currentTimelineId, { date, time, title, content, importance, image_url: imageUrl });
            await dbManager.updateRecord(localId, { cloud_id: cloudRecord.id });
          } catch (e) {
            await dbManager.addToSyncQueue('add', recordData);
          }
        } else {
          await dbManager.addToSyncQueue('add', recordData);
        }
      }
    }

    this.closeModal();
    await this.renderView();
  }

  async deleteRecord(id) {
    if (!confirm(this._i18n('app.modal.confirmDelete', '确定要删除这条记录吗？'))) return;
    const record = this.records.find(r => r.id === id);
    await dbManager.deleteRecord(id);
    if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId && record) {
      // Round 5：删除记录时同步清理 Storage 图片（避免孤儿文件）
      const imageSrc = record.image_url || record.image;
      if (imageSrc && imageSrc.startsWith('http')) {
        try { await cloudDBManager.deleteImage(imageSrc); } catch (e) { /* ignore */ }
      }
      if (this.isOnline) {
        try {
          if (record.cloud_id) await cloudDBManager.deleteRecord(record.cloud_id);
        } catch (e) {
          await dbManager.addToSyncQueue('delete', { cloud_id: record.cloud_id, timeline_id: record.timeline_id });
        }
      } else {
        await dbManager.addToSyncQueue('delete', { cloud_id: record.cloud_id, timeline_id: record.timeline_id });
      }
    }
    await this.renderView();
  }

  // ============================================================
  // 日期/时间 格式化
  // ============================================================
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 渲染顶部「年 + 月」标签：完全走 i18n 格式串，避开了硬编码的「年/月」
   * - zh-CN: "{y}年 {m}"  →  "2026年 6月"
   * - en:    "{m} {y}"    →  "Jun 2026"
   */
  formatDateLabel(date) {
    const month = this._i18n(`app.month.${date.getMonth() + 1}`, `${date.getMonth() + 1}月`);
    const year = String(date.getFullYear());
    const format = this._i18n('app.dateFormat.short', '{y}年 {m}');
    return format.replace('{y}', year).replace('{m}', month);
  }

  /**
   * 渲染每条记录上方的大日期头：完全走 i18n 格式串
   * - zh-CN: "{y}年{m}月{d}日 {wd}"  →  "2026年06月11日 周四"
   * - en:    "{wd}, {m} {d}, {y}"   →  "Thursday, Jun 11, 2026"
   */
  formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
    const monthName = this._i18n(`app.month.${date.getMonth() + 1}`, `${date.getMonth() + 1}月`);
    const weekday = this._i18n(`app.day.full.${dayKey}`, '周日');
    const format = this._i18n('app.dateFormat', '{y}年{m}月{d}日 {wd}');
    return format
      .replace('{y}', year)
      .replace('{m}', monthName)
      .replace('{d}', parseInt(day, 10))   // 去掉前导 0（"01" → 1）
      .replace('{wd}', weekday);
  }

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // ============================================================
  // 渲染
  // ============================================================
  renderDate() {
    const dateLabel = document.getElementById('date-label');
    if (dateLabel) dateLabel.textContent = this.formatDateLabel(this.currentDate);
  }

  async renderView() {
    const timelineContainer = document.getElementById('timeline-container');
    const calendarContainer = document.getElementById('calendar-container');
    if (!timelineContainer || !calendarContainer) return;

    this.syncViewToggleState();
    this._refreshAddButtonByRole();

    // Round 4：未登录或未选择时间轴时不渲染内容（防止本地/云端错乱）
    if (!authManager.isLoggedIn() || !this.currentTimelineId) {
      timelineContainer.classList.add('hidden');
      calendarContainer.classList.add('hidden');
      return;
    }

    if (this.currentView === 'month') {
      timelineContainer.classList.add('hidden');
      calendarContainer.classList.remove('hidden');
      await this.renderCalendar();
    } else {
      timelineContainer.classList.remove('hidden');
      calendarContainer.classList.add('hidden');
      await this.renderTimeline();
    }
  }

  async renderCalendar() {
    const calendar = document.getElementById('calendar');
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Round 4：取消本地时间轴，统一走云端路径
    if (!this.currentTimelineId) {
      calendar.innerHTML = `<div class="vx-empty" style="grid-column: 1 / -1;">${this._i18n('app.empty.timeline', '请先选择时间轴')}</div>`;
      return;
    }

    const allRecords = await this.getRecordsForCurrentTimeline();
    const dates = new Set();
    allRecords.forEach(r => {
      const [rYear, rMonth] = r.date.split('-');
      if (parseInt(rYear) === year && parseInt(rMonth) === month + 1) dates.add(r.date);
    });
    const datesWithRecords = Array.from(dates).sort();
    const datesSet = new Set(datesWithRecords);

    // 同时获取 records 用来判断高/中 importance
    const highDatesSet = new Set(
      allRecords.filter(r => r.importance === 'high').map(r => r.date)
    );
    const mediumDatesSet = new Set(
      allRecords.filter(r => r.importance === 'medium').map(r => r.date)
    );

    // Round 4：按 date 聚合 importances（用于每记录一个点）
    const recordsByDate = {};
    allRecords.forEach(r => {
      if (parseInt(r.date.split('-')[0]) === year && parseInt(r.date.split('-')[1]) === month + 1) {
        (recordsByDate[r.date] = recordsByDate[r.date] || []).push(r.importance || 'medium');
      }
    });

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = this.formatDate(new Date());

    const days = [
      this._i18n('app.day.sun', '日'),
      this._i18n('app.day.mon', '一'),
      this._i18n('app.day.tue', '二'),
      this._i18n('app.day.wed', '三'),
      this._i18n('app.day.thu', '四'),
      this._i18n('app.day.fri', '五'),
      this._i18n('app.day.sat', '六')
    ];
    let headerHTML = days.map(d =>
      `<div class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-fg/60 bg-muted border-b-2 border-border">${d}</div>`
    ).join('');

    let cellsHTML = '';
    // 先计算 remainingCells（需在循环前确定），再据此算出最后一行起始索引
    const firstRowTotal = firstDayOfWeek + lastDateOfMonth;
    const remainingCells = (7 - (firstRowTotal % 7)) % 7;
    const totalCells = firstDayOfWeek + lastDateOfMonth + remainingCells;
    // 最后一行起始索引 = 总数 - 7（最后 7 个 cell 永远是最后一行）
    const lastRowStart = totalCells - 7;
    let cellIdx = 0;
    const rowClass = () => (cellIdx >= lastRowStart ? ' vx-calendar-row-last' : '');

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = lastDateOfPrevMonth - i;
      cellsHTML += `<div class="vx-calendar-cell other-month${rowClass()}"><span class="vx-calendar-day-number">${day}</span></div>`;
      cellIdx++;
    }
    for (let day = 1; day <= lastDateOfMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasRecords = datesSet.has(dateStr);
      const hasHigh = highDatesSet.has(dateStr);
      const hasMedium = mediumDatesSet.has(dateStr);
      const isToday = dateStr === todayStr;
      const dow = new Date(year, month, day).getDay();
      const isWeekend = dow === 0 || dow === 6;

      const classes = ['vx-calendar-cell'];
      if (hasHigh) classes.push('has-high');
      // 仅当不是 high 时才标 has-medium（high 优先）
      else if (hasMedium) classes.push('has-medium');
      if (isToday) classes.push('today');
      if (isWeekend) classes.push('weekend');
      // 最后一行追加 vx-calendar-row-last（用于 CSS 移除 border-bottom）
      if (cellIdx >= lastRowStart) classes.push('vx-calendar-row-last');

      // Round 4：每条记录一个点，按 importance 着色（最多 5 个 + "+N" 溢出）
      const dateImportances = recordsByDate[dateStr] || [];
      const dotsHTML = dateImportances.length > 0
        ? `<div class="vx-calendar-dots">${dateImportances.slice(0, 5).map(imp =>
            `<span class="vx-calendar-dot ${imp}"></span>`
          ).join('')}${dateImportances.length > 5 ? `<span class="text-[8px] font-semibold text-fg/60 ml-0.5">+${dateImportances.length - 5}</span>` : ''}</div>`
        : '';

      cellsHTML += `
        <div class="${classes.join(' ')}" data-date="${dateStr}">
          <span class="vx-calendar-day-number">${day}</span>
          ${dotsHTML}
        </div>
      `;
      cellIdx++;
    }
    for (let day = 1; day <= remainingCells; day++) {
      cellsHTML += `<div class="vx-calendar-cell other-month${rowClass()}"><span class="vx-calendar-day-number">${day}</span></div>`;
      cellIdx++;
    }

    calendar.innerHTML = headerHTML + cellsHTML;

    document.querySelectorAll('.vx-calendar-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        this.showDayRecords(e.currentTarget.dataset.date);
      });
    });
  }

  async getRecordsForCurrentTimeline() {
    if (!this.currentTimelineId) return [];
    return await dbManager.getRecordsByTimeline(this.currentTimelineId);
  }

  async showDayRecords(dateStr) {
    const overlay = document.getElementById('day-records-overlay');
    const title = document.getElementById('day-records-title');
    const content = document.getElementById('day-records-content');
    title.textContent = this.formatDateDisplay(dateStr);

    const allRecords = await this.getRecordsForCurrentTimeline();
    const dayRecords = allRecords.filter(r => r.date === dateStr);

    if (dayRecords.length === 0) {
      content.innerHTML = `<div class="vx-empty">${this._i18n('app.empty.records', '暂无记录')}</div>`;
    } else {
      dayRecords.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
      let html = '';
      dayRecords.forEach(record => {
        const time = record.time || '';
        const importance = record.importance || 'medium';
        const imgSrc = record.image || record.image_url || '';
        // 语义化颜色（红/黄/绿）
        const importanceColors = {
          high:   'bg-danger',       // 红
          medium: 'bg-accent',       // 黄
          low:    'bg-secondary'     // 绿
        };
        const importanceBg = {
          high:   'bg-[var(--color-tl-high-bg)]',
          medium: 'bg-canvas',
          low:    'bg-[var(--color-tl-low-bg)]'
        };
        html += `
          <div class="vx-day-record vx-timeline-item p-6 ${importanceBg[importance]}" data-importance="${importance}">
            <div class="flex items-center gap-3 mb-3">
              <span class="h-3 w-3 rounded-full ${importanceColors[importance]}"></span>
              <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">${time}</span>
            </div>
            <div class="font-semibold text-lg mb-2">${this._escapeHtml(record.title)}</div>
            ${record.content ? `<div class="text-fg/60 text-sm mb-3">${this._escapeHtml(record.content)}</div>` : ''}
            ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-64 object-cover rounded-md border-2 border-border" alt="记录图片">` : ''}
          </div>
        `;
      });
      content.innerHTML = html;
    }
    overlay.classList.add('active');
  }

  closeDayRecords() {
    const overlay = document.getElementById('day-records-overlay');
    overlay.classList.remove('active');
  }

  showLoadingState() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = `<div class="vx-empty">${this._i18n('app.empty.loading', '加载中…')}</div>`;
  }

  async renderTimeline() {
    const timeline = document.getElementById('timeline');
    this.showLoadingState();
    await new Promise(resolve => setTimeout(resolve, 100));

    this.records = await this.getRecordsForCurrentTimeline();
    let filteredRecords = this.records;
    if (this.currentFilter !== 'all') {
      filteredRecords = this.records.filter(r => r.importance === this.currentFilter);
    }

    if (filteredRecords.length === 0) {
      timeline.innerHTML = `<div class="vx-empty">${this._i18n('app.empty.records', '暂无记录')}</div>`;
      return;
    }

    // 语义化颜色（红/黄/绿）—— 高=红 / 中=黄 / 低=绿
    const importanceBadgeColors = {
      high:   'bg-danger text-canvas',       // 红 #EF4444
      medium: 'bg-accent text-canvas',       // 黄 #F59E0B
      low:    'bg-secondary text-canvas'     // 绿 #10B981
    };
    const importanceIcons = {
      high:   'alert-circle',
      medium: 'circle-dot',
      low:    'check-circle'
    };
    const importanceLabel = {
      high:   this._i18n('app.importance.high', '高'),
      medium: this._i18n('app.importance.medium', '中'),
      low:    this._i18n('app.importance.low', '低')
    };

    // Round 5：按 date desc, time desc 排序
    const sortedRecords = [...filteredRecords].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.time || '00:00').localeCompare(a.time || '00:00');
    });

    // Round 6：按日期分组（每个 day 一个 .vx-day-section，含大日期 header）
    // 但仍用单一 .vx-timeline-rail 容器包裹（保留跨天连贯竖线）
    const groups = {};
    sortedRecords.forEach(r => {
      (groups[r.date] = groups[r.date] || []).push(r);
    });
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    let html = `<div class="vx-timeline-rail">`;

    sortedDates.forEach(dateStr => {
      const dayRecords = groups[dateStr].sort((a, b) =>
        (b.time || '00:00').localeCompare(a.time || '00:00')
      );
      const dayLabel = this.formatDateDisplay(dateStr);

      // Round 6：大日期 header（外部、上方，不加黑色横条）
      html += `<section class="vx-day-section">`;
      html += `<h3 class="vx-day-header">${this._escapeHtml(dayLabel)}</h3>`;

      dayRecords.forEach(record => {
        const time = record.time || '—';
        const importance = record.importance || 'medium';
        const imgSrc = record.image || record.image_url || '';
        const canEdit = this.canEditRecord(record);
        // 用 String() 强制转换为字符串以兼容 UUID 和数字 id
        const recordIdStr = String(record.id);

        // Round 6：卡片内部只显示时间；重要性 inline 在标题前
        // Round 10：内联 style 强制 padding/border 紧凑，绕过任何 CSS 优先级问题
        html += `
          <div class="vx-timeline-item" data-importance="${importance}" style="padding:8px 12px 8px 12px !important;border:2px solid var(--color-border) !important;border-radius:6px !important;box-sizing:border-box;">
            <div class="vx-rail-dot">
              <i data-lucide="${importanceIcons[importance]}"></i>
            </div>
            ${canEdit ? `
              <div class="vx-timeline-actions">
                <button class="vx-action-btn h-7 w-7 bg-muted text-fg rounded-md flex items-center justify-center hover:bg-primary hover:text-canvas transition-all duration-200 vx-edit-btn" data-id="${recordIdStr}" title="编辑">
                  <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button class="vx-action-btn h-7 w-7 bg-muted text-fg rounded-md flex items-center justify-center hover:bg-danger hover:text-canvas transition-all duration-200 vx-delete-btn" data-id="${recordIdStr}" title="删除">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            ` : ''}
            <div class="vx-item-time" style="display:block !important;font-size:10px !important;line-height:1 !important;margin:0 0 4px 0 !important;padding:0 !important;font-weight:600 !important;text-transform:uppercase !important;letter-spacing:0.05em !important;">${this._escapeHtml(time)}</div>
            <div class="vx-item-title-row">
              <span class="inline-flex items-center justify-center text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
              <h4 class="vx-item-title">${this._escapeHtml(record.title)}</h4>
            </div>
            ${record.content ? `<div class="vx-item-content">${this._escapeHtml(record.content)}</div>` : ''}
            ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-72 object-cover rounded-md border-2 border-border" alt="记录图片">` : ''}
          </div>
        `;
      });

      html += `</section>`;
    });

    html += `</div>`;
    timeline.innerHTML = html;
    if (window.lucide && lucide.createIcons) lucide.createIcons();

    // 修复 parseInt 致命 bug：UUID 字符串 parseInt → NaN，导致 dbManager.deleteRecord(NaN) 报错
    // 改用 String(r.id) === dataset.id 字符串比较，兼容 UUID 和数字 id
    document.querySelectorAll('.vx-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const record = this.records.find(r => String(r.id) === id);
        if (record) this.openModal(record);
        else console.warn('[VEX-Timeline] Edit: record not found for id', id);
      });
    });
    document.querySelectorAll('.vx-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.deleteRecord(id);
      });
    });
  }

  // ============================================================
  // 工具
  // ============================================================
  _escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

const app = new App();
