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
    this._subscribeAuthState(supabase);
  }

  _subscribeAuthState(supabase) {
    if (this._authSubscription) return;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[VEX-Timeline] Auth state changed:', event);
        if (event === 'SIGNED_OUT' || !session) {
          this.currentUser = null;
          this.session = null;
          this._clearSessionFromStorage();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          this.session = session;
          if (session.user) {
            await this._loadUserProfile(session.user.id);
          }
        }
      });
      this._authSubscription = subscription;
    } catch (e) {
      console.warn('[VEX-Timeline] Failed to subscribe to auth state changes:', e);
    }
  }

  async _loadUserProfile(userId) {
    const supabase = supabaseManager.getClient();
    if (!supabase) return;
    try {
      // Use maybeSingle() to avoid 406 when no row exists
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profile) {
        this.currentUser = profile;
        return;
      }
      // Self-heal: public.users row is missing. This can happen when a user
      // was created via Supabase Dashboard, or signed up with old code that
      // didn't pass `data: { username }` in metadata. The DB trigger should
      // normally create the row, but be defensive on the client.
      if (error) {
        console.warn('[VEX-Timeline] Failed to load user profile:', error);
        return;
      }
      await this._ensureUserProfile(userId);
    } catch (e) {
      console.warn('[VEX-Timeline] Failed to load user profile:', e);
    }
  }

  async _ensureUserProfile(userId) {
    const supabase = supabaseManager.getClient();
    if (!supabase || !this.session) return;
    const meta = this.session.user?.user_metadata || {};
    const email = this.session.user?.email || '';
    const baseUsername =
      meta.username ||
      (email ? email.split('@')[0] : null) ||
      ('user_' + userId.slice(0, 8));
    try {
      // Try a few variants in case of unique-username conflict
      let inserted = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = attempt === 0 ? baseUsername : `${baseUsername}_${attempt}`;
        const { data, error } = await supabase
          .from('users')
          .insert({ id: userId, username: candidate })
          .select()
          .maybeSingle();
        if (!error && data) {
          inserted = data;
          break;
        }
        if (error && error.code !== '23505') {
          // Not a unique conflict — abort
          console.warn('[VEX-Timeline] Could not create user profile:', error);
          break;
        }
      }
      if (inserted) {
        this.currentUser = inserted;
      }
    } catch (e) {
      console.warn('[VEX-Timeline] _ensureUserProfile failed:', e);
    }
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
      throw 'Supabase 未配置。请检查 Vercel 环境变量并重新部署。';
    }
    username = username.trim();
    if (username.length < 2 || username.length > 20) {
      throw '用户名长度需在2-20个字符之间';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw '用户名只能包含字母、数字和下划线';
    }
    if (!password || password.length < 6) {
      throw '密码长度至少6位';
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
        throw '用户名已被占用';
      }
      throw error.message;
    }

    if (!data.session) {
      throw '注册成功，请等待邮箱确认后再登录。你可在 Supabase 设置中关闭邮箱验证。';
    }

    this.session = data.session;
    await this._loadUserProfile(data.user.id);
    return this.currentUser;
  }

  async login(username, password) {
    if (!supabaseManager.isConfigured()) {
      throw 'Supabase 未配置。请检查 Vercel 环境变量并重新部署。';
    }
    username = username.trim();
    if (!username) {
      throw '请输入用户名';
    }
    if (!password) {
      throw '请输入密码';
    }

    const supabase = supabaseManager.getClient();
    const email = username + '@vex-timeline.local';

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message?.includes('Invalid login')) {
        throw '用户名或密码错误';
      }
      if (error.status === 400 || error.message?.includes('Email not confirmed')) {
        throw '请先在 Supabase 控制台确认邮箱（Settings → Auth → 关闭 Enable email confirmations）';
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

  // Always-available userId accessor. Falls back to the auth session's
  // user id even when public.users profile hasn't been loaded yet.
  getCurrentUserId() {
    return this.currentUser?.id || this.session?.user?.id || null;
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
