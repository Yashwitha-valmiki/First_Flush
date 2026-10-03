# FirstFlush India

**Act before polluted runoff reaches the water.**

FirstFlush India is a real-time decision-support platform for prioritising urban drainage points before rainfall. After a dry period, rainfall can carry road dust, oil residue, tyre and brake particles, litter, construction sediment, and animal waste into storm drains and nearby water bodies.

The platform combines weather conditions with available drainage and field observations to help environmental teams decide:

- Which drainage point should be inspected first?
- Why is it high priority?
- What preventive action is appropriate?
- What evidence and confidence support the recommendation?

FirstFlush India is designed for the **Heat and Water** track of the **WeMakeDevs × AWS Environmental Hacks** hackathon.

> FirstFlush India estimates relative runoff risk for prioritisation. It does not measure laboratory water quality or claim exact pollutant concentrations.

## The problem

Environmental teams often cannot inspect every drainage point before a rainfall event. Drain-level information may also be incomplete, fragmented, or outdated. This creates a decision gap between a rainfall forecast and preventive field action.

FirstFlush India addresses that gap by producing an explainable, ranked priority list for available drainage observations across Indian locations.

## How it works

```text
Weather and local observations
              ↓
    Explainable risk calculation
              ↓
     Ranked drainage locations
              ↓
      Recommended field action
              ↓
 Observation, evidence, and status update
              ↓
       Updated priority information
```

## Core functionality

- Responsive environmental command centre
- State and city filtering
- Interactive risk map with an accessible location list
- Weather integration with explicit live, fallback, and offline status
- Automatic refresh and Server-Sent Events for state updates
- Explainable relative-risk scoring
- Field observation submission
- Optional image evidence upload with validation
- Action tracking for inspection, cleaning, temporary screening, sampling, and monitoring
- Pending-verification workflow for submitted observations
- FirstFlush Copilot with grounded local responses
- CSV priority report export
- Local fallback mode for development and unreliable external services
- AWS deployment configuration for the frontend and API

## Risk model

The current deterministic model considers available signals such as:

- Dry-period duration
- Rainfall scenario
- Paved or impervious surface exposure
- Traffic exposure
- Construction activity
- Waste and blockage observations
- Proximity to a water body
- Observation availability and confidence

Each location returns:

- Risk score
- Risk level
- Contributing factors
- Confidence label
- Data-source and coverage label
- Recommended action
- Last-updated timestamp

The score is a relative operational priority, not a scientific measurement of pollution.

## Data transparency

FirstFlush India supports Indian locations where data is available. It does not assume complete official drain-level coverage across the country.

Records and responses should be interpreted using their provenance labels, including:

- Seed or estimated data
- User-submitted observations
- Pending verification
- Verified field data
- Live weather
- Cached weather
- Fallback weather
- Partial location coverage

Estimated, seed, cached, and fallback information must not be presented as official or live measurements.

## Run locally

### Requirements

- Node.js 20 or newer
- npm

### Install

Clone the repository and enter the project directory:

