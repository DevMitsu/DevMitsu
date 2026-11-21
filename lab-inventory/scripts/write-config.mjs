// Runs after "npm run build". If SUPABASE_URL and SUPABASE_ANON_KEY are set (for example in Netlify's
// Site settings > Environment variables), they are written into dist/config.js, so no keys live in the code.
import fs from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('SUPABASE_URL / SUPABASE_ANON_KEY not set: the app will run on one computer until config.js is edited.');
  process.exit(0);
}
if (/service_role/i.test(key)) {
  console.error('That looks like a service_role key. Use the "anon public" key: the service_role key must never be put in a web app.');
  process.exit(1);
}
fs.writeFileSync('dist/config.js', `window.LAB_INVENTORY_CONFIG = ${JSON.stringify({ mode: 'supabase', url, anonKey: key }, null, 2)};\n`);
console.log(`Wrote dist/config.js for ${url}.`);
