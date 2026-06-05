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
    this.cloudSyncStatus = 'unknown'; // 'ok' | 'error' | 'offline' | 'unknown'
    this.cloudErrorMessage = '';

    this.init();
  }

  _loadStoredTimelineId() {
    try {
      return localStorage.getItem('vex_current_timeline_id');
    } catch (e) {
      return null;
    }
  }

  _saveStoredTimelineId(id) {
    try {
      if (id && id !== 'local') {
        localStorage.setItem('vex_current_timeline_id', id);
      } else {
        localStorage.removeItem('vex_current_timeline_id');
      }
    } catch (e) {
      // ignore
    }
  }

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
        // Logged in (have session) but Supabase not configured - weird state, force re-login
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
    document.querySelector('.container').style.display = 'none';
  }

  hideAuthPage() {
    document.getElementById('auth-page').classList.add('hidden');
    document.querySelector('.container').style.display = '';
  }

  async onLoginSuccess() {
    this.hideAuthPage();
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('user-name').textContent = authManager.getUsername();
    document.getElementById('timeline-actions').style.display = 'flex';

    const loadResult = await this.loadTimelines();

    if (!loadResult.success) {
      // Cloud unreachable - show clear error and disable add
      this.cloudSyncStatus = 'error';
      this.cloudErrorMessage = loadResult.error || '无法连接到云端';
      this.updateCloudStatusIcon();
      const errorEl = document.getElementById('auth-error');
      if (errorEl) errorEl.textContent = '';
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
    if (loadResult.success) {
      await this.syncFromCloud();
    }
    this.renderDiagnosticBar();
  }

  _showCloudError(msg) {
    // Surface error to user in a non-intrusive way
    console.error('[VEX-Timeline] Cloud error:', msg);
  }

  _setAddEnabled(enabled) {
    const addBtn = document.getElementById('add-btn');
    if (addBtn) {
      addBtn.style.display = enabled ? 'flex' : 'none';
      addBtn.disabled = !enabled;
      addBtn.title = enabled ? '' : '云端连接失败，无法添加记录';
    }
  }

  onGuestMode() {
    this.hideAuthPage();
    this.currentTimelineId = 'local';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('timeline-actions').style.display = 'none';
    document.getElementById('timeline-selector').style.display = 'none';
    this.renderDate();
    this.renderView();
  }

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
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000));
        }
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

  updateTimelineSelector() {
    const select = document.getElementById('timeline-select');
    select.innerHTML = '<option value="local">本地时间轴</option>';

    this.timelines.forEach(timeline => {
      const option = document.createElement('option');
      option.value = timeline.id;
      const prefix = timeline.type === 'personal' ? '👤 ' : '👥 ';
      option.textContent = prefix + timeline.name;
      if (timeline.id === this.currentTimelineId) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    document.getElementById('timeline-selector').style.display =
      authManager.isLoggedIn() ? '' : 'none';

    this.updateManageButton();
  }

  updateManageButton() {
    const manageBtn = document.getElementById('manage-team-btn');
    const current = this.timelines.find(t => t.id === this.currentTimelineId);
    if (current && current.type === 'team' && current.owner_id === authManager.getCurrentUser()?.id) {
      manageBtn.style.display = 'flex';
    } else {
      manageBtn.style.display = 'none';
    }
  }

  updateCloudStatusIcon() {
    const el = document.getElementById('cloud-status');
    if (!el) return;
    let icon = '?', label = '未知';
    if (!supabaseManager.isConfigured()) {
      icon = '⚠';
      label = 'Supabase 未配置';
      el.className = 'cloud-status cloud-status-error';
    } else if (this.cloudSyncStatus === 'error') {
      icon = '⚠';
      label = '云端错误: ' + (this.cloudErrorMessage || '未知');
      el.className = 'cloud-status cloud-status-error';
    } else if (!this.isOnline) {
      icon = '⊘';
      label = '离线';
      el.className = 'cloud-status cloud-status-offline';
    } else if (this.syncInProgress) {
      icon = '↻';
      label = '同步中';
      el.className = 'cloud-status cloud-status-syncing';
    } else {
      icon = '☁';
      label = '云端已连接';
      el.className = 'cloud-status cloud-status-ok';
    }
    el.textContent = icon;
    el.title = label;
  }

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
        ? `URL: <span class="diag-ok">✓</span> <code>${status.urlPrefix || '已设置'}</code>`
        : `URL: <span class="diag-bad">✗ 未配置</span>`;
    }
    if (keyEl) {
      keyEl.innerHTML = status.hasKey
        ? `Key: <span class="diag-ok">✓</span> 已设置`
        : `Key: <span class="diag-bad">✗ 未配置</span>`;
    }
    if (sessEl) {
      sessEl.innerHTML = isLoggedIn
        ? `Session: <span class="diag-ok">✓ 已登录</span> (${username})`
        : `Session: <span class="diag-warn">⊘ 未登录</span>`;
    }
    if (userEl) {
      userEl.innerHTML = sessionOk ? `Token: <span class="diag-ok">✓</span>` : `Token: <span class="diag-bad">✗</span>`;
    }
    if (tlEl) {
      const tlName = this.timelines.find(t => t.id === this.currentTimelineId)?.name
        || (this.currentTimelineId === 'local' ? '本地' : this.currentTimelineId);
      tlEl.innerHTML = `时间轴: <code>${tlName}</code>`;
    }

    // Show banner if cloud is misconfigured
    const banner = document.getElementById('diag-banner');
    if (banner) {
      if (!cloudOk) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <strong>⚠️ 云端未配置</strong><br>
          登录后数据无法上云，刷新后会丢失登录状态。<br>
          <small>请在 Vercel Dashboard 设置 <code>SUPABASE_URL</code> 和 <code>SUPABASE_ANON_KEY</code>，然后 Redeploy。</small>
        `;
        banner.className = 'diag-banner diag-banner-error';
      } else {
        banner.style.display = 'none';
      }
    }
  }

  async syncFromCloud() {
    if (!authManager.isLoggedIn() || !supabaseManager.isConfigured() || this.currentTimelineId === 'local') {
      return;
    }
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
      } catch (e) {
        break;
      }
    }
  }

  async executeSyncOperation(item) {
    if (!supabaseManager.isConfigured()) return;

    switch (item.operation) {
      case 'add':
        await cloudDBManager.addRecord(item.data.timeline_id, item.data);
        break;
      case 'update':
        if (item.data.cloud_id) {
          await cloudDBManager.updateRecord(item.data.cloud_id, item.data);
        }
        break;
      case 'delete':
        if (item.data.cloud_id) {
          await cloudDBManager.deleteRecord(item.data.cloud_id);
        }
        break;
    }
  }

  setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateCloudStatusIcon();
      if (authManager.isLoggedIn()) {
        this.processSyncQueue();
      }
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateCloudStatusIcon();
    });
  }

  bindEvents() {
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

    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentView = e.target.dataset.view;
        this.renderDate();
        this.renderView();
      });
    });

    document.getElementById('add-btn').addEventListener('click', () => {
      this.openModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveRecord();
    });

    document.getElementById('record-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecord();
    });

    document.getElementById('record-modal').addEventListener('click', (e) => {
      if (e.target.id === 'record-modal') {
        this.closeModal();
      }
    });

    document.querySelectorAll('.importance-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.importance-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    document.getElementById('record-image').addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    document.getElementById('remove-image-btn').addEventListener('click', () => {
      this.removeImage();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.renderTimeline();
      });
    });

    document.getElementById('close-day-records').addEventListener('click', () => {
      this.closeDayRecords();
    });

    document.getElementById('day-records-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'day-records-overlay') {
        this.closeDayRecords();
      }
    });

    document.getElementById('auth-login-btn').addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('auth-register-btn').addEventListener('click', () => {
      this.handleRegister();
    });

    document.getElementById('auth-guest-btn').addEventListener('click', () => {
      this.onGuestMode();
    });

    document.getElementById('auth-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });

    document.getElementById('auth-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    document.getElementById('timeline-select').addEventListener('change', (e) => {
      this.currentTimelineId = e.target.value;
      this._saveStoredTimelineId(this.currentTimelineId);
      this.updateManageButton();
      this.renderView();
    });

    document.getElementById('create-team-btn').addEventListener('click', () => {
      document.getElementById('create-team-modal').classList.add('active');
    });

    document.getElementById('cancel-team-btn').addEventListener('click', () => {
      document.getElementById('create-team-modal').classList.remove('active');
    });

    document.getElementById('save-team-btn').addEventListener('click', () => {
      this.handleCreateTeam();
    });

    document.getElementById('join-team-btn').addEventListener('click', () => {
      document.getElementById('join-team-modal').classList.add('active');
    });

    document.getElementById('cancel-join-btn').addEventListener('click', () => {
      document.getElementById('join-team-modal').classList.remove('active');
    });

    document.getElementById('confirm-join-btn').addEventListener('click', () => {
      this.handleJoinTeam();
    });

    document.getElementById('manage-team-btn').addEventListener('click', () => {
      this.handleManageTeam();
    });

    document.getElementById('close-invite-btn').addEventListener('click', () => {
      document.getElementById('invite-modal').classList.remove('active');
    });

    document.getElementById('copy-invite-btn').addEventListener('click', () => {
      const code = document.getElementById('invite-code-display').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-invite-btn');
        btn.style.color = 'var(--color-importance-low)';
        setTimeout(() => { btn.style.color = ''; }, 1500);
      });
    });

    document.getElementById('create-team-modal').addEventListener('click', (e) => {
      if (e.target.id === 'create-team-modal') {
        document.getElementById('create-team-modal').classList.remove('active');
      }
    });

    document.getElementById('join-team-modal').addEventListener('click', (e) => {
      if (e.target.id === 'join-team-modal') {
        document.getElementById('join-team-modal').classList.remove('active');
      }
    });

    document.getElementById('invite-modal').addEventListener('click', (e) => {
      if (e.target.id === 'invite-modal') {
        document.getElementById('invite-modal').classList.remove('active');
      }
    });
  }

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

    if (!username) {
      errorEl.textContent = '请输入用户名';
      return;
    }
    if (!password) {
      errorEl.textContent = '请输入密码';
      return;
    }

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

    if (!username) {
      errorEl.textContent = '请输入用户名';
      return;
    }
    if (!password || password.length < 6) {
      errorEl.textContent = '密码长度至少6位';
      return;
    }

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
      // handle error
    }

    nameInput.value = '';
    document.getElementById('create-team-modal').classList.remove('active');
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
    document.getElementById('join-team-modal').classList.remove('active');
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
        <div class="member-item">
          <div>
            <span class="member-name">${member.users?.username || '未知'}</span>
            <span class="member-role">${member.role === 'owner' ? '所有者' : '成员'}</span>
          </div>
          ${isOwner && member.role !== 'owner' ? `
            <button class="member-remove-btn" data-user-id="${member.user_id}">移除</button>
          ` : ''}
        </div>
      `).join('');

      membersList.querySelectorAll('.member-remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const userId = e.target.dataset.userId;
          try {
            await cloudDBManager.removeMember(this.currentTimelineId, userId);
            e.target.closest('.member-item').remove();
          } catch (err) {
            // handle error
          }
        });
      });
    } catch (e) {
      // handle error
    }

    document.getElementById('invite-modal').classList.add('active');
  }

  handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      this.tempImageData = event.target.result;
      const preview = document.getElementById('image-preview');
      const previewImg = document.getElementById('preview-img');
      previewImg.src = this.tempImageData;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.tempImageData = null;
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');
    preview.style.display = 'none';
    previewImg.src = '';
    imageInput.value = '';
  }

  openModal(record = null) {
    this.editingRecord = record;
    this.tempImageData = null;
    const modal = document.getElementById('record-modal');
    const modalTitle = document.getElementById('modal-title');
    const dateInput = document.getElementById('record-date');
    const timeInput = document.getElementById('record-time');
    const titleInput = document.getElementById('record-title');
    const contentInput = document.getElementById('record-content');
    const importanceBtns = document.querySelectorAll('.importance-btn');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const imageInput = document.getElementById('record-image');

    if (record) {
      modalTitle.textContent = '编辑记录';
      dateInput.value = record.date;
      timeInput.value = record.time || '';
      titleInput.value = record.title;
      contentInput.value = record.content || '';

      importanceBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.importance === record.importance) {
          btn.classList.add('active');
        }
      });

      if (record.image || record.image_url) {
        this.tempImageData = record.image || record.image_url;
        previewImg.src = this.tempImageData;
        imagePreview.style.display = 'block';
      } else {
        imagePreview.style.display = 'none';
        previewImg.src = '';
      }
    } else {
      modalTitle.textContent = '添加记录';
      dateInput.value = this.formatDate(new Date());
      timeInput.value = this.formatTime(new Date());
      titleInput.value = '';
      contentInput.value = '';

      importanceBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.importance === 'medium') {
          btn.classList.add('active');
        }
      });

      imagePreview.style.display = 'none';
      previewImg.src = '';
      this.tempImageData = null;
    }

    imageInput.value = '';
    modal.classList.add('active');
    titleInput.focus();
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
    const activeImportanceBtn = document.querySelector('.importance-btn.active');

    const date = dateInput.value;
    const time = timeInput.value;
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const importance = activeImportanceBtn.dataset.importance;
    const image = this.tempImageData;

    if (!title) {
      alert('请输入标题');
      return;
    }

    if (!date) {
      alert('请选择日期');
      return;
    }

    const recordData = {
      date,
      time,
      title,
      content,
      importance,
      image,
      timeline_id: this.currentTimelineId
    };

    if (this.editingRecord) {
      await dbManager.updateRecord(this.editingRecord.id, recordData);

      if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId !== 'local') {
        if (this.isOnline) {
          try {
            const cloudId = this.editingRecord.cloud_id;
            if (cloudId) {
              await cloudDBManager.updateRecord(cloudId, {
                date, time, title, content, importance, image_url: image
              });
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
            const cloudRecord = await cloudDBManager.addRecord(this.currentTimelineId, {
              date, time, title, content, importance, image_url: image
            });
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
    if (!confirm('确定要删除这条记录吗？')) {
      return;
    }

    const record = this.records.find(r => r.id === id);

    await dbManager.deleteRecord(id);

    if (authManager.isLoggedIn() && supabaseManager.isConfigured() && this.currentTimelineId !== 'local' && record) {
      if (this.isOnline) {
        try {
          if (record.cloud_id) {
            await cloudDBManager.deleteRecord(record.cloud_id);
          }
        } catch (e) {
          await dbManager.addToSyncQueue('delete', { cloud_id: record.cloud_id, timeline_id: record.timeline_id });
        }
      } else {
        await dbManager.addToSyncQueue('delete', { cloud_id: record.cloud_id, timeline_id: record.timeline_id });
      }
    }

    await this.renderView();
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateLabel(date) {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    return `${year}年 ${monthName}`;
  }

  formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayName = days[date.getDay()];
    return `${year}年${month}月${day}日 ${dayName}`;
  }

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  renderDate() {
    const dateLabel = document.getElementById('date-label');
    dateLabel.textContent = this.formatDateLabel(this.currentDate);
  }

  async renderView() {
    const timelineContainer = document.getElementById('timeline-container');
    const calendarContainer = document.getElementById('calendar-container');
    const addBtn = document.getElementById('add-btn');

    if (this.currentView === 'month') {
      timelineContainer.style.display = 'none';
      calendarContainer.style.display = 'block';
      addBtn.style.display = 'flex';
      await this.renderCalendar();
    } else {
      timelineContainer.style.display = 'block';
      calendarContainer.style.display = 'none';
      addBtn.style.display = 'flex';
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
        if (parseInt(rYear) === year && parseInt(rMonth) === month + 1) {
          dates.add(r.date);
        }
      });
      datesWithRecords = Array.from(dates).sort();
    }

    const datesSet = new Set(datesWithRecords);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = lastDay.getDate();
    const lastDateOfPrevMonth = prevLastDay.getDate();

    const days = ['日', '一', '二', '三', '四', '五', '六'];

    let calendarHTML = `
      <div class="calendar-header">
        ${days.map(day => `<div class="calendar-header-cell">${day}</div>`).join('')}
      </div>
      <div class="calendar-grid">
    `;

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = lastDateOfPrevMonth - i;
      calendarHTML += `
        <div class="calendar-cell other-month">
          <span class="calendar-day-number">${day}</span>
        </div>
      `;
    }

    for (let day = 1; day <= lastDateOfMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasRecords = datesSet.has(dateStr);
      const cellClass = hasRecords ? 'calendar-cell has-records' : 'calendar-cell';

      calendarHTML += `
        <div class="${cellClass}" data-date="${dateStr}">
          <span class="calendar-day-number">${day}</span>
        </div>
      `;
    }

    const totalCells = firstDayOfWeek + lastDateOfMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      calendarHTML += `
        <div class="calendar-cell other-month">
          <span class="calendar-day-number">${day}</span>
        </div>
      `;
    }

    calendarHTML += `</div>`;
    calendar.innerHTML = calendarHTML;

    document.querySelectorAll('.calendar-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const dateStr = e.currentTarget.dataset.date;
        this.showDayRecords(dateStr);
      });
    });
  }

  async getRecordsForCurrentTimeline() {
    if (this.currentTimelineId === 'local') {
      return await dbManager.getAllRecords();
    }
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
      content.innerHTML = `
        <div class="empty-state">
          暂无记录
        </div>
      `;
    } else {
      let html = '';
      dayRecords.sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeB.localeCompare(timeA);
      });

      dayRecords.forEach(record => {
        const time = record.time || '';
        const importance = record.importance || 'medium';
        const imgSrc = record.image || record.image_url || '';

        html += `
          <div class="day-record-card">
            <div class="day-record-importance" data-importance="${importance}"></div>
            <div class="day-record-time">${time}</div>
            <div class="day-record-title">${record.title}</div>
            ${record.content ? `<div class="day-record-content">${record.content}</div>` : ''}
            ${imgSrc ? `
              <div class="day-record-image">
                <img src="${imgSrc}" alt="记录图片">
              </div>
            ` : ''}
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
    timeline.innerHTML = `
      <div class="loading-state">
        加载中...
      </div>
    `;
  }

  async renderTimeline() {
    const timeline = document.getElementById('timeline');

    this.showLoadingState();

    await new Promise(resolve => setTimeout(resolve, 150));

    this.records = await this.getRecordsForCurrentTimeline();

    let filteredRecords = this.records;
    if (this.currentFilter !== 'all') {
      filteredRecords = this.records.filter(r => r.importance === this.currentFilter);
    }

    if (filteredRecords.length === 0) {
      timeline.innerHTML = `
        <div class="empty-state">
          暂无记录
        </div>
      `;
      return;
    }

    const groupedRecords = {};
    filteredRecords.forEach(record => {
      if (!groupedRecords[record.date]) {
        groupedRecords[record.date] = [];
      }
      groupedRecords[record.date].push(record);
    });

    const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

    let timelineHTML = '';
    sortedDates.forEach(dateStr => {
      const dateRecords = groupedRecords[dateStr];
      dateRecords.sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeB.localeCompare(timeA);
      });

      timelineHTML += `
        <div class="date-group">
          <div class="date-header">
            <span class="date-title">${this.formatDateDisplay(dateStr)}</span>
            <span class="date-count">${dateRecords.length}条</span>
          </div>
          <div class="date-records">
      `;

      dateRecords.forEach(record => {
        const time = record.time || this.formatTime(new Date(record.createdAt));
        const importance = record.importance || 'medium';
        const imgSrc = record.image || record.image_url || '';
        const canEdit = this.canEditRecord(record);

        timelineHTML += `
          <div class="timeline-item" data-importance="${importance}">
            <div class="timeline-card">
              ${canEdit ? `
              <div class="timeline-card-actions">
                <button class="action-btn edit-btn" data-id="${record.id}" title="编辑">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="action-btn delete delete-btn" data-id="${record.id}" title="删除">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
              ` : ''}
              <div class="timeline-time">${time}</div>
              <div class="timeline-title">${record.title}</div>
              ${record.content ? `<div class="timeline-content">${record.content}</div>` : ''}
              ${imgSrc ? `
                <div class="timeline-image">
                  <img src="${imgSrc}" alt="记录图片">
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      timelineHTML += `
          </div>
        </div>
      `;
    });

    timeline.innerHTML = timelineHTML;

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        const record = this.records.find(r => r.id === id);
        if (record) {
          this.openModal(record);
        }
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
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
}

const app = new App();
