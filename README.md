# FirstFlush India

> **Act before polluted runoff reaches the water.**

FirstFlush India is a real-time decision-support application for environmental teams. It ranks drainage points by **estimated relative first-flush runoff risk** before rainfall and turns that ranking into field actions such as inspection, cleaning, temporary screening where safe, sampling, or monitoring.

It does **not** claim laboratory-measured pollution, exact pollutant mass, guaranteed flood prevention, official municipal ownership, or complete nationwide drain coverage.

## Hackathon

Built for the **WeMakeDevs × AWS Environmental Hacks 2026 — Heat and Water track**. The product focuses on a specific operational gap: teams cannot inspect every drainage point before rain, so they need an explainable priority list.

## Product workflow

```text
Weather forecast + dry period + local exposure
                 ↓
       Relative risk calculation
                 ↓
       Ranked drainage locations
                 ↓
       Recommended preventive action
                 ↓
       Field observation and evidence
                 ↓
       Persistent action history and verification
                 ↓
       FirstFlush Copilot explanation
```

## Current implementation

- Responsive professional command centre
- State/city filters and ranked priority queue
- Latitude/longitude-aware Leaflet map with list fallback
- Open-Meteo forecast adapter with explicit live/fallback labels
- Explainable deterministic risk score and confidence level
- SSE updates plus 30-second polling fallback
- Field observations with validated image uploads
- Persistent local development store
- Action creation and status updates
- Grounded deterministic Copilot at `POST /api/chat`
- CSV report and print-friendly browser reporting
- Amplify frontend configuration
- AWS SAM template for API Gateway/Lambda, DynamoDB and private S3 evidence storage

## Local development

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:8787`.

Validation commands:

```bash
npm run lint   # if your local environment has ESLint configured
npm test
npm run build
```

The local fallback stores runtime records in `data/runtime.json` and uploaded files in `uploads/`. These paths are ignored by Git and are not suitable for multi-user production.

## Environment variables

See `.env.example`. No API key is required for the Open-Meteo fallback. Secrets for future Bedrock, Cognito, SNS, DynamoDB, or S3 adapters must remain server-side and must never be committed.

## API routes

- `GET /api/health` — service status
- `GET /api/state?city=&state=&dryDays=&rainfall=` — ranked locations and current actions
- `GET /api/weather?lat=&lon=` — provider, mode, rainfall and timestamp
- `GET /api/events` — Server-Sent Events stream
- `POST /api/observations` — multipart observation with optional `photo`
- `POST /api/actions` — create a field action
- `PATCH /api/actions/:id` — update action status
- `POST /api/chat` — grounded local Copilot response
- `GET /api/report.csv` — current priority report

## AWS deployment path

1. Deploy the frontend through Amplify using `amplify.yml`.
2. Install and configure AWS SAM CLI.
3. Build and deploy the API from the repository root:

```bash
sam build
sam deploy --guided
```

4. Set the deployed API base URL in the frontend deployment configuration if frontend and API are hosted separately.
5. For production, replace the local JSON adapter and filesystem uploads with the DynamoDB and S3 adapters. The SAM template provisions the core resources; application-specific repository adapters should be enabled before a multi-user launch.
6. Restrict `ALLOWED_ORIGIN` to the Amplify domain and configure least-privilege IAM policies.

The repository intentionally keeps a local fallback so the demo remains usable if AWS credentials or an external provider are unavailable. The UI must show `live`, `fallback`, `cached`, or `offline` instead of hiding the data mode.

## Data honesty and safety

Location coverage is partial. Seed records are labeled `seed`/`Estimated`; user observations are `pending-verification`. A risk score is a prioritization estimate, not a water-quality result. Only trained or authorized personnel should perform physical drain work or collect samples.

## Three-minute demo

1. Open the command centre and show provider/status labels.
2. Change dry days and rainfall scenario; watch the ranking update.
3. Open the top location and explain its factor breakdown.
4. Submit a blocked-drain observation with an image.
5. Create and update an inspection action.
6. Ask Copilot why the location is urgent.
7. Export the priority CSV and show the methodology disclaimer.

## License

Add the license required by your hackathon or team before submission. Do not claim official partnership or municipal endorsement without written permission.
