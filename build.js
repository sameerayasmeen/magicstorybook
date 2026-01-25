
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir);

// Copy necessary files only
['index.html', 'index.tsx', 'metadata.json'].forEach(file => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, file));
});

// Inject API Key
const indexPath = path.join(distDir, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');
content = content.replace('__API_KEY_PLACEHOLDER__', process.env.API_KEY || '');
fs.writeFileSync(indexPath, content);

console.log('Build complete.');
