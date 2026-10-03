import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const required = [
  'package.json',
  'server.js',
  'lambda.js',
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'public/config.js',
  'data/locations.json'
];
const missing = required.filter(file => !fs.existsSync(path.resolve(file)));
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}`);
const syntaxTargets = ['server.js', 'lambda.js', 'public/app.js', 'public/config.js', 'scripts/build.mjs', 'scripts/lint.mjs'];
for (const file of syntaxTargets) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });
fs.cpSync('public', 'dist', { recursive: true });
console.log('FirstFlush frontend bundle written to dist/ with required-file and syntax validation.');
