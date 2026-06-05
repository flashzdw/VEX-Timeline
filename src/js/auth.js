class AuthManager {
  constructor() {
    this.currentUser = null;
    this.session = null;
    this.STORAGE_KEY = 'vex_session';
    this._initialized = false;
  }

  // 备份用: 手动保存 session 到我们自己的 localStorage key
  _saveSession(session) {
    if (!session) return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type
      }));
    } catch (e) {
      console.error('[Auth] 保存 session 失败:', e);
    }
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  _clearSession() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {}
  }

  // 检查 localStorage 中是否有 Supabase SDK 自己存的 token
  _hasSupabaseStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const value = localStorage.getItem(key);
          if (value) return { key, value };
        }
        if (key === 'vex_supabase_auth') {
          const value = localStorage.getItem(key);
          if (value) return { key, value };
        }
      }
    } catch (e) {}
    return null;
  }

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    if (!supabaseManager.isConfigured()) {
      console.warn('[Auth] Supabase 未配置, 跳过 session 恢复');
      return;
    }

    const supabase = supabaseManager.getClient();
    if (!supabase) {
      console.error('[Auth] 无法获取 Supabase 客户端');
      return;
    }

    // 关键: 注册 auth state change 监听器, 这是 Supabase 官方推荐的 session 恢复方式
    // 它会在 SDK 从 localStorage 恢复 session 时触发 INITIAL_SESSION 事件
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State change:', event, session ? '(有 session)' : '(无 session)');
      if (event === 'SIGNED_OUT') {
        this._clearSession();
        this.currentUser = null;
        this.session = null;
        if (typeof app !== 'undefined' && app && app.handleSignedOut) {
          app.handleSignedOut();
        }
        return;
      }
      if (session) {
        this.session = session;
        this._saveSession(session);
        this._loadUserFromSession(session);
      }
    });

    // 主动恢复 session
    try {
      let { data: { session } } = await supabase.auth.getSession();
      console.log('[Auth] getSession() 返回:', session ? '有 session' : '无 session');

      // 如果 SDK 没有恢复, 尝试用我们自己的备份
      if (!session) {
        const saved = this._loadSession();
        if (saved?.refresh_token) {
          console.log('[Auth] 尝试用备份的 refresh_token 恢复 session...');
          try {
            const { data: restored, error: setError } = await supabase.auth.setSession({
              access_token: saved.access_token,
              refresh_token: saved.refresh_token
            });
            if (!setError && restored?.session) {
              session = restored.session;
              console.log('[Auth] 备份 session 恢复成功');
            } else {
              console.warn('[Auth] 备份 session 恢复失败:', setError?.message);
            }
          } catch (e) {
            console.error('[Auth] setSession 异常:', e);
          }
        }
      }

      // 最后一层保险: 直接检查 localStorage 中是否有 supabase 存的 token
      if (!session) {
        const stored = this._hasSupabaseStorage();
        if (stored) {
          console.log('[Auth] 发现 localStorage 中有 supabase token, 尝试用 SDK 读取...');
          try {
            // 触发 SDK 重新加载
            const result = await supabase.auth.getSession();
            if (result?.data?.session) {
              session = result.data.session;
            }
          } catch (e) {}
        }
      }

      if (!session) {
        console.log('[Auth] 未找到可恢复的 session, 需要重新登录');
        return;
      }

      this.session = session;
      this._saveSession(session);
      await this._loadUserFromSession(session);
      console.log('[Auth] Session 恢复完成, 用户:', this.currentUser?.username);
    } catch (e) {
      console.error('[Auth] 初始化异常:', e);
    }
  }

  async _loadUserFromSession(session) {
    if (!session) return;
    try {
      const supabase = supabaseManager.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileError && profile) {
        this.currentUser = profile;
      } else {
        this.currentUser = {
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || ''
        };
      }
    } catch (e) {
      console.error('[Auth] 加载用户信息失败:', e);
    }
  }

  async register(username, password) {
    if (!supabaseManager.isConfigured()) {
      throw 'Supabase not configured';
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
    this._saveSession(data.session);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profileError && profile) {
      this.currentUser = profile;
    } else {
      this.currentUser = { id: data.user.id, username: username };
    }

    return this.currentUser;
  }

  async login(username, password) {
    if (!supabaseManager.isConfigured()) {
      throw 'Supabase not configured';
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
      throw error.message;
    }

    this.session = data.session;
    this._saveSession(data.session);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profileError && profile) {
      this.currentUser = profile;
    } else {
      this.currentUser = { id: data.user.id, username: username };
    }

    return this.currentUser;
  }

  async logout() {
    const supabase = supabaseManager.getClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    this._clearSession();
    this.currentUser = null;
    this.session = null;
  }

  isLoggedIn() {
    return !!this.currentUser;
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
