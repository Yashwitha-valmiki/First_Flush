import fs from 'node:fs';
import path from 'node:path';
const files = ['server.js', 'lambda.js', 'public/index.html', 'public/app.js', 'public/styles.css'];
for (const file of files) {
  if (!fs.existsSync(path.resolve(file)) || fs.statSync(path.resolve(file)).size === 0) {
    console.error(`Invalid or empty file: ${file}`);
    process.exit(1);
  }
}
console.log('FirstFlush lint preflight passed.');
