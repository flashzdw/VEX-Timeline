class AuthManager {
  constructor() {
    this.currentUser = null;
    this.session = null;
    this.STORAGE_KEY = 'vex_session';
  }

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
      console.error('保存 session 失败:', e);
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

  async init() {
    if (!supabaseManager.isConfigured()) {
      return;
    }
    try {
      const supabase = supabaseManager.getClient();
      if (!supabase) return;

      // SDK 已配置 localStorage, getSession() 会自动从 localStorage 恢复 session
      let { data: { session } } = await supabase.auth.getSession();

      // 如果 SDK 没有恢复 session, 尝试手动恢复
      if (!session) {
        const saved = this._loadSession();
        if (saved?.refresh_token) {
          const { data: restored, error: setError } = await supabase.auth.setSession({
            access_token: saved.access_token,
            refresh_token: saved.refresh_token
          });
          if (!setError && restored.session) {
            session = restored.session;
          }
        }
      }

      if (!session) {
        console.log('Auth: 未找到已保存的 session');
        return;
      }

      this.session = session;
      // 确保 session 已保存到 localStorage (SDK 会自动做, 这里做双重保险)
      this._saveSession(session);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('Auth: session 无效, 无法获取用户');
        this._clearSession();
        this.session = null;
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileError && profile) {
        this.currentUser = profile;
      } else if (user) {
        this.currentUser = {
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || ''
        };
      }

      console.log('Auth: 已恢复登录状态, 用户:', this.currentUser?.username);
    } catch (e) {
      console.error('Auth 初始化失败:', e);
      this.currentUser = null;
      this.session = null;
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
    await supabase.auth.signOut();
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  }
}

const authManager = new AuthManager();