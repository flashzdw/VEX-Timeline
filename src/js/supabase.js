class SupabaseManager {
  constructor() {
    this.SUPABASE_URL = '';
    this.SUPABASE_ANON_KEY = '';
    this.client = null;
    this._configLoaded = false;
    this.loadConfig();
  }

  loadConfig() {
    if (typeof window !== 'undefined' && window.VEX_CONFIG) {
      this.SUPABASE_URL = window.VEX_CONFIG.SUPABASE_URL || '';
      this.SUPABASE_ANON_KEY = window.VEX_CONFIG.SUPABASE_ANON_KEY || '';
    }
    this._configLoaded = true;
    console.log('[Supabase] Config loaded:', {
      url: this.SUPABASE_URL ? this.SUPABASE_URL.substring(0, 30) + '...' : '(empty)',
      key: this.SUPABASE_ANON_KEY ? this.SUPABASE_ANON_KEY.substring(0, 20) + '...' : '(empty)',
      configured: this.isConfigured()
    });
  }

  init() {
    if (!this.isConfigured()) {
      console.warn('[Supabase] 未配置 SUPABASE_URL/SUPABASE_ANON_KEY，无法初始化客户端。请在 src/js/config.js 中填写或在 Vercel 环境变量中设置。');
      return null;
    }
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('[Supabase] supabase-js SDK 未加载');
      return null;
    }
    // 显式指定 localStorage 作为存储, 确保 session 跨页面刷新持久化
    this.client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
      auth: {
        storage: localStorage,
        storageKey: 'vex_supabase_auth',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
    console.log('[Supabase] 客户端已初始化');
    return this.client;
  }

  getClient() {
    if (!this.client) {
      this.init();
    }
    return this.client;
  }

  isConfigured() {
    return this.SUPABASE_URL && this.SUPABASE_ANON_KEY &&
           this.SUPABASE_URL.length > 0 &&
           this.SUPABASE_ANON_KEY.length > 0;
  }
}

const supabaseManager = new SupabaseManager();
