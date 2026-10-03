import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const port = 8899;
const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), ALLOWED_ORIGIN: `http://localhost:${port}` }, stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test('health and state endpoints work', async () => { try { await wait(600); const health = await fetch(`http://localhost:${port}/api/health`); assert.equal(health.status, 200); assert.equal((await health.json()).ok, true); const state = await fetch(`http://localhost:${port}/api/state?dryDays=18&rainfall=heavy`); const body = await state.json(); assert.equal(state.status, 200); assert.ok(Array.isArray(body.locations)); assert.ok(body.locations[0].riskScore >= 0); } finally { child.kill('SIGTERM'); } });
