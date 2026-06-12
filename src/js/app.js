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

  showAuthPage() {
    this._hideAppLoading();
    document.getElementById('auth-page').classList.remove('hidden');
    const container = document.querySelector('.container');
    if (container) container.classList.add('hidden');
  }

  hideAuthPage() {
    document.getElementById('auth-page').classList.add('hidden');
    const container = document.querySelector('.container');
    if (container) container.classList.remove('hidden');
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
    if (this._appLoadingHideTimer) clearTimeout(this._appLoadingHideTimer);
    this._appLoadingHideTimer = setTimeout(() => {
      el.style.display = 'none';
      this._appLoadingHideTimer = null;
    }, 220);
  }

  /**
   * 显示全屏加载遮罩（#app-loading），可自定义 label 文本。
   * 与 _hideAppLoading 配对，用于手动登录/注册按钮点击时的等待提示。
   * 注意：会取消正在进行的 _hideAppLoading 淡出 timer，避免显示-隐藏-显示闪烁。
   */
  _showAppLoading(label) {
    const el = document.getElementById('app-loading');
    if (!el) return;
    if (this._appLoadingHideTimer) {
      clearTimeout(this._appLoadingHideTimer);
      this._appLoadingHideTimer = null;
    }
    if (label) {
      const labelEl = el.querySelector('.vx-app-loading-label');
      if (labelEl) labelEl.textContent = label;
    }
    el.style.display = 'flex';
    // 双保险：强制 reflow 确保 transition 从 0 opacity 走到 1
    void el.offsetWidth;
    el.classList.remove('is-hiding');
  }

  // ============================================================
  // 登录成功/失败
  // ============================================================
  async onLoginSuccess() {
    this.hideAuthPage();
    // 保留 #user-info 上的 `hidden lg:flex` 类。`lg:flex` 会在 ≥lg 视口下自动覆盖 `hidden`，
    // 因此在 mobile (<lg) 上始终隐藏，在 desktop (≥lg) 上正常显示，无需 JS 干预。
    const username = authManager.getUsername() || 'User';
    document.getElementById('user-name').textContent = username;
    document.getElementById('user-menu-name').textContent = username;
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.textContent = username.charAt(0).toUpperCase();

    // 重置状态
    this._clearCloudError();

    // 第一步：拉取所有 timeline 列表
    const loadResult = await this.loadTimelines();

    if (!loadResult.success) {
      // 拉取失败 → 显示错误条 + 隐藏 add 按钮
      this.cloudSyncStatus = 'error';
      this.cloudErrorMessage = loadResult.error || '无法连接到云端';
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
        this._setCloudError('同步云端记录失败: ' + (e.message || e));
        // sync 失败不影响渲染本地已有数据
      }
    }

    this.renderDate();
    await this.renderView();

    // 冷启动遮罩收尾：等首屏渲染完再关，让用户感觉不到遮罩和内容之间的切换
    this._hideAppLoading();
  }

  // ============================================================
  // 云端错误条（顶部红条 + 重试按钮）
  // ============================================================
  _setCloudError(msg) {
    const bar = document.getElementById('cloud-error-bar');
    const msgEl = document.getElementById('cloud-error-message');
    if (!bar) return;
    if (msgEl) msgEl.textContent = msg || '未知错误';
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
      fab.title = enabled ? '添加记录' : '云端连接失败，无法添加记录';
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

    if (this.timelines.length > 0 && (!this.currentTimelineId || !this.timelines.find(t => t.id === this.currentTimelineId))) {
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

    // Round 4：取消本地时间轴概念，只渲染云端时间轴
    const items = this.timelines.map(t => ({ id: t.id, label: t.name, type: t.type }));

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
        this.closeAllMenus();
        await this.renderView();         // 先用本地缓存快速渲染
        this.syncFromCloud();             // Round 5：后台拉取云端最新数据
      });
    });

    this.updateTimelineLabel(this._findTimelineName(this.currentTimelineId));
    this.updateManageButton();

    const isLoggedIn = authManager.isLoggedIn();
    const desktop = document.getElementById('timeline-selector');
    if (desktop) desktop.classList.toggle('hidden', !isLoggedIn);
  }

  _findTimelineName(id) {
    if (!id) return '未选择';
    const t = this.timelines.find(x => x.id === id);
    return t ? t.name : '未选择';
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

    // 用户友好的提示（不再使用红色 banner）
    const banner = document.getElementById('diag-banner');
    if (banner) {
      if (!cloudOk) {
        banner.classList.remove('hidden');
        banner.textContent = '云端服务暂不可用，请稍后再试或联系管理员。';
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

    // 登录/注册（Round 4：取消离线按钮）
    document.getElementById('auth-login-btn').addEventListener('click', () => this.handleLogin());
    document.getElementById('auth-register-btn').addEventListener('click', () => this.handleRegister());
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

    // Round 5：云状态指示器 → 刷新按钮
    const cloudStatusBtn = document.getElementById('cloud-status');
    if (cloudStatusBtn) {
      cloudStatusBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!authManager.isLoggedIn() || !this.currentTimelineId) {
          this.showToast('请先登录并选择时间轴', 'warning');
          return;
        }
        if (this.syncInProgress) {
          this.showToast('正在同步中，请稍候', 'info');
          return;
        }
        this.showToast('正在从云端刷新…', 'info');
        try {
          await this.syncFromCloud();
          this.showToast('云端数据已同步', 'success');
        } catch (err) {
          this.showToast('刷新失败: ' + (err.message || err), 'error');
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
          this.showToast('请先登录并选择时间轴', 'warning');
          return;
        }
        if (this.syncInProgress) {
          this.showToast('正在同步中，请稍候', 'info');
          return;
        }
        this.showToast('正在从云端刷新…', 'info');
        try {
          await this.syncFromCloud();
          this.showToast('云端数据已同步', 'success');
        } catch (err) {
          this.showToast('刷新失败: ' + (err.message || err), 'error');
        }
      });
    }

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

    // 云端重试按钮
    const retryBtn = document.getElementById('cloud-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        this._clearCloudError();
        this._setCloudError('正在重试…');
        try {
          await this.onLoginSuccess();
        } catch (e) {
          this._setCloudError('重试失败: ' + (e.message || e));
        }
      });
    }
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

    const btn = document.getElementById('auth-login-btn');
    await this._withAuthLoading('登录中…', async () => {
      try {
        await authManager.login(username, password);
        await this.onLoginSuccess();
        this.renderDiagnosticBar();
      } catch (e) {
        errorEl.textContent = e.message || e;
      }
    });
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

    const btn = document.getElementById('auth-register-btn');
    await this._withAuthLoading('注册中…', async () => {
      try {
        await authManager.register(username, password);
        await this.onLoginSuccess();
        this.renderDiagnosticBar();
      } catch (e) {
        errorEl.textContent = e.message || e;
      }
    });
  }

  /**
   * 包装登录/注册按钮的 loading 态（v2：全屏遮罩版）：
   * 用户反馈"按钮上 spinner 不够明显"，所以改为显示 #app-loading 全屏遮罩。
   * 1. 调用 _showAppLoading 显示全屏 spinner + label
   * 2. 禁用所有 auth 按钮（避免重复点击）
   * 3. 无论成功失败都 finally 还原（保证异常路径下 UI 不卡死）
   * 用箭头函数保留 this。
   */
  async _withAuthLoading(label, fn) {
    const loginBtn = document.getElementById('auth-login-btn');
    const registerBtn = document.getElementById('auth-register-btn');
    if (loginBtn && loginBtn.disabled) return;          // 防止双击
    if (registerBtn && registerBtn.disabled) return;
    if (loginBtn) loginBtn.disabled = true;
    if (registerBtn) registerBtn.disabled = true;
    this._showAppLoading(label);
    try {
      await fn();
    } finally {
      this._hideAppLoading();
      if (loginBtn) loginBtn.disabled = false;
      if (registerBtn) registerBtn.disabled = false;
    }
  }

  async handleLogout() {
    // Round 5：停止自动刷新（避免内存泄漏 + 登出后继续拉取）
    this._stopAutoRefresh();
    await authManager.logout();
    this.currentTimelineId = null;
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
    if (!current || current.type !== 'team') {
      // 不再静默 return —— 给用户明确反馈
      this.showToast('请先在时间轴下拉中选择一个赛队', 'warning');
      return;
    }

    document.getElementById('invite-code-display').textContent = current.invite_code || '---';

    const membersList = document.getElementById('members-list');
    membersList.innerHTML = '<div class="px-4 py-3 text-sm text-fg/60">加载中…</div>';

    try {
      const members = await cloudDBManager.getTimelineMembers(this.currentTimelineId);
      const isOwner = current.owner_id === authManager.getCurrentUser()?.id;

      if (!members || members.length === 0) {
        membersList.innerHTML = '<div class="px-4 py-3 text-sm text-fg/60">暂无成员</div>';
      } else {
        // 拥有者置顶，其余按 username 升序保持稳定
        const sortedMembers = [...members].sort((a, b) => {
          if (a.role === 'owner' && b.role !== 'owner') return -1;
          if (a.role !== 'owner' && b.role === 'owner') return 1;
          return (a.users?.username || '').localeCompare(b.users?.username || '');
        });
        membersList.innerHTML = sortedMembers.map(member => `
          <div class="flex justify-between items-center px-4 py-3 border-b-2 border-border last:border-b-0">
            <div class="flex flex-col gap-0.5">
              <span class="font-semibold text-sm">${this._escapeHtml(member.users?.username || '未知')}</span>
              <span class="text-xs font-semibold uppercase tracking-wider text-fg/60">${member.role === 'owner' ? '所有者' : '成员'}</span>
            </div>
            ${isOwner && member.role !== 'owner' ? `
              <button class="vx-member-remove-btn h-8 px-3 bg-canvas border-2 border-border rounded-md text-xs font-semibold uppercase tracking-wider text-fg hover:border-danger hover:text-danger transition-all duration-200" data-user-id="${member.user_id}">移除</button>
            ` : ''}
          </div>
        `).join('');
      }

      if (window.lucide && lucide.createIcons) lucide.createIcons();

      membersList.querySelectorAll('.vx-member-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const userId = e.currentTarget.dataset.userId;
          try {
            await cloudDBManager.removeMember(this.currentTimelineId, userId);
            e.currentTarget.closest('.flex').remove();
            this.showToast('已移除成员', 'success');
          } catch (err) {
            console.error(err);
            this.showToast('移除失败: ' + (err.message || err), 'error');
          }
        });
      });
    } catch (e) {
      console.error('[VEX-Timeline] getTimelineMembers failed:', e);
      membersList.innerHTML = `<div class="px-4 py-3 text-sm text-danger">加载失败: ${this._escapeHtml(e.message || String(e))}</div>`;
      this.showToast('加载成员失败: ' + (e.message || e), 'error');
    }

    this.openModalById('invite-modal');
  }

  // ============================================================
  // Toast 提示（替代 alert / 静默 return）
  // ============================================================
  showToast(message, type = 'info') {
    const t = document.getElementById('vx-toast');
    if (!t) return;
    const colors = {
      info:    'bg-fg text-canvas',
      success: 'bg-secondary text-canvas',
      warning: 'bg-accent text-canvas',
      error:   'bg-danger text-canvas'
    };
    t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-md text-sm font-semibold z-[200] shadow-none ${colors[type] || colors.info}`;
    t.textContent = message;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
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

    if (!title) { alert('请输入标题'); return; }
    if (!date)  { alert('请选择日期'); return; }

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
    if (!confirm('确定要删除这条记录吗？')) return;
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
      calendar.innerHTML = '<div class="vx-empty" style="grid-column: 1 / -1;">请先选择时间轴</div>';
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

    const days = ['日', '一', '二', '三', '四', '五', '六'];
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
      content.innerHTML = `<div class="vx-empty">暂无记录</div>`;
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
    const importanceLabel = { high: '高', medium: '中', low: '低' };

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

  canEditRecord(record) {
    if (!this.currentTimelineId) return false;
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
