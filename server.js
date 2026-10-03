import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8787);
const runtimePath = path.join(__dirname, 'data', 'runtime.json');
const seedPath = path.join(__dirname, 'data', 'locations.json');
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
let runtime = fs.existsSync(runtimePath) ? JSON.parse(fs.readFileSync(runtimePath, 'utf8')) : { locations: seed, actions: [], observations: [], updatedAt: new Date().toISOString() };
const clients = new Set();
const upload = multer({ dest: uploadDir, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)) });
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const save = () => { runtime.updatedAt = new Date().toISOString(); fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2)); broadcast('state.updated', { updatedAt: runtime.updatedAt }); };
function broadcast(type, data) { const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`; for (const res of clients) res.write(message); }
function clamp(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }
function scoreLocation(location, scenario = {}) {
  const dry = clamp(scenario.dryDays ?? location.dryDays); const rain = scenario.rainfall === 'light' ? 38 : scenario.rainfall === 'heavy' ? 92 : 68;
  const factors = { dryPeriod: dry * 1.05, rainfall: rain, paved: location.paved, traffic: location.traffic, construction: location.construction, wasteBlockage: clamp((location.waste + location.blockage) / 2), waterBody: location.distance };
  const score = Math.round(clamp(0.22 * factors.dryPeriod + 0.22 * factors.rainfall + 0.14 * factors.paved + 0.12 * factors.traffic + 0.10 * factors.construction + 0.10 * factors.wasteBlockage + 0.10 * factors.waterBody));
  const level = score >= 75 ? 'Very high' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low';
  const observations = runtime.observations.filter(o => o.locationId === location.id);
  const confidence = observations.length >= 2 ? 'High' : observations.length ? 'Medium' : 'Limited';
  return { ...location, riskScore: score, level, confidence, factors, recommendation: score >= 75 ? 'Inspect and clear visible debris before rainfall; use a temporary screen only if safe and permitted.' : score >= 50 ? 'Schedule an inspection and prepare a cleanup action.' : 'Monitor and verify conditions before the next rainfall.', updatedAt: runtime.updatedAt };
}
async function weather(lat, lon) {
  const url = `${process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast'}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&hourly=precipitation,rain&forecast_days=1&timezone=auto`;
  try { const r = await fetch(url); if (!r.ok) throw new Error(`weather ${r.status}`); const data = await r.json(); const rain = Math.max(...(data.hourly?.precipitation || [0]).slice(0, 6)); return { mode: 'live', source: 'Open-Meteo', rainMm: Number(rain.toFixed(1)), updatedAt: new Date().toISOString(), timezone: data.timezone }; }
  catch { return { mode: 'fallback', source: 'Local scenario', rainMm: 18, updatedAt: new Date().toISOString(), note: 'Provider unavailable; estimate is not live.' }; }
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'firstflush-api', updatedAt: runtime.updatedAt }));
app.get('/api/state', (req, res) => { const { city, state, dryDays, rainfall } = req.query; let locations = runtime.locations.filter(l => (!city || city === 'All') && (!state || state === 'All' || l.state === state)); if (city && city !== 'All') locations = runtime.locations.filter(l => l.city === city && (!state || state === 'All' || l.state === state)); const scenario = { dryDays: Number(dryDays) || undefined, rainfall }; res.json({ locations: locations.map(l => scoreLocation(l, scenario)).sort((a,b) => b.riskScore-a.riskScore), actions: runtime.actions, observations: runtime.observations, updatedAt: runtime.updatedAt, coverage: 'Partial; seed and user-submitted records are labeled.' }); });
app.get('/api/weather', async (req, res) => { const lat = Number(req.query.lat || 20.5937); const lon = Number(req.query.lon || 78.9629); res.json(await weather(lat, lon)); });
app.get('/api/events', (req, res) => { res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`); clients.add(res); req.on('close', () => clients.delete(res)); });
app.post('/api/observations', upload.single('photo'), (req, res) => { const body = req.body || {}; if (!body.locationId || !body.type) return res.status(400).json({ error: 'locationId and type are required' }); const observation = { id: crypto.randomUUID(), locationId: body.locationId, type: body.type, severity: body.severity || 'moderate', notes: String(body.notes || '').slice(0, 1000), lat: Number(body.lat), lon: Number(body.lon), photo: req.file ? `/uploads/${req.file.filename}` : null, source: 'user-submitted', verification: 'pending', createdAt: new Date().toISOString() }; runtime.observations.push(observation); save(); broadcast('observation.created', observation); res.status(201).json(observation); });
app.post('/api/actions', (req, res) => { const { locationId, type, notes = '' } = req.body || {}; if (!locationId || !type) return res.status(400).json({ error: 'locationId and type are required' }); const action = { id: crypto.randomUUID(), locationId, type, notes: String(notes).slice(0, 1000), status: 'Pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; runtime.actions.unshift(action); save(); broadcast('action.updated', action); res.status(201).json(action); });
app.patch('/api/actions/:id', (req, res) => { const action = runtime.actions.find(a => a.id === req.params.id); if (!action) return res.status(404).json({ error: 'Action not found' }); action.status = req.body.status || action.status; action.updatedAt = new Date().toISOString(); save(); broadcast('action.updated', action); res.json(action); });
app.post('/api/chat', (req, res) => { const message = String(req.body?.message || '').trim().slice(0, 500); if (!message) return res.status(400).json({ error: 'Message required' }); const ranked = runtime.locations.map(l => scoreLocation(l)).sort((a,b) => b.riskScore-a.riskScore); const top = ranked[0]; const answer = message.toLowerCase().includes('why') || message.toLowerCase().includes('risk') ? `${top.name} is currently ranked ${top.riskScore}/100 (${top.level}). The estimate reflects dry-period accumulation, forecast rainfall scenario, paved exposure, traffic, construction, waste/blockage, and water-body proximity. Confidence is ${top.confidence}; this is a relative prioritisation estimate, not a laboratory measurement. Recommended action: ${top.recommendation}` : `The current highest-priority location is ${top.name} in ${top.city}, ${top.state}. Inspect it first, review the latest observation, and check the recommended action before rainfall. Data coverage is partial and records may be seed or pending verification.`; res.json({ answer, mode: 'local-grounded', source: 'Current application state', createdAt: new Date().toISOString() }); });
app.get('/api/report.csv', (_req, res) => { const rows = runtime.locations.map(l => scoreLocation(l)); const csv = ['id,name,city,state,riskScore,level,confidence,coverage,recommendation', ...rows.map(r => [r.id, r.name, r.city, r.state, r.riskScore, r.level, r.confidence, r.coverage, JSON.stringify(r.recommendation)].join(','))].join('\n'); res.type('text/csv').send(csv); });
app.use('/uploads', express.static(uploadDir));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
export { app };
if (process.env.AWS_LAMBDA_FUNCTION_NAME) { /* API Gateway adapter can wrap this app in deployment-specific tooling. */ }
else app.listen(port, () => console.log(`FirstFlush India running at http://localhost:${port}`));
