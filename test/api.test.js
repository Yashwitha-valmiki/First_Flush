import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const port = 8900;
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test('chat and validation endpoints work', async () => { try { await wait(600); const chat = await fetch(`http://localhost:${port}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Why is the highest-risk point urgent?' }) }); assert.equal(chat.status, 200); assert.equal((await chat.json()).mode, 'local-grounded'); const bad = await fetch(`http://localhost:${port}/api/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locationId: 'missing' }) }); assert.equal(bad.status, 400); } finally { child.kill('SIGTERM'); } });
