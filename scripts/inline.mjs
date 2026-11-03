// Turns the built app (dist/) into ONE html file that opens by double-click, from a pendrive or any web host.
// Usage: npm run build:single      (writes dist/alexandria.html)
// If public/school-logo.png exists it is embedded, so the single file carries the logo with it.
import fs from 'node:fs';
import path from 'node:path';

const assets = path.join('dist', 'assets');
const read = (ext) => fs.readdirSync(assets).filter((f) => f.endsWith(ext)).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');
let js = read('.js').replaceAll('</script', '<\\/script');
const css = read('.css');
const logo = path.join('public', 'school-logo.png');
let logoUri = '';
if (fs.existsSync(logo)) {
  logoUri = `data:image/png;base64,${fs.readFileSync(logo).toString('base64')}`;
  console.log('Embedded the school logo.');
} else console.log('No public/school-logo.png found: the plain emblem will be shown.');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#172A3A" />
<title>Alexandria</title>
<style>${css}</style>
<script>window.ALEXANDRIA_LOGO = ${JSON.stringify(logoUri)};</script>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`;
fs.writeFileSync(path.join('dist', 'alexandria.html'), html);
console.log(`Wrote dist/alexandria.html (${(html.length / 1e6).toFixed(2)} MB)`);
