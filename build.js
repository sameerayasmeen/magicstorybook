
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// 1. Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// 2. Recursive copy function
function copy(src, dest) {
  const stat = fs.lstatSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(file => copy(path.join(src, file), path.join(dest, file)));
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 3. Items to include in the deployment
const items = ['index.html', 'index.tsx', 'App.tsx', 'types.ts', 'metadata.json', 'services', 'utils', 'components'];

items.forEach(item => {
  const src = path.join(__dirname, item);
  const dest = path.join(distDir, item);
  if (fs.existsSync(src)) copy(src, dest);
});

// 4. Inject the API Key from Netlify's environment into index.html
const indexPath = path.join(distDir, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');
const key = process.env.API_KEY || '';
content = content.replace('__API_KEY_PLACEHOLDER__', key);
fs.writeFileSync(indexPath, content);

console.log('Build successful: Files copied to /dist and API_KEY injected.');
