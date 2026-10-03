import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import serverless from 'serverless-http';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8787);
const defaultDataDir = path.join(root, 'data');
const dataDir = path.resolve(process.env.FIRSTFLUSH_DATA_DIR || defaultDataDir);
const runtimeFile = path.resolve(process.env.FIRSTFLUSH_RUNTIME_FILE || path.join(dataDir, 'runtime.json'));
const seedFile = path.resolve(process.env.FIRSTFLUSH_SEED_FILE || path.join(defaultDataDir, 'locations.json'));
const uploadDir = path.resolve(process.env.FIRSTFLUSH_UPLOAD_DIR || path.join(root, 'uploads'));
fs.mkdirSync(path.dirname(runtimeFile), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const seedLocations = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
let runtime = fs.existsSync(runtimeFile) ? JSON.parse(fs.readFileSync(runtimeFile, 'utf8')) : { locations: seedLocations, observations: [], actions: [], updatedAt: new Date().toISOString() };
const clients = new Set();
const maxUpload = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxUpload },
  fileFilter: (_req, file, cb) => {
    if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
    const error = new Error('Unsupported image type. Use JPEG, PNG, or WebP.');
    error.code = 'UNSUPPORTED_MEDIA_TYPE';
    return cb(error);
  }
});

const allowedOrigins = String(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGIN || 'http://localhost:8787')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.includes('*');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin denied'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'public')));
app.use('/uploads', express.static(uploadDir));

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function persist() { runtime.updatedAt = now(); fs.writeFileSync(runtimeFile, JSON.stringify(runtime, null, 2)); broadcast('state.updated', { updatedAt: runtime.updatedAt }); }
function broadcast(type, payload) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of clients) {
    try {
      response.write(message);
    } catch {
      clients.delete(response);
    }
  }
}
function validCoordinates(lat, lon) { return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98; }
function cleanInput(value, maxLength) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
function risk(location, query = {}) {
  const dry = clamp(query.dryDays === undefined ? location.dryDays : query.dryDays);
  const rain = query.rainfall === 'light' ? 35 : query.rainfall === 'heavy' ? 92 : 65;
  const factors = { dryPeriod: clamp(dry * 1.05), rainfall: rain, pavedExposure: clamp(location.paved), trafficExposure: clamp(location.traffic), constructionExposure: clamp(location.construction), wasteAndBlockage: clamp((location.waste + location.blockage) / 2), waterBodyProximity: clamp(location.distance) };
  const score = Math.round(clamp(0.22 * factors.dryPeriod + 0.22 * factors.rainfall + 0.14 * factors.pavedExposure + 0.12 * factors.trafficExposure + 0.10 * factors.constructionExposure + 0.10 * factors.wasteAndBlockage + 0.10 * factors.waterBodyProximity));
  const level = score >= 75 ? 'Very high' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low';
  const observations = runtime.observations.filter(item => item.locationId === location.id);
  const confidence = observations.length >= 2 ? 'High' : observations.length === 1 ? 'Medium' : location.source === 'seed' ? 'Limited' : 'Medium';
  const recommendation = level === 'Very high' ? 'Inspect and clear visible debris before rainfall; use a temporary screen only if safe and permitted.' : level === 'High' ? 'Schedule an inspection and prepare a cleanup action before rainfall.' : 'Monitor conditions and verify the next observation.';
  return { ...location, riskScore: score, level, confidence, factors, recommendation, updatedAt: runtime.updatedAt };
}
async function getWeather(lat, lon) {
  if (!validCoordinates(lat, lon)) return { mode: 'offline', source: 'Unavailable', error: 'Use an Indian latitude and longitude.' };
  const base = process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast';
  try {
    const response = await fetch(`${base}?latitude=${lat}&longitude=${lon}&hourly=precipitation,rain&forecast_days=1&timezone=auto`);
    if (!response.ok) throw new Error(`provider returned ${response.status}`);
    const data = await response.json();
    const values = Array.isArray(data.hourly?.precipitation) ? data.hourly.precipitation.slice(0, 6) : [];
    return { mode: 'live', source: 'Open-Meteo', rainMm: Number(Math.max(0, ...values).toFixed(1)), timezone: data.timezone, updatedAt: now() };
  } catch {
    return { mode: 'fallback', source: 'Local scenario', rainMm: 18, note: 'Weather provider unavailable; this value is not live.', updatedAt: now() };
  }
}
function filteredState(query) {
  const state = query.state && query.state !== 'All' ? query.state : null;
  const city = query.city && query.city !== 'All' ? query.city : null;
  return runtime.locations.filter(location => (!state || location.state === state) && (!city || location.city === city)).map(location => risk(location, query)).sort((a, b) => b.riskScore - a.riskScore);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'firstflush-api', mode: 'local-file-adapter', updatedAt: runtime.updatedAt }));
