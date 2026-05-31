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
      const stored = localStorage.getItem('vex_timeline_session');
      if (stored) {
        const storedSession = JSON.parse(stored);
        const supabase = supabaseManager.getClient();
        await supabase.auth.setSession(storedSession);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          throw new Error('Invalid session');
        }
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profileError || !profile) {
          throw new Error('Profile not found');
        }
        this.currentUser = profile;
        this.session = storedSession;
      }
    } catch (e) {
      localStorage.removeItem('vex_timeline_session');
      this.currentUser = null;
      this.session = null;
    }
  }

  async register(username) {
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
    const supabase = supabaseManager.getClient();
    const { data, error } = await supabase.rpc('register', { p_username: username });
    if (error) {
      if (error.code === '23505' || (error.message && (error.message.includes('duplicate') || error.message.includes('already exists')))) {
        throw '用户名已被占用';
      }
      throw error.message;
    }
    const { access_token, refresh_token } = data;
    if (!access_token) {
      this.currentUser = data.user;
      return this.currentUser;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });
    this.session = sessionData.session;
    localStorage.setItem('vex_timeline_session', JSON.stringify(this.session));
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    this.currentUser = profile;
    return this.currentUser;
  }

  async login(username) {
    if (!supabaseManager.isConfigured()) {
      throw 'Supabase not configured';
    }
    username = username.trim();
    if (!username) {
      throw '请输入用户名';
    }
    const supabase = supabaseManager.getClient();
    const { data, error } = await supabase.rpc('login', { p_username: username });
    if (error || !data) {
      throw '用户名不存在';
    }
    const { access_token, refresh_token } = data;
    const { data: sessionData } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });
    this.session = sessionData.session;
    localStorage.setItem('vex_timeline_session', JSON.stringify(this.session));
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    this.currentUser = profile;
    return this.currentUser;
  }

  async logout() {
    const supabase = supabaseManager.getClient();
    await supabase.auth.signOut();
    localStorage.removeItem('vex_timeline_session');
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
