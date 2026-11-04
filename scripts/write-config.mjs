// Runs after "npm run build". If SUPABASE_URL and SUPABASE_ANON_KEY are set (for example in Netlify's
// Site settings > Environment variables), they are written into dist/config.js, so no keys live in the code.
// Optional: LIBRARIES="sr" (default) or "sr,jr".
import fs from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('SUPABASE_URL / SUPABASE_ANON_KEY not set: the site will run as the demo until config.js is edited.');
  process.exit(0);
}
const libraries = (process.env.LIBRARIES ?? 'sr').split(',').map((s) => s.trim()).filter((s) => s === 'sr' || s === 'jr');
const body = `window.ALEXANDRIA_CONFIG = ${JSON.stringify({ mode: 'supabase', url, anonKey: key, libraries: libraries.length ? libraries : ['sr'] }, null, 2)};\n`;
fs.writeFileSync('dist/config.js', body);
console.log(`Wrote dist/config.js for ${url} (libraries: ${libraries.join(', ') || 'sr'}).`);
