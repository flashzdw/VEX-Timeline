class AuthManager {
  constructor() {
    this.currentUser = null;
    this.session = null;
    this._authSubscription = null;
  }

  async init() {
    if (!supabaseManager.isConfigured()) {
      return;
    }
    const supabase = supabaseManager.getClient();
    if (!supabase) return;

    // Try to restore session from Supabase client (reads from localStorage)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        this.session = session;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await this._loadUserProfile(user.id);
        }
      } else {
        // Fallback: manually read from localStorage
        const cached = this._readSessionFromStorage();
        if (cached && cached.access_token) {
          this.session = cached;
          try {
            const { data: { user } } = await supabase.auth.getUser(cached.access_token);
            if (user) {
              await this._loadUserProfile(user.id);
            }
          } catch (e) {
            // Token invalid, clear it
            this._clearSessionFromStorage();
          }
        }
      }
    } catch (e) {
      console.warn('[VEX-Timeline] Session restore failed:', e);
      this.currentUser = null;
      this.session = null;
    }

    // Subscribe to auth state changes (token refresh, sign out from other tab, etc.)
    // 防御性：先 unsubscribe 旧的（防止 init 被多次调用造成多个订阅并存）
    this._subscribeAuthState(supabase);
  }

  _subscribeAuthState(supabase) {
    // 清理旧订阅（如果有）
    if (this._authSubscription && this._authSubscription.unsubscribe) {
      try { this._authSubscription.unsubscribe(); } catch (e) {}
      this._authSubscription = null;
    }
    if (!supabase) return;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        // 防御性日志：只在 debug 模式下输出，避免控制台噪声
        if (window.VEX_CONFIG && window.VEX_CONFIG.debug) {
          console.log(`[VEX-Timeline] Auth state changed: ${event}`);
        }
        if (event === 'SIGNED_OUT' || !session) {
          this.currentUser = null;
          this.session = null;
          this._clearSessionFromStorage();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // TOKEN_REFRESHED 频繁触发（每 1h），不重复 reload profile
          if (event === 'SIGNED_IN' || !this.currentUser) {
            this.session = session;
            if (session.user) {
              await this._loadUserProfile(session.user.id);
            }
          } else {
            this.session = session;  // 仅更新 session
          }
        }
      });
      this._authSubscription = subscription;
    } catch (e) {
      console.warn('[VEX-Timeline] Failed to subscribe to auth state changes:', e);
    }
  }

  async _loadUserProfile(userId, retries = 3) {
    const supabase = supabaseManager.getClient();
    if (!supabase) return;
    for (let i = 0; i < retries; i++) {
      try {
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        if (!error && profile) {
          this.currentUser = profile;
          return;
        }
        if (error) {
          console.warn(`[VEX-Timeline] _loadUserProfile attempt ${i+1} error:`, error.message || error);
        }
      } catch (e) {
        console.warn(`[VEX-Timeline] _loadUserProfile attempt ${i+1} threw:`, e.message || e);
      }
      // 指数退避：500ms / 1000ms / 1500ms
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
    console.error('[VEX-Timeline] _loadUserProfile all retries failed');
  }

  _readSessionFromStorage() {
    try {
      const ref = supabaseManager.getProjectRef();
      if (!ref) return null;
      const key = 'sb-' + ref + '-auth-token';
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Supabase stores either a Session object or { currentSession, expiresAt }
      return parsed.currentSession || parsed;
    } catch (e) {
      return null;
    }
  }

  _clearSessionFromStorage() {
    try {
      const ref = supabaseManager.getProjectRef();
      if (!ref) return;
      const key = 'sb-' + ref + '-auth-token';
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  }

  async register(username, password) {
    if (!supabaseManager.isConfigured()) {
      throw (window.i18n ? window.i18n.t('auth.error.notConfigured') : '云端未配置，请联系管理员');
    }
    username = username.trim();
    if (username.length < 2 || username.length > 20) {
      throw (window.i18n ? window.i18n.t('auth.error.usernameLength') : '用户名长度需在2-20个字符之间');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw (window.i18n ? window.i18n.t('auth.error.usernameFormat') : '用户名只能包含字母、数字和下划线');
    }
    if (!password || password.length < 6) {
      throw (window.i18n ? window.i18n.t('auth.error.shortPassword') : '密码长度至少6位');
    }

    const supabase = supabaseManager.getClient();
    const email = username + '@vex-timeline.local';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) {
      if (error.message?.includes('already') || error.message?.includes('registered')) {
        throw (window.i18n ? window.i18n.t('auth.error.taken') : '用户名已被占用');
      }
      throw error.message;
    }

    if (!data.session) {
      throw (window.i18n ? window.i18n.t('auth.error.emailConfirm') : '注册成功，请等待邮箱确认后再登录。你可在 Supabase 设置中关闭邮箱验证。');
    }

    this.session = data.session;
    await this._loadUserProfile(data.user.id);
    return this.currentUser;
  }

  async login(username, password) {
    if (!supabaseManager.isConfigured()) {
      throw (window.i18n ? window.i18n.t('auth.error.notConfigured') : '云端未配置，请联系管理员');
    }
    username = username.trim();
    if (!username) {
      throw (window.i18n ? window.i18n.t('auth.error.usernameRequired') : '请输入用户名');
    }
    if (!password) {
      throw (window.i18n ? window.i18n.t('auth.error.passwordRequired') : '请输入密码');
    }

    const supabase = supabaseManager.getClient();
    const email = username + '@vex-timeline.local';

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message?.includes('Invalid login')) {
        throw (window.i18n ? window.i18n.t('auth.error.invalid') : '用户名或密码错误');
      }
      if (error.status === 400 || error.message?.includes('Email not confirmed')) {
        throw (window.i18n ? window.i18n.t('auth.error.emailConfirm') : '请先在 Supabase 控制台确认邮箱（Settings → Auth → 关闭 Enable email confirmations）');
      }
      throw error.message;
    }

    this.session = data.session;
    await this._loadUserProfile(data.user.id);
    return this.currentUser;
  }

  async logout() {
    const supabase = supabaseManager.getClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }
    }
    this.currentUser = null;
    this.session = null;
    this._clearSessionFromStorage();
  }

  isLoggedIn() {
    return !!(this.currentUser || this.session);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUsername() {
    return this.currentUser?.username || null;
  }

  onAuthStateChange(callback) {
    const supabase = supabaseManager.getClient();
    if (!supabase) return null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  }
}

const authManager = new AuthManager();
