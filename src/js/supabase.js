class SupabaseManager {
  constructor() {
    this.SUPABASE_URL = 'YOUR_SUPABASE_URL';
    this.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    this.client = null;
    this.loadConfig();
  }

  loadConfig() {
    if (typeof window !== 'undefined' && window.VEX_CONFIG) {
      this.SUPABASE_URL = window.VEX_CONFIG.SUPABASE_URL || this.SUPABASE_URL;
      this.SUPABASE_ANON_KEY = window.VEX_CONFIG.SUPABASE_ANON_KEY || this.SUPABASE_ANON_KEY;
    }
  }

  init() {
    if (!this.isConfigured()) {
      console.error(
        '%c[VEX-Timeline] Supabase 未配置！\n' +
        '请确认:\n' +
        '  1. Vercel Dashboard 已设置 SUPABASE_URL 和 SUPABASE_ANON_KEY 环境变量\n' +
        '  2. 修改环境变量后已重新部署 (Redeploy)\n' +
        '  3. 浏览器打开 https://<your-domain>/src/js/config.js 能看到真实 URL (而非 YOUR_SUPABASE_URL)\n' +
        '当前 URL:', 'color: red; font-weight: bold;',
        this.SUPABASE_URL
      );
      return null;
    }
    if (!this.client) {
      this.client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
    }
    return this.client;
  }

  getClient() {
    if (!this.client) {
      this.init();
    }
    return this.client;
  }

  isConfigured() {
    if (this.SUPABASE_URL === 'YOUR_SUPABASE_URL' ||
        this.SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY' ||
        this.SUPABASE_URL === '' ||
        this.SUPABASE_ANON_KEY === '') {
      return false;
    }
    // Validate URL format: must be https:// and look like Supabase
    if (!this.SUPABASE_URL.startsWith('https://')) {
      return false;
    }
    if (!this.SUPABASE_URL.includes('supabase')) {
      return false;
    }
    return true;
  }

  getConfigStatus() {
    const hasUrl = !!this.SUPABASE_URL && this.SUPABASE_URL !== 'YOUR_SUPABASE_URL';
    const hasKey = !!this.SUPABASE_ANON_KEY && this.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
    const urlLooksValid = this.SUPABASE_URL && this.SUPABASE_URL.startsWith('https://') && this.SUPABASE_URL.includes('supabase');
    const isValid = hasUrl && hasKey && urlLooksValid;

    let urlPrefix = '';
    if (hasUrl) {
      // Show scheme + host (e.g. https://abcdefg.supabase.co) but hide query/path
      try {
        const u = new URL(this.SUPABASE_URL);
        urlPrefix = u.origin;
      } catch (e) {
        urlPrefix = this.SUPABASE_URL.substring(0, 20) + '...';
      }
    }

    return {
      hasUrl,
      hasKey,
      urlPrefix,
      urlLooksValid,
      isValid
    };
  }

  getProjectRef() {
    if (!this.SUPABASE_URL) return null;
    try {
      const u = new URL(this.SUPABASE_URL);
      const host = u.hostname; // e.g. abcdefg.supabase.co
      const parts = host.split('.');
      return parts[0] || null;
    } catch (e) {
      return null;
    }
  }
}

const supabaseManager = new SupabaseManager();
