class AuthManager {
  constructor() {
    this.currentUser = null;
    this.session = null;
  }

  async init() {
    if (!supabaseManager.isConfigured()) {
      return;
    }
    try {
      const supabase = supabaseManager.getClient();
      if (!supabase) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      this.session = session;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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