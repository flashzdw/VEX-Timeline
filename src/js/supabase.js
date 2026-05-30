class SupabaseManager {
  constructor() {
    this.SUPABASE_URL = 'YOUR_SUPABASE_URL';
    this.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    this.client = null;
  }

  init() {
    if (!this.isConfigured()) {
      return null;
    }
    this.client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
    return this.client;
  }

  getClient() {
    if (!this.client) {
      this.init();
    }
    return this.client;
  }

  isConfigured() {
    return this.SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
           this.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
           this.SUPABASE_URL !== '' &&
           this.SUPABASE_ANON_KEY !== '';
  }
}

const supabaseManager = new SupabaseManager();
