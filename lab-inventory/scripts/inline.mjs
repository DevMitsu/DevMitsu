// Turns the built app (dist/) into ONE html file that opens by double-click, from a pendrive, or from any web host.
// Usage: npm run build:single      (writes dist/lab-inventory.html)
import fs from 'node:fs';
import path from 'node:path';

const assets = path.join('dist', 'assets');
const read = (ext) => fs.readdirSync(assets).filter((f) => f.endsWith(ext)).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');
const js = read('.js').replaceAll('</script', '<\\/script');
const css = read('.css');
// If SUPABASE_URL / SUPABASE_ANON_KEY were set for this build, the connection is baked into the single file
const cfgPath = path.join('dist', 'config.js');
const cfg = fs.existsSync(cfgPath) && !/PASTE-YOUR/.test(fs.readFileSync(cfgPath, 'utf8')) ? fs.readFileSync(cfgPath, 'utf8').replaceAll('</script', '<\\/script') : '';
if (cfg) console.log('Embedded the Supabase connection from dist/config.js.');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#1f2a44" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231f2a44'/%3E%3Cpath d='M12 6h8M14 6v7l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V6' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
<title>Lab Inventory</title>
<style>${css}</style>
${cfg ? `<script>${cfg}</script>` : ''}
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`;
fs.writeFileSync(path.join('dist', 'lab-inventory.html'), html);
console.log(`Wrote dist/lab-inventory.html (${(html.length / 1e6).toFixed(2)} MB)`);
