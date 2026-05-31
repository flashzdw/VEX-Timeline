const fs = require('fs');
const path = require('path');

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
const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
};

// Generate the config.js file content
const configContent = `window.VEX_CONFIG = ${JSON.stringify(config, null, 2)};`;

// Write to src/js/config.js
const outputPath = path.join(__dirname, '..', 'src', 'js', 'config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✅ Configuration file generated:', outputPath);
console.log('   SUPABASE_URL:', config.SUPABASE_URL === 'YOUR_SUPABASE_URL' ? '(not set)' : '(set)');
console.log('   SUPABASE_ANON_KEY:', config.SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY' ? '(not set)' : '(set)');
