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
    this.currentTimelineId = this._loadStoredTimelineId() || 'local';
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
      if (id && id !== 'local') localStorage.setItem('vex_current_timeline_id', id);
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

    this.bindEvents();
    this.setupNetworkListener();
    this.renderDiagnosticBar();

    if (authManager.isLoggedIn()) {
      if (supabaseManager.isConfigured()) {
        await this.onLoginSuccess();
      } else {
        console.warn('[VEX-Timeline] Session exists but Supabase not configured. Clearing session.');
        await authManager.logout();
        this.showAuthPage();
      }
    } else {
      this.showAuthPage();
    }
  }

  showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    const container = document.querySelector('.container');
    if (container) container.classList.add('hidden');
  }

  hideAuthPage() {
    document.getElementById('auth-page').classList.add('hidden');
    const container = document.querySelector('.container');
    if (container) container.classList.remove('hidden');
  }

  // ============================================================
  // 登录成功/失败
  // ============================================================
  async onLoginSuccess() {
    this.hideAuthPage();
    document.getElementById('user-info').classList.remove('hidden');
    const username = authManager.getUsername() || 'User';
    document.getElementById('user-name').textContent = username;
    document.getElementById('user-menu-name').textContent = username;
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.textContent = username.charAt(0).toUpperCase();

    const loadResult = await this.loadTimelines();

    if (!loadResult.success) {
      this.cloudSyncStatus = 'error';
      this.cloudErrorMessage = loadResult.error || '无法连接到云端';
      this.updateCloudStatusIcon();
      this._showCloudError(this.cloudErrorMessage);
      this._setAddEnabled(false);
    } else {
      this.cloudSyncStatus = 'ok';
      this.cloudErrorMessage = '';
      this.updateCloudStatusIcon();
      this._setAddEnabled(true);
    }

    this.renderDate();
    await this.renderView();
    if (loadResult.success) await this.syncFromCloud();
  }

  _showCloudError(msg) {
    console.error('[VEX-Timeline] Cloud error:', msg);
  }

  _setAddEnabled(enabled) {
    const addBtn = document.getElementById('add-btn');
    if (addBtn) {
      addBtn.style.display = enabled ? 'inline-flex' : 'none';
      addBtn.disabled = !enabled;
      addBtn.title = enabled ? '' : '云端连接失败，无法添加记录';
    }
  }

  onGuestMode() {
    this.hideAuthPage();
    this.currentTimelineId = 'local';
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('timeline-selector').classList.add('hidden');
    document.querySelectorAll('[data-timeline-value]').forEach(b => b.classList.remove('active'));
    const localBtn = document.querySelector('[data-timeline-value="local"]');
    if (localBtn) localBtn.classList.add('active');
    this.updateTimelineLabel('本地时间轴');
    this.renderDate();
    this.renderView();
  }

  // ============================================================
  // 时间轴加载 & 自定义下拉
  // ============================================================
  async loadTimelines() {
    if (!authManager.isLoggedIn() || !supabaseManager.isConfigured()) {
      this.updateTimelineSelector();
      return { success: false, error: 'Supabase 未配置' };
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
      return { success: false, error: lastErr.message || String(lastErr) };
    }

    if (this.timelines.length > 0 && (this.currentTimelineId === 'local' || !this.timelines.find(t => t.id === this.currentTimelineId))) {
      const personal = this.timelines.find(t => t.type === 'personal');
      this.currentTimelineId = personal ? personal.id : this.timelines[0].id;
      this._saveStoredTimelineId(this.currentTimelineId);
    }

    this.updateTimelineSelector();
    return { success: true };
  }

  /**
   * 重新填充时间轴下拉菜单
   */
  updateTimelineSelector() {
    const menu = document.getElementById('timeline-menu');
    const mobileList = document.getElementById('mobile-timeline-list');
    if (!menu) return;

    // 桌面下拉：保留第一个 local 项，追加其他
    const items = [
      { id: 'local', label: '本地时间轴', type: 'local' }
    ];
    this.timelines.forEach(t => items.push({ id: t.id, label: t.name, type: t.type }));

    // 桌面菜单渲染
    menu.innerHTML = items.map(item => `
      <button type="button" class="vx-timeline-menu-item${item.id === this.currentTimelineId ? ' active' : ''}" data-timeline-value="${item.id}">
        <i data-lucide="${item.type === 'team' ? 'users' : (item.type === 'local' ? 'hard-drive' : 'user')}" class="w-4 h-4 text-fg/60"></i>
        <span>${this._escapeHtml(item.label)}</span>
      </button>
    `).join('');

    // 移动端列表
    if (mobileList) {
      mobileList.innerHTML = items.map(item => `
        <button type="button" class="vx-timeline-menu-item${item.id === this.currentTimelineId ? ' active' : ''}" data-timeline-value="${item.id}">
          <i data-lucide="${item.type === 'team' ? 'users' : (item.type === 'local' ? 'hard-drive' : 'user')}" class="w-4 h-4 text-fg/60"></i>
          <span>${this._escapeHtml(item.label)}</span>
        </button>
      `).join('');
    }

    // 重新渲染 lucide 图标
    if (window.lucide && lucide.createIcons) lucide.createIcons();

    // 绑定选择事件
    document.querySelectorAll('[data-timeline-value]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.timelineValue;
        this.currentTimelineId = id;
        this._saveStoredTimelineId(this.currentTimelineId);
        this.updateTimelineSelector();
        this.updateTimelineLabel(this._findTimelineName(id));
        this.updateManageButton();
        this.closeAllMenus();
        this.renderView();
      });
    });

    this.updateTimelineLabel(this._findTimelineName(this.currentTimelineId));
    this.updateManageButton();

    const isLoggedIn = authManager.isLoggedIn();
    const desktop = document.getElementById('timeline-selector');
    if (desktop) desktop.classList.toggle('hidden', !isLoggedIn);
  }

  _findTimelineName(id) {
    if (id === 'local') return '本地时间轴';
    const t = this.timelines.find(x => x.id === id);
    return t ? t.name : '本地时间轴';
  }

  updateTimelineLabel(name) {
    const label = document.getElementById('timeline-select-label');
    if (label) label.textContent = name;
  }

  updateManageButton() {
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    const isTeamOwner = current && current.type === 'team' && current.owner_id === authManager.getCurrentUser()?.id;
    const desktopBtn = document.getElementById('manage-team-btn');
    const mobileBtn = document.getElementById('mobile-manage-team-btn');
    [desktopBtn, mobileBtn].forEach(btn => {
      if (btn) btn.classList.toggle('hidden', !isTeamOwner);
    });
  }

  // ============================================================
  // 云端状态指示器
  // ============================================================
  updateCloudStatusIcon() {
    const el = document.getElementById('cloud-status');
    if (!el) return;
    let iconName = 'cloud', label = '未知', cls = '';

    if (!supabaseManager.isConfigured()) {
      iconName = 'alert-triangle'; label = 'Supabase 未配置'; cls = 'is-error';
    } else if (this.cloudSyncStatus === 'error') {
      iconName = 'alert-triangle'; label = '云端错误: ' + (this.cloudErrorMessage || '未知'); cls = 'is-error';
    } else if (!this.isOnline) {
      iconName = 'cloud-off'; label = '离线'; cls = 'is-offline';
    } else if (this.syncInProgress) {
      iconName = 'refresh-cw'; label = '同步中'; cls = 'is-syncing';
    } else {
      iconName = 'cloud'; label = '云端已连接'; cls = 'is-ok';
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
  // 诊断条
  // ============================================================
  renderDiagnosticBar() {
    const el = document.getElementById('diagnostic-bar');
    if (!el) return;
    const status = supabaseManager.getConfigStatus();
    const isLoggedIn = authManager.isLoggedIn();
    const username = authManager.getUsername() || '未登录';
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

    const banner = document.getElementById('diag-banner');
    if (banner) {
      if (!cloudOk) {
        banner.classList.remove('hidden');
        banner.className = 'mb-6 p-4 bg-red-50 border-2 border-primary rounded-md text-sm font-medium text-red-700';
        banner.innerHTML = `
          <strong>⚠️ 云端未配置</strong><br>
          登录后数据无法上云，刷新后会丢失登录状态。<br>
          <small>请在 Vercel Dashboard 设置 <code>SUPABASE_URL</code> 和 <code>SUPABASE_ANON_KEY</code>，然后 Redeploy。</small>
        `;
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  // ============================================================
  // 同步
  // ============================================================
  async syncFromCloud() {
    if (!authManager.isLoggedIn() || !supabaseManager.isConfigured() || this.currentTimelineId === 'local') return;
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
    for (const item of queue) {
      try {
        await this.executeSyncOperation(item);
        await dbManager.removeFromSyncQueue(item.id);
      } catch (e) { break; }
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

    // 顶部添加按钮
    document.getElementById('add-btn').addEventListener('click', () => this.openModal());

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

    // 登录/注册/离线
    document.getElementById('auth-login-btn').addEventListener('click', () => this.handleLogin());
    document.getElementById('auth-register-btn').addEventListener('click', () => this.handleRegister());
    document.getElementById('auth-guest-btn').addEventListener('click', () => this.onGuestMode());
    document.getElementById('auth-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });
    document.getElementById('auth-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

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
      }
    });

    // 移动端汉堡菜单
    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) mobileBtn.addEventListener('click', () => this.openMobileDrawer());
    const mobileClose = document.getElementById('mobile-drawer-close');
    if (mobileClose) mobileClose.addEventListener('click', () => this.closeMobileDrawer());

    // 点击外部关闭所有菜单
    document.addEventListener('click', (e) => {
      const inMenu = e.target.closest('#timeline-menu, #timeline-select-btn, #user-menu, #user-menu-btn, #mobile-drawer, #mobile-menu-btn');
      if (!inMenu) this.closeAllMenus();
    });

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
    document.querySelectorAll('[data-view-toggle]').forEach(btn => {
      const isActive = btn.dataset.viewToggle === this.currentView;
      if (isActive) {
        btn.className = btn.className
          .replace(/bg-(white|muted|fg) text-(fg|fg\/60|white)/g, '')
          .trim();
        btn.classList.add('bg-fg', 'text-white');
      } else {
        btn.classList.remove('bg-fg', 'text-white');
        btn.classList.add('bg-muted', 'text-fg/60');
      }
    });
  }

  syncFilterState() {
    document.querySelectorAll('#filter-bar [data-filter]').forEach(btn => {
      const isActive = btn.dataset.filter === this.currentFilter;
      if (isActive) {
        btn.classList.remove('bg-white', 'text-fg');
        btn.classList.add('bg-fg', 'text-white');
      } else {
        btn.classList.remove('bg-fg', 'text-white');
        btn.classList.add('bg-white', 'text-fg');
      }
    });
  }

  setImportance(val) {
    document.querySelectorAll('#importance-selector [data-importance]').forEach(btn => {
      if (btn.dataset.importance === val) {
        btn.classList.remove('bg-muted', 'text-fg/60');
        btn.classList.add('bg-fg', 'text-white');
      } else {
        btn.classList.remove('bg-fg', 'text-white');
        btn.classList.add('bg-muted', 'text-fg/60');
      }
    });
  }

  // ============================================================
  // 登录/注册/登出
  // ============================================================
  async handleLogin() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const errorEl = document.getElementById('auth-error');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    errorEl.textContent = '';

    if (!supabaseManager.isConfigured()) {
      errorEl.textContent = 'Supabase 未配置。请检查 Vercel 环境变量并重新部署。';
      this.renderDiagnosticBar();
      return;
    }
    if (!username) { errorEl.textContent = '请输入用户名'; return; }
    if (!password) { errorEl.textContent = '请输入密码'; return; }

    try {
      await authManager.login(username, password);
      await this.onLoginSuccess();
      this.renderDiagnosticBar();
    } catch (e) {
      errorEl.textContent = e.message || e;
    }
  }

  async handleRegister() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const errorEl = document.getElementById('auth-error');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    errorEl.textContent = '';

    if (!supabaseManager.isConfigured()) {
      errorEl.textContent = 'Supabase 未配置。请检查 Vercel 环境变量并重新部署。';
      this.renderDiagnosticBar();
      return;
    }
    if (!username) { errorEl.textContent = '请输入用户名'; return; }
    if (!password || password.length < 6) { errorEl.textContent = '密码长度至少 6 位'; return; }

    try {
      await authManager.register(username, password);
      await this.onLoginSuccess();
      this.renderDiagnosticBar();
    } catch (e) {
      errorEl.textContent = e.message || e;
    }
  }

  async handleLogout() {
    await authManager.logout();
    this.currentTimelineId = 'local';
    this._saveStoredTimelineId(null);
    this.timelines = [];
    this.showAuthPage();
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').textContent = '';
    this._setAddEnabled(true);
    this.cloudSyncStatus = 'unknown';
    this.cloudErrorMessage = '';
    this.updateCloudStatusIcon();
    this.renderDiagnosticBar();
  }

  // ============================================================
  // 赛队操作
  // ============================================================
  handleTeamAction(action) {
    if (action === 'create') this.openModalById('create-team-modal');
    else if (action === 'join') this.openModalById('join-team-modal');
    else if (action === 'manage') this.handleManageTeam();
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
        await this.renderView();
      }
    } catch (e) {
      alert(e.message || '加入失败');
    }

    codeInput.value = '';
    this.closeModalById('join-team-modal');
  }

  async handleManageTeam() {
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    if (!current || current.type !== 'team') return;

    document.getElementById('invite-code-display').textContent = current.invite_code || '---';

    try {
      const members = await cloudDBManager.getTimelineMembers(this.currentTimelineId);
      const membersList = document.getElementById('members-list');
      const isOwner = current.owner_id === authManager.getCurrentUser()?.id;

      membersList.innerHTML = members.map(member => `
        <div class="flex justify-between items-center px-4 py-3 border-b-2 border-border last:border-b-0">
          <div class="flex flex-col gap-0.5">
            <span class="font-semibold text-sm">${this._escapeHtml(member.users?.username || '未知')}</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">${member.role === 'owner' ? '所有者' : '成员'}</span>
          </div>
          ${isOwner && member.role !== 'owner' ? `
            <button class="vx-member-remove-btn h-8 px-3 bg-white border-2 border-border rounded-md text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary transition-all duration-200" data-user-id="${member.user_id}">移除</button>
          ` : ''}
        </div>
      `).join('');

      if (window.lucide && lucide.createIcons) lucide.createIcons();

      membersList.querySelectorAll('.vx-member-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const userId = e.currentTarget.dataset.userId;
          try {
            await cloudDBManager.removeMember(this.currentTimelineId, userId);
            e.currentTarget.closest('.flex').remove();
          } catch (err) { console.error(err); }
        });
      });
    } catch (e) {
      console.error(e);
    }

    this.openModalById('invite-modal');
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
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');
    preview.classList.add('hidden');
    previewImg.src = '';
    imageInput.value = '';
  }

  // ============================================================
  // 记录模态框
  // ============================================================
  openModal(record = null) {
    this.editingRecord = record;
    this.tempImageData = null;
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
      modalTitle.textContent = '编辑记录';
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
      modalTitle.textContent = '添加记录';
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
    modal.classList.add('active');
    setTimeout(() => titleInput.focus(), 50);
  }

  closeModal() {
    this.editingRecord = null;
    this.tempImageData = null;
    const modal = document.getElementById('record-modal');
    modal.classList.remove('active');
  }

  async saveRecord() {
    const dateInput = document.getElementById('record-date');
    const timeInput = document.getElementById('record-time');
    const titleInput = document.getElementById('record-title');
    const contentInput = document.getElementById('record-content');
    const activeImportanceBtn = document.querySelector('#importance-selector [data-importance].bg-fg') ||
                                 document.querySelector('#importance-selector [data-importance]');

    const date = dateInput.value;
    const time = timeInput.value;
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const importance = activeImportanceBtn ? activeImportanceBtn.dataset.importance : 'medium';
    const image = this.tempImageData;

    if (!title) { alert('请输入标题'); return; }
    if (!date)  { alert('请选择日期'); return; }

    const recordData = { date, time, title, content, importance, image, timeline_id: this.currentTimelineId };

    if (this.editingRecord) {
      await dbManager.updateRecord(this.editingRecord.id, recordData);
      if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId !== 'local') {
        if (this.isOnline) {
          try {
            const cloudId = this.editingRecord.cloud_id;
            if (cloudId) {
              await cloudDBManager.updateRecord(cloudId, { date, time, title, content, importance, image_url: image });
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
      if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId !== 'local') {
        if (this.isOnline) {
          try {
            const cloudRecord = await cloudDBManager.addRecord(this.currentTimelineId, { date, time, title, content, importance, image_url: image });
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
    if (!confirm('确定要删除这条记录吗？')) return;
    const record = this.records.find(r => r.id === id);
    await dbManager.deleteRecord(id);
    if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId !== 'local' && record) {
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

  formatDateLabel(date) {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return `${date.getFullYear()}年 ${months[date.getMonth()]}`;
  }

  formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${year}年${month}月${day}日 ${days[date.getDay()]}`;
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

    let datesWithRecords;
    if (this.currentTimelineId === 'local') {
      datesWithRecords = await dbManager.getDatesWithRecords(year, month + 1);
    } else {
      const allRecords = await this.getRecordsForCurrentTimeline();
      const dates = new Set();
      allRecords.forEach(r => {
        const [rYear, rMonth] = r.date.split('-');
        if (parseInt(rYear) === year && parseInt(rMonth) === month + 1) dates.add(r.date);
      });
      datesWithRecords = Array.from(dates).sort();
    }
    const datesSet = new Set(datesWithRecords);

    // 同时获取 records 用来判断高 importance
    const allRecords = await this.getRecordsForCurrentTimeline();
    const highDatesSet = new Set(
      allRecords.filter(r => r.importance === 'high').map(r => r.date)
    );

    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = this.formatDate(new Date());

    const days = ['日', '一', '二', '三', '四', '五', '六'];
    let headerHTML = days.map(d =>
      `<div class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-fg/60 bg-muted border-r-2 border-border last:border-r-0">${d}</div>`
    ).join('');

    let cellsHTML = '';
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = lastDateOfPrevMonth - i;
      cellsHTML += `<div class="vx-calendar-cell other-month"><span class="vx-calendar-day-number">${day}</span></div>`;
    }
    for (let day = 1; day <= lastDateOfMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasRecords = datesSet.has(dateStr);
      const hasHigh = highDatesSet.has(dateStr);
      const isToday = dateStr === todayStr;
      const dow = new Date(year, month, day).getDay();
      const isWeekend = dow === 0 || dow === 6;

      const classes = ['vx-calendar-cell'];
      if (hasRecords) classes.push('has-records');
      if (hasHigh) classes.push('has-high');
      if (isToday) classes.push('today');
      if (isWeekend) classes.push('weekend');

      cellsHTML += `
        <div class="${classes.join(' ')}" data-date="${dateStr}">
          <span class="vx-calendar-day-number">${day}</span>
        </div>
      `;
    }
    const totalCells = firstDayOfWeek + lastDateOfMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      cellsHTML += `<div class="vx-calendar-cell other-month"><span class="vx-calendar-day-number">${day}</span></div>`;
    }

    calendar.innerHTML = `<div class="grid grid-cols-7">${headerHTML}</div><div class="grid grid-cols-7">${cellsHTML}</div>`;

    document.querySelectorAll('.vx-calendar-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        this.showDayRecords(e.currentTarget.dataset.date);
      });
    });
  }

  async getRecordsForCurrentTimeline() {
    if (this.currentTimelineId === 'local') return await dbManager.getAllRecords();
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
      content.innerHTML = `<div class="vx-empty">暂无记录</div>`;
    } else {
      dayRecords.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
      let html = '';
      dayRecords.forEach(record => {
        const time = record.time || '';
        const importance = record.importance || 'medium';
        const imgSrc = record.image || record.image_url || '';
        const importanceColors = {
          high:   'bg-primary',
          medium: 'bg-accent',
          low:    'bg-secondary'
        };
        const importanceBg = {
          high:   'bg-red-50',
          medium: 'bg-white',
          low:    'bg-muted'
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
    timeline.innerHTML = `<div class="vx-empty">加载中…</div>`;
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
      timeline.innerHTML = `<div class="vx-empty">暂无记录</div>`;
      return;
    }

    const grouped = {};
    filteredRecords.forEach(r => {
      (grouped[r.date] = grouped[r.date] || []).push(r);
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    let html = '';
    sortedDates.forEach(dateStr => {
      const dateRecords = grouped[dateStr];
      dateRecords.sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));

      const importanceBadgeColors = {
        high:   'bg-primary text-white',
        medium: 'bg-accent text-white',
        low:    'bg-secondary text-white'
      };
      const importanceIcons = {
        high:   'alert-circle',
        medium: 'circle-dot',
        low:    'check-circle'
      };
      const importanceLabel = { high: '高', medium: '中', low: '低' };

      html += `
        <section class="flex flex-col gap-4">
          <div class="bg-fg text-white px-6 py-4 rounded-md flex items-center justify-between">
            <span class="font-extrabold text-2xl tracking-[-0.02em]">${this._escapeHtml(this.formatDateDisplay(dateStr))}</span>
            <span class="text-xs font-semibold uppercase tracking-wider opacity-80">${dateRecords.length} 条</span>
          </div>
          <div class="flex flex-col gap-3">
      `;

      dateRecords.forEach(record => {
        const time = record.time || '';
        const importance = record.importance || 'medium';
        const imgSrc = record.image || record.image_url || '';
        const canEdit = this.canEditRecord(record);

        html += `
          <div class="vx-timeline-item group" data-importance="${importance}">
            ${canEdit ? `
              <div class="flex gap-2 justify-end mb-3 -mt-1">
                <button class="vx-action-btn h-9 w-9 bg-white text-fg rounded-md flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-200 vx-edit-btn" data-id="${record.id}" title="编辑">
                  <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button class="vx-action-btn h-9 w-9 bg-white text-fg rounded-md flex items-center justify-center hover:bg-primary hover:text-white transition-all duration-200 vx-delete-btn" data-id="${record.id}" title="删除">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            ` : ''}
            <div class="flex items-start gap-4">
              <div class="h-14 w-14 rounded-full bg-white ${importanceBadgeColors[importance].replace('bg-', 'text-').replace(' text-white', '')} border-2 border-border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                <i data-lucide="${importanceIcons[importance]}" class="w-6 h-6"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">${this._escapeHtml(time)}</span>
                  <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${importanceBadgeColors[importance]}">${importanceLabel[importance]}</span>
                </div>
                <div class="font-semibold text-lg mb-1 text-fg">${this._escapeHtml(record.title)}</div>
                ${record.content ? `<div class="text-fg/60 text-sm mb-3">${this._escapeHtml(record.content)}</div>` : ''}
                ${imgSrc ? `<img src="${this._escapeHtml(imgSrc)}" class="max-w-full max-h-72 object-cover rounded-md border-2 border-border" alt="记录图片">` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `</div></section>`;
    });

    timeline.innerHTML = html;
    if (window.lucide && lucide.createIcons) lucide.createIcons();

    document.querySelectorAll('.vx-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        const record = this.records.find(r => r.id === id);
        if (record) this.openModal(record);
      });
    });
    document.querySelectorAll('.vx-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        this.deleteRecord(id);
      });
    });
  }

  canEditRecord(record) {
    if (this.currentTimelineId === 'local') return true;
    if (!authManager.isLoggedIn()) return true;
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    if (!current) return true;
    if (current.owner_id === authManager.getCurrentUser()?.id) return true;
    if (record.user_id === authManager.getCurrentUser()?.id) return true;
    return false;
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
