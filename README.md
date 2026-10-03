# FirstFlush India

**Pre-rain runoff-risk prioritisation for local water protection.**

FirstFlush India helps field teams decide which drainage points deserve inspection, cleaning, temporary screening where safe, sampling, or monitoring before rainfall. It estimates *relative first-flush runoff risk* using weather, dry-period duration, surface exposure, local observations, and proximity to water bodies. It is not a laboratory water-quality measurement and does not claim complete nationwide drain coverage.

## What is included

- Responsive command centre with live/fallback/offline status
- India location, state, and city filters
- Geographic map-style view with risk markers and accessible list view
- Live Open-Meteo forecast adapter with explicit source and timestamp
- Explainable risk scoring and confidence labels
- Field observation submission with optional photo evidence
- Persistent local action tracking and event stream
- FirstFlush Copilot grounded in current records with deterministic fallback
- CSV report export and print-friendly report
- AWS Amplify frontend configuration and SAM API template

## Run locally

```bash
npm install
npm start
# open http://localhost:8787
```

Optional: copy `.env.example` to `.env`. The app works without API keys. Local data is stored in `data/runtime.json` and uploads in `uploads/`; these are development fallbacks, not production storage.

## API

- `GET /api/health`
- `GET /api/state?city=&state=`
- `GET /api/weather?lat=&lon=`
- `POST /api/observations` (JSON or multipart with `photo`)
- `POST /api/actions`
- `POST /api/chat`
- `GET /api/report.csv`
- `GET /api/events` (SSE)

## AWS path

For a real deployment, host the frontend with Amplify and deploy the API with API Gateway/Lambda using `template.yaml`. Replace the local JSON store with DynamoDB and uploads with S3 before multi-user production use. Keep provider/source/mode labels visible. Optional Bedrock and SNS adapters should be added server-side only; the local Copilot fallback keeps the product usable without credentials.

## Data honesty

Seed records are explicitly marked `seed`. User records are `pending-verification`. Weather is labeled `live`, `cached`, `fallback`, or `offline`. Risk is a prioritisation estimate, not measured pollution. Drain coverage is partial.

## Demo flow

1. Open the command centre and show weather/source status.
2. Change the dry spell or rainfall scenario; priorities recalculate.
3. Open the top location and inspect factor explanations.
4. Submit a blocked-drain observation with a photo.
5. Record an inspection or cleaning action.
6. Ask Copilot why the location is high risk.
7. Export the current priority report.

## Safety

Only trained or authorised personnel should perform physical drain interventions or collect samples. The product recommends and records actions; it does not control infrastructure.
