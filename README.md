# FirstFlush India

## Pre-rain runoff-risk prioritisation for urban water protection

FirstFlush India helps environmental teams prioritise drainage points before rainfall. It combines weather information with available location and field observations to produce an explainable action queue for inspection, cleaning, temporary screening where safe, sampling, or monitoring.

> FirstFlush India estimates relative runoff risk for prioritisation. It is not a laboratory water-quality monitoring system and does not claim exact pollutant concentrations.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/Yashwitha-valmiki/First_Flush.git
cd First_Flush
npm install
cp .env.example .env
npm start
```

Open `http://localhost:8787`.

Development mode:

```bash
npm run dev
```

Validation:

```bash
npm test
npm run lint
npm run build
```

If `package-lock.json` exists, prefer `npm ci` in CI.

## Configuration

`.env.example` contains safe local defaults. Copy it to `.env` only for local configuration. Do not commit `.env`, credentials, API keys, or private tokens.

The local adapter stores development state in `data/runtime.json` and uploaded evidence in `uploads/`. These files are ignored by Git. For a multi-user AWS deployment, replace them with DynamoDB and S3 adapters.

## Features

- Responsive command centre
- State and city filters
- Risk-ranked list and geographic map
- Live Open-Meteo weather with explicit source/mode/timestamp
- Explainable risk factors and confidence labels
- SSE updates with polling fallback
- Field observations and validated image uploads
- Action creation and status tracking
- Grounded local FirstFlush Copilot
- CSV priority report
- Amplify and SAM deployment configuration

## API

- `GET /api/health`
- `GET /api/state?state=&city=&dryDays=&rainfall=`
- `GET /api/weather?lat=&lon=`
- `GET /api/events`
- `POST /api/observations`
- `POST /api/actions`
- `PATCH /api/actions/:actionId`
- `POST /api/chat`
- `GET /api/report.csv`

## AWS deployment

The frontend is configured for AWS Amplify through `amplify.yml`. The API entry point is `lambda.js`, and `template.yaml` provides an AWS SAM/API Gateway deployment path.

```bash
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --guided --template-file .aws-sam/build/template.yaml
```

After deploying the API, set its API Gateway origin in `public/config.js` if the frontend and API are hosted separately:

```javascript
window.FIRSTFLUSH_CONFIG = {
  API_BASE_URL: 'https://your-api-id.execute-api.ap-south-1.amazonaws.com'
};
```

The current repository uses a local file adapter for development. Do not represent it as cloud persistence until DynamoDB/S3 adapters are configured and tested. Restrict production CORS to the Amplify domain and use least-privilege IAM policies.

## Limitations (important for demo claims)

- Current persistence is local (`data/runtime.json`, `uploads/`) for demo and local mode.
- No production authentication/authorization is implemented.
- Copilot responses are grounded local summaries, not live cloud LLM calls.
- Coverage is partial and based on seed + user-submitted records, not an official complete India-wide drain inventory.

## Data and safety

Location coverage is partial. Seed or estimated records, user submissions, pending verification, live weather, cached weather, and fallback weather are distinct states. Risk is a prioritisation estimate, not measured pollution. Physical drain work and sampling should only be performed by trained or authorised personnel.
