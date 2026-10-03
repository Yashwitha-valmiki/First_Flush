import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const root = path.resolve('.');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstflush-test-'));
const runtimeFile = path.join(tempDir, 'runtime.json');
const uploadDir = path.join(tempDir, 'uploads');
let port = 0;
let baseUrl = '';

let server;

async function waitForServerReady() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Server did not start in time.');
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const selectedPort = typeof address === 'object' && address ? address.port : 8899;
  await new Promise(resolve => server.close(resolve));
  return selectedPort;
}

test.before(async () => {
  port = await allocatePort();
  baseUrl = `http://127.0.0.1:${port}`;
  fs.mkdirSync(uploadDir, { recursive: true });
  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ALLOWED_ORIGIN: baseUrl,
      CORS_ORIGINS: baseUrl,
      OPEN_METEO_BASE_URL: 'http://127.0.0.1:1/offline',
      FIRSTFLUSH_RUNTIME_FILE: runtimeFile,
      FIRSTFLUSH_UPLOAD_DIR: uploadDir
    },
    stdio: 'ignore'
  });
  await waitForServerReady();
});

test.after(() => {
  server?.kill('SIGTERM');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('health endpoint exposes service metadata', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'local-file-adapter');
});

test('state ranking changes across dry-days and rainfall scenarios', async () => {
  const high = await fetch(`${baseUrl}/api/state?dryDays=18&rainfall=heavy`);
  const low = await fetch(`${baseUrl}/api/state?dryDays=2&rainfall=light`);
  const highState = await high.json();
  const lowState = await low.json();
  assert.ok(highState.locations.length > 0);
  assert.ok(lowState.locations.length > 0);
  assert.ok(highState.locations[0].riskScore > lowState.locations[0].riskScore);
});

test('state and city filters return only matching records', async () => {
  const response = await fetch(`${baseUrl}/api/state?state=Telangana&city=Hyderabad`);
  const body = await response.json();
  assert.ok(body.locations.length > 0);
  for (const location of body.locations) {
    assert.equal(location.state, 'Telangana');
    assert.equal(location.city, 'Hyderabad');
  }
});

test('invalid action input is rejected', async () => {
  const response = await fetch(`${baseUrl}/api/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locationId: 'missing', type: '' })
  });
  assert.equal(response.status, 400);
});

test('valid action creation and status updates work', async () => {
  const created = await fetch(`${baseUrl}/api/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locationId: 'IN-001', type: 'Inspect', notes: 'Test action' })
  });
  assert.equal(created.status, 201);
  const action = await created.json();
  assert.equal(action.status, 'Pending');

  const updated = await fetch(`${baseUrl}/api/actions/${action.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'Completed' })
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.status, 'Completed');
});

test('chat endpoint returns grounded response', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Why is the highest-risk location urgent?' })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'local-grounded');
  assert.match(body.answer, /relative prioritisation estimate/i);
});

test('CSV export works and escapes values', async () => {
  const response = await fetch(`${baseUrl}/api/report.csv?state=All`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/csv/);
  assert.match(response.headers.get('content-disposition') || '', /firstflush-priority\.csv/);
  const csv = await response.text();
  assert.match(csv, /^id,name,city,state,riskScore,level,confidence,coverage,recommendation/m);
  assert.match(csv, /"Lake North inlet"/);
});

test('weather validation and fallback behavior are explicit', async () => {
  const invalidCoordinates = await fetch(`${baseUrl}/api/weather?lat=1&lon=200`);
  assert.equal(invalidCoordinates.status, 200);
  const invalidBody = await invalidCoordinates.json();
  assert.equal(invalidBody.mode, 'offline');
  assert.match(invalidBody.error, /Indian latitude and longitude/i);

  const fallback = await fetch(`${baseUrl}/api/weather?lat=20.5937&lon=78.9629`);
  const fallbackBody = await fallback.json();
  assert.equal(fallbackBody.mode, 'fallback');
  assert.equal(fallbackBody.source, 'Local scenario');
});

test('observation validation rejects invalid upload type and supports valid submissions', async () => {
  const badForm = new FormData();
  badForm.append('locationId', 'IN-001');
  badForm.append('type', 'Blocked drain');
  badForm.append('severity', 'high');
  badForm.append('notes', 'Invalid type');
  badForm.append('photo', new Blob(['bad file'], { type: 'text/plain' }), 'bad.txt');
  const badResponse = await fetch(`${baseUrl}/api/observations`, { method: 'POST', body: badForm });
  assert.equal(badResponse.status, 400);

  const goodForm = new FormData();
  goodForm.append('locationId', 'IN-001');
  goodForm.append('type', 'Blocked drain');
  goodForm.append('severity', 'high');
  goodForm.append('notes', 'Field test');
  goodForm.append('photo', new Blob([Buffer.from([137, 80, 78, 71])], { type: 'image/png' }), 'photo.png');
  const goodResponse = await fetch(`${baseUrl}/api/observations`, { method: 'POST', body: goodForm });
  assert.equal(goodResponse.status, 201);
  const observation = await goodResponse.json();
  assert.equal(observation.verification, 'pending');
  assert.match(observation.photo || '', /^\/uploads\//);
});

test('observation upload size validation rejects files over limit', async () => {
  const form = new FormData();
  form.append('locationId', 'IN-001');
  form.append('type', 'Blocked drain');
  form.append('severity', 'high');
  form.append('notes', 'Too big');
  form.append('photo', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
  const response = await fetch(`${baseUrl}/api/observations`, { method: 'POST', body: form });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /5 MB or smaller/i);
});
