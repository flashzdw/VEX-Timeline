const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// Try to load .env.local if it exists (for local development)
const localEnvPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(localEnvPath)) {
  const envContent = fs.readFileSync(localEnvPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

// Read configuration from environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const isVercelBuild = process.env.VERCEL === '1';
const isPlaceholder = !supabaseUrl || !supabaseAnonKey;
const isValidUrl = supabaseUrl && (supabaseUrl.startsWith('https://') && supabaseUrl.includes('supabase'));

// Print status header
console.log('');
console.log(`${CYAN}=== VEX-Timeline Build Configuration ===${RESET}`);
console.log(`Environment: ${isVercelBuild ? 'Vercel Build' : 'Local Build'}`);
console.log(`SUPABASE_URL:    ${supabaseUrl ? `${GREEN}(set, length=${supabaseUrl.length})${RESET}` : `${RED}(not set)${RESET}`}`);
console.log(`SUPABASE_ANON_KEY:${supabaseAnonKey ? `${GREEN}(set, length=${supabaseAnonKey.length})${RESET}` : `${RED}(not set)${RESET}`}`);

if (isPlaceholder) {
  console.log('');
  console.error(`${RED}╔════════════════════════════════════════════════════════════╗${RESET}`);
  console.error(`${RED}║  ❌  Supabase environment variables are NOT set!         ║${RESET}`);
  console.error(`${RED}╚════════════════════════════════════════════════════════════╝${RESET}`);
  console.error(`${YELLOW}This means the deployed site will NOT be able to:${RESET}`);
  console.error(`${YELLOW}  • Restore user login sessions after refresh${RESET}`);
  console.error(`${YELLOW}  • Sync user data to the cloud${RESET}`);
  console.error('');
  console.error(`${CYAN}How to fix:${RESET}`);
  if (isVercelBuild) {
    console.error(`${CYAN}  1. Go to Vercel Dashboard → Project → Settings → Environment Variables${RESET}`);
    console.error(`${CYAN}  2. Add SUPABASE_URL and SUPABASE_ANON_KEY${RESET}`);
    console.error(`${CYAN}  3. Make sure ALL THREE scopes are checked: Production, Preview, Development${RESET}`);
    console.error(`${CYAN}  4. Click "Save" then go to Deployments → Redeploy${RESET}`);
  } else {
    console.error(`${CYAN}  1. Create a .env.local file in the project root${RESET}`);
    console.error(`${CYAN}  2. Add: SUPABASE_URL=your_url_here${RESET}`);
    console.error(`${CYAN}  3. Add: SUPABASE_ANON_KEY=your_key_here${RESET}`);
  }
  console.error('');

  if (isVercelBuild) {
    // Fail the build on Vercel to prevent silent broken deployments
    console.error(`${RED}Aborting Vercel build due to missing env vars.${RESET}`);
    process.exit(1);
  }
}

if (!isPlaceholder && !isValidUrl) {
  console.error(`${YELLOW}⚠️  Warning: SUPABASE_URL does not look like a valid Supabase URL${RESET}`);
  console.error(`${YELLOW}   Expected format: https://<project-ref>.supabase.co${RESET}`);
  console.error(`${YELLOW}   Got: ${supabaseUrl.substring(0, 30)}...${RESET}`);
}

const config = {
  SUPABASE_URL: supabaseUrl || 'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: supabaseAnonKey || 'YOUR_SUPABASE_ANON_KEY'
};

// Generate the config.js file content
const configContent = `window.VEX_CONFIG = ${JSON.stringify(config, null, 2)};`;

// Write to src/js/config.js
const outputPath = path.join(__dirname, '..', 'src', 'js', 'config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('');
console.log(`${GREEN}✅ Configuration file generated:${RESET} ${outputPath}`);
console.log('');
