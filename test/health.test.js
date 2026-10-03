import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 8899;
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(port), ALLOWED_ORIGIN: `http://localhost:${port}` },
  stdio: 'ignore'
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('health endpoint works', async () => {
  try {
    await wait(500);
    const response = await fetch(`http://localhost:${port}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
  } finally {
    child.kill('SIGTERM');
  }
});