```bash
git clone https://github.com/Yashwitha-valmiki/First_Flush.git
cd First_Flush
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

Start the application:

```bash
npm start
```

Open the website at:

```text
http://localhost:8787
```

The local application serves both the frontend and API from the same server.

### Development mode

Development mode restarts the server when files change:

```bash
npm run dev
```

### Available commands

```bash
npm start       # Start the local application
npm run dev     # Start with Node watch mode
npm test        # Run automated tests
npm run lint    # Run repository validation checks
npm run build   # Validate and prepare the static frontend bundle
```

### Local fallback storage

When running locally, the application uses:

- `data/runtime.json` for runtime records
- `uploads/` for uploaded evidence files

These files are intentionally ignored by Git. They are useful for development and demonstration, but they are not a suitable persistence layer for a multi-user production deployment.

## Environment variables

The project includes `.env.example`. Copy it to `.env` before local development.

```dotenv
PORT=8787
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:8787
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast
WEATHER_CACHE_TTL_MS=900000
MAX_UPLOAD_BYTES=5242880
API_BASE_URL=/api
AWS_REGION=ap-south-1
DYNAMODB_TABLE_NAME=
S3_BUCKET=
BEDROCK_MODEL_ID=
```

No API key is required for the Open-Meteo fallback used by local development. Keep cloud credentials and model keys on the server side. Never commit `.env` or secrets.

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns service health and update information |
| `GET` | `/api/state` | Returns filtered, ranked locations, actions, observations, and coverage status |
| `GET` | `/api/weather` | Returns rainfall information and provider mode |
| `GET` | `/api/events` | Opens the Server-Sent Events update stream |
| `POST` | `/api/observations` | Creates an observation with optional image evidence |
| `POST` | `/api/actions` | Creates a field action |
| `PATCH` | `/api/actions/:actionId` | Updates an action status |
| `POST` | `/api/chat` | Returns a grounded FirstFlush Copilot response |
| `GET` | `/api/report.csv` | Downloads the current priority report |

Example health check:

```bash
curl http://localhost:8787/api/health
```

Example state request:

```bash
curl "http://localhost:8787/api/state?state=Karnataka&dryDays=18&rainfall=heavy"
```

## AWS deployment

The repository includes:

- `amplify.yml` for frontend hosting with AWS Amplify
- `template.yaml` for the API deployment path using AWS SAM
- `.env.example` for environment configuration

### Frontend deployment with Amplify

1. Open AWS Amplify Hosting.
2. Connect the `Yashwitha-valmiki/First_Flush` GitHub repository.
3. Select the `main` branch.
4. Use the repository `amplify.yml` build settings.
5. Add production environment variables in Amplify if required.
6. Deploy the frontend.

### API deployment with AWS SAM

Install and configure the AWS SAM CLI, then run from the repository root:

```bash
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --guided --template-file .aws-sam/build/template.yaml
```

After deployment, configure the frontend API base URL with the API Gateway URL. For a separately hosted frontend, set `API_BASE_URL` or the equivalent public configuration to the deployed API origin.

### Production storage note

The local development adapter uses JSON and filesystem storage. For a multi-user production deployment, use:

- Amazon DynamoDB for locations, observations, actions, alerts, and audit records
- Amazon S3 for evidence images and generated reports
- AWS Lambda and API Gateway for API execution
- Amazon CloudWatch for logs and health monitoring
- Amazon Cognito for authenticated operator, verifier, and administrator access
- Amazon SNS for optional notifications

The repository must not claim cloud persistence until those production adapters are configured and tested in the AWS account.

## Hackathon submission notes

FirstFlush India is built for the **Heat and Water** track. Its environmental contribution is preventive prioritisation: converting rainfall and local drainage observations into a clear field-action queue before polluted runoff reaches nearby water bodies.

The project is intentionally transparent about its limitations:

- Drain coverage is partial.
- Some records may be estimated, seeded, or pending verification.
- Weather providers may be unavailable or stale.
- Risk scores are not laboratory measurements.
- The platform does not guarantee flood prevention or pollution reduction.
- Physical interventions require trained or authorised personnel.

## Repository structure

```text
.
├── data/              Seed location data and local runtime storage
├── public/            Frontend HTML, CSS, JavaScript, and configuration
├── test/              Automated API tests
├── scripts/           Build and lint validation scripts
├── server.js          Express API and local development server
├── lambda.js          Serverless handler entry point
├── template.yaml      AWS SAM deployment configuration
├── amplify.yml        AWS Amplify build configuration
├── .env.example       Documented environment variables
├── .gitignore         Ignored local and generated files
└── package.json       Project scripts and dependencies
```

## Safety and responsible use

FirstFlush India is a decision-support tool. It does not replace environmental professionals, laboratory testing, municipal procedures, or emergency services. Only trained or authorised personnel should perform drain interventions or collect water samples.
