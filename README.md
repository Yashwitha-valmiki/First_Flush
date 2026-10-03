# FirstFlush India

## Pre-rain runoff-risk prioritisation for urban water protection

FirstFlush India helps environmental teams decide which drainage points should be inspected or protected before rainfall.

After a dry period, rainfall can carry road dust, oil residue, tyre and brake particles, litter, construction sediment, and animal waste into storm drains and nearby water bodies. FirstFlush India combines rainfall information with available drainage and field observations to produce an explainable priority list for preventive action.

> **FirstFlush India estimates relative runoff risk for prioritisation. It is not a laboratory water-quality monitoring system and does not claim exact pollutant concentrations.**

## Why this matters

Teams cannot inspect every drain before a rainfall event. Drain-level information may also be incomplete, fragmented, or outdated. FirstFlush India helps close the gap between:

```text
Rainfall forecast → Risk prioritisation → Field action
```

The platform helps users identify:

- Which drainage point should be inspected first
- Why that location has a higher estimated risk
- What preventive action is appropriate
- What observations and evidence support the recommendation
- Whether an action is still pending or has been completed

## How it works

```text
Weather information and local observations
                    ↓
        Explainable risk calculation
                    ↓
         Ranked drainage locations
                    ↓
          Recommended field action
                    ↓
     Observation, evidence, and status update
```

## Features

- Responsive environmental operations dashboard
- State and city filtering
- Risk-ranked location list
- Interactive map with drainage locations
- Weather provider status and update timestamp
- Live updates through Server-Sent Events with polling fallback
- Explainable relative-risk factors
- Field observation submission
- Optional image evidence upload
- Action tracking for inspection, cleaning, screening, sampling, and monitoring
- Pending-verification status for submitted observations
- FirstFlush Copilot grounded in current application data
- CSV priority report export
- Local fallback mode for development
- AWS deployment configuration

## Risk model

The current prioritisation model considers available signals such as:

- Dry-period duration
- Rainfall scenario
- Paved or impervious surface exposure
- Traffic exposure
- Construction activity
- Waste and blockage observations
- Proximity to a water body
- Observation availability and confidence

Each location receives:

- Risk score
- Risk level
- Contributing factors
- Confidence label
- Data-source and coverage label
- Recommended action
- Last-updated timestamp

The result is an operational estimate used to rank locations. It is not a measured pollution value.

## Data coverage

FirstFlush India is designed to support locations across India where usable data is available. It does not assume complete official drain-level coverage for every city.

The application distinguishes between:

- Seed or estimated location data
- User-submitted observations
- Pending verification
- Verified field data
- Live weather
- Cached weather
- Fallback weather
- Partial location coverage

This distinction is important because estimated or user-submitted information should not be presented as official infrastructure data.

## Run the application locally

### Requirements

- Node.js 20 or newer
- npm
- Internet access for live weather and map tiles

### Installation

```bash
git clone https://github.com/Yashwitha-valmiki/First_Flush.git
cd First_Flush
npm install
```

### Start the application

```bash
npm start
```

Open the application at:

```text
http://localhost:8787
```

The local server provides both the website and the API.

### Development mode

```bash
npm run dev
```

### Project checks

```bash
npm test
npm run lint
npm run build
```

## Configuration

The repository contains `.env.example` as a list of supported configuration names and safe local defaults.

To configure the application locally:

```bash
cp .env.example .env
```

Then change only the values required for your environment. The `.env` file is local configuration and is intentionally excluded from Git. Do not add passwords, private keys, cloud credentials, or API secrets to the repository.

The application can run locally without paid API credentials by using the configured weather fallback.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check API health and service status |
| `GET` | `/api/state` | Retrieve filtered and ranked locations |
| `GET` | `/api/weather` | Retrieve rainfall information and provider status |
| `GET` | `/api/events` | Connect to live update events |
| `POST` | `/api/observations` | Submit an observation with optional image evidence |
| `POST` | `/api/actions` | Create a field action |
| `PATCH` | `/api/actions/:actionId` | Update an action status |
| `POST` | `/api/chat` | Ask the FirstFlush Copilot |
| `GET` | `/api/report.csv` | Download the current priority report |

Example health check:

```bash
curl http://localhost:8787/api/health
```

Example filtered state request:

```bash
curl "http://localhost:8787/api/state?state=Karnataka&dryDays=18&rainfall=heavy"
```

## Deployment

### Frontend

The repository includes `amplify.yml` for AWS Amplify Hosting.

To deploy the frontend:

1. Push the repository to GitHub.
2. Open AWS Amplify Hosting.
3. Connect the repository `Yashwitha-valmiki/First_Flush`.
4. Select the `main` branch.
5. Review the build settings from `amplify.yml`.
6. Add deployment-specific configuration in the hosting environment.
7. Deploy and open the generated Amplify URL.

### API

The repository includes `template.yaml` for the AWS SAM deployment path.

After installing and configuring the AWS SAM CLI:

```bash
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --guided --template-file .aws-sam/build/template.yaml
```

If the frontend and API are deployed separately, configure the frontend to use the API Gateway URL.

### Development storage and production storage

Local development uses files under `data/` and `uploads/` so the project can run without cloud credentials.

For a multi-user production deployment, use:

- Amazon DynamoDB for locations, observations, actions, and audit records
- Amazon S3 for uploaded evidence and generated reports
- AWS Lambda and API Gateway for the API
- Amazon CloudWatch for logs and monitoring
- Amazon Cognito for authenticated roles
- Amazon SNS for optional notifications

Do not describe local file storage as cloud persistence. Configure and test the production adapters before treating the deployed system as a multi-user production service.

## Repository structure

```text
.
├── data/              Seed location data and local runtime files
├── public/            Frontend HTML, CSS, JavaScript, and configuration
├── test/              Automated tests
├── scripts/           Build and validation scripts
├── server.js          Express API and local server
├── lambda.js          Serverless API handler
├── template.yaml      AWS SAM configuration
├── amplify.yml        AWS Amplify build configuration
├── .env.example       Safe configuration template
├── .gitignore         Local and generated file exclusions
└── package.json       Scripts and dependencies
```

## Responsible use

FirstFlush India is a decision-support tool. It does not replace environmental professionals, laboratory testing, emergency services, or municipal procedures.

- Risk scores are estimates.
- Drain coverage is partial.
- Some records may require verification.
- Weather data may be stale or unavailable.
- Physical drain work and water sampling should only be performed by trained or authorised personnel.
- The platform does not guarantee flood prevention or pollution reduction.

## Project status

FirstFlush India is an Environmental Hacks project focused on turning pre-rain environmental information into a clear, explainable, and actionable drainage-priority workflow.
