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
const dataDir = path.join(root, 'data');
const runtimeFile = path.join(dataDir, 'runtime.json');
const seedFile = path.join(dataDir, 'locations.json');
const uploadDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const seedLocations = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
let runtime = fs.existsSync(runtimeFile) ? JSON.parse(fs.readFileSync(runtimeFile, 'utf8')) : { locations: seedLocations, observations: [], actions: [], updatedAt: new Date().toISOString() };
const clients = new Set();
const maxUpload = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
const upload = multer({ dest: uploadDir, limits: { fileSize: maxUpload }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'public')));
app.use('/uploads', express.static(uploadDir));

const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function persist() { runtime.updatedAt = now(); fs.writeFileSync(runtimeFile, JSON.stringify(runtime, null, 2)); broadcast('state.updated', { updatedAt: runtime.updatedAt }); }
function broadcast(type, payload) { const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; for (const response of clients) response.write(message); }
function validCoordinates(lat, lon) { return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98; }
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
app.get('/api/events', (req, res) => { res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders?.(); res.write(`event: connected\ndata: ${JSON.stringify({ at: now() })}\n\n`); clients.add(res); req.on('close', () => clients.delete(res)); });
app.post('/api/observations', upload.single('photo'), (req, res) => {
  const body = req.body || {}; const location = runtime.locations.find(item => item.id === body.locationId); const lat = Number(body.lat || location?.lat); const lon = Number(body.lon || location?.lon);
  if (!location || !body.type) return res.status(400).json({ error: 'A valid locationId and observation type are required.' });
  if (!validCoordinates(lat, lon)) return res.status(400).json({ error: 'Coordinates must be within India.' });
  const observation = { id: id(), locationId: location.id, type: String(body.type).slice(0, 80), severity: String(body.severity || 'moderate'), notes: String(body.notes || '').slice(0, 1000), lat, lon, photo: req.file ? `/uploads/${req.file.filename}` : null, source: 'user-submitted', verification: 'pending', createdAt: now() };
  runtime.observations.unshift(observation); persist(); broadcast('observation.created', observation); res.status(201).json(observation);
});
app.post('/api/actions', (req, res) => { const { locationId, type, notes = '' } = req.body || {}; if (!runtime.locations.some(item => item.id === locationId) || !type) return res.status(400).json({ error: 'A valid locationId and action type are required.' }); const action = { id: id(), locationId, type: String(type).slice(0, 80), notes: String(notes).slice(0, 1000), status: 'Pending', createdAt: now(), updatedAt: now() }; runtime.actions.unshift(action); persist(); broadcast('action.updated', action); res.status(201).json(action); });
app.patch('/api/actions/:actionId', (req, res) => { const action = runtime.actions.find(item => item.id === req.params.actionId); const statuses = ['Pending', 'Assigned', 'In progress', 'Completed', 'Verified', 'Rejected']; if (!action) return res.status(404).json({ error: 'Action not found.' }); if (req.body?.status && !statuses.includes(req.body.status)) return res.status(400).json({ error: 'Unsupported action status.' }); action.status = req.body.status || action.status; action.updatedAt = now(); persist(); broadcast('action.updated', action); res.json(action); });
app.post('/api/chat', (req, res) => { const message = String(req.body?.message || '').trim().slice(0, 500); if (!message) return res.status(400).json({ error: 'Message is required.' }); const top = filteredState({})[0]; if (!top) return res.json({ answer: 'No locations are currently available.', mode: 'local-grounded', source: 'Current application state' }); res.json({ answer: `${top.name} is ranked ${top.riskScore}/100 (${top.level}). The estimate uses dry-period accumulation, rainfall scenario, paved exposure, traffic, construction, waste/blockage and water-body proximity. Confidence is ${top.confidence}. This is a relative prioritisation estimate, not a laboratory measurement. Recommended action: ${top.recommendation}`, mode: 'local-grounded', source: 'Current application state', createdAt: now() }); });
app.get('/api/report.csv', (req, res) => { const rows = filteredState(req.query); const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`; const csv = ['id,name,city,state,riskScore,level,confidence,coverage,recommendation', ...rows.map(item => [item.id, item.name, item.city, item.state, item.riskScore, item.level, item.confidence, item.coverage, item.recommendation].map(quote).join(','))].join('\n'); res.type('text/csv').set('Content-Disposition', 'attachment; filename="firstflush-priority.csv"').send(csv); });
app.get('*', (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

export { app };
export const handler = serverless(app);
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) app.listen(port, () => console.log(`FirstFlush India running at http://localhost:${port}`));