app.get('/api/state', (req, res) => res.json({ locations: filteredState(req.query), actions: runtime.actions, observations: runtime.observations, updatedAt: runtime.updatedAt, coverage: 'Partial; seed and user-submitted records are labelled.' }));
app.get('/api/weather', async (req, res) => res.json(await getWeather(Number(req.query.lat || 20.5937), Number(req.query.lon || 78.9629))));
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ at: now() })}\n\n`);
  clients.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: now() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 20000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});
app.post('/api/observations', upload.single('photo'), (req, res) => {
  const body = req.body || {};
  const location = runtime.locations.find(item => item.id === body.locationId);
  const type = cleanInput(body.type, 80);
  const severity = cleanInput(body.severity || 'moderate', 20).toLowerCase();
  const notes = cleanInput(body.notes, 1000);
  const lat = Number(body.lat ?? location?.lat);
  const lon = Number(body.lon ?? location?.lon);
  if (!location || !type) return res.status(400).json({ error: 'A valid locationId and observation type are required.' });
  if (!['low', 'moderate', 'high', 'critical'].includes(severity)) return res.status(400).json({ error: 'Unsupported severity value.' });
  if (!validCoordinates(lat, lon)) return res.status(400).json({ error: 'Coordinates must be within India.' });
  const observation = { id: id(), locationId: location.id, type, severity, notes, lat, lon, photo: req.file ? `/uploads/${req.file.filename}` : null, source: 'user-submitted', verification: 'pending', createdAt: now() };
  runtime.observations.unshift(observation); persist(); broadcast('observation.created', observation); res.status(201).json(observation);
});
app.post('/api/actions', (req, res) => {
  const locationId = cleanInput(req.body?.locationId, 120);
  const type = cleanInput(req.body?.type, 80);
  const notes = cleanInput(req.body?.notes, 1000);
  if (!runtime.locations.some(item => item.id === locationId) || !type) return res.status(400).json({ error: 'A valid locationId and action type are required.' });
  const action = { id: id(), locationId, type, notes, status: 'Pending', createdAt: now(), updatedAt: now() };
  runtime.actions.unshift(action);
  persist();
  broadcast('action.updated', action);
  res.status(201).json(action);
});
app.patch('/api/actions/:actionId', (req, res) => {
  const action = runtime.actions.find(item => item.id === req.params.actionId);
  const statuses = ['Pending', 'Assigned', 'In progress', 'Completed', 'Verified', 'Rejected'];
  const status = cleanInput(req.body?.status, 40);
  if (!action) return res.status(404).json({ error: 'Action not found.' });
  if (status && !statuses.includes(status)) return res.status(400).json({ error: 'Unsupported action status.' });
  action.status = status || action.status;
  action.updatedAt = now();
  persist();
  broadcast('action.updated', action);
  res.json(action);
});
app.post('/api/chat', (req, res) => {
  const message = cleanInput(req.body?.message, 500);
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const top = filteredState({})[0];
  if (!top) return res.json({ answer: 'No locations are currently available.', mode: 'local-grounded', source: 'Current application state' });
  res.json({ answer: `${top.name} is ranked ${top.riskScore}/100 (${top.level}). The estimate uses dry-period accumulation, rainfall scenario, paved exposure, traffic, construction, waste/blockage and water-body proximity. Confidence is ${top.confidence}. This is a relative prioritisation estimate, not a laboratory measurement. Recommended action: ${top.recommendation}`, mode: 'local-grounded', source: 'Current application state', createdAt: now() });
});
app.get('/api/report.csv', (req, res) => { const rows = filteredState(req.query); const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`; const csv = ['id,name,city,state,riskScore,level,confidence,coverage,recommendation', ...rows.map(item => [item.id, item.name, item.city, item.state, item.riskScore, item.level, item.confidence, item.coverage, item.recommendation].map(quote).join(','))].join('\n'); res.type('text/csv').set('Content-Disposition', 'attachment; filename="firstflush-priority.csv"').send(csv); });
app.get('*', (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `Photo must be ${Math.floor(maxUpload / (1024 * 1024))} MB or smaller.` });
  if (error?.code === 'UNSUPPORTED_MEDIA_TYPE') return res.status(400).json({ error: 'Photo must be JPEG, PNG, or WebP.' });
  if (error?.message === 'CORS origin denied') return res.status(403).json({ error: 'Origin not allowed.' });
  console.error('Request failed', error);
  return res.status(500).json({ error: 'Request could not be processed.' });
});

export { app };
export const handler = serverless(app);
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) app.listen(port, () => console.log(`FirstFlush India running at http://localhost:${port}`));
