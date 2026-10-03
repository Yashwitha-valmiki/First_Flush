import fs from 'node:fs';
import path from 'node:path';

const required = ['package.json', 'server.js', 'lambda.js', 'public/index.html', 'public/app.js', 'public/styles.css', 'data/locations.json'];
const missing = required.filter(file => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error(`Missing required files: ${missing.join(', ')}`);
  process.exit(1);
}
fs.mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'config.js']) fs.copyFileSync(path.join('public', file), path.join('dist', file));
console.log('FirstFlush static bundle validated in dist/');
