import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '8899' }, stdio: 'ignore' });
const stop = () => child.kill('SIGTERM');
test('health endpoint works', async () => { await new Promise(r => setTimeout(r, 400)); const response = await fetch('http://localhost:8899/api/health'); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.ok, true); stop(); });
