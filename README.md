<div align="center">

<img src="frontend/src/assets/nummoria_logo.png" alt="Nummoria Logo" width="72" />

# Nummoria

**Open-source AI-powered personal finance platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Expo](https://img.shields.io/badge/Expo-54-black)](https://expo.dev)

**Live demo → [nummoria.com](https://nummoria.com)**

*Track expenses, income, and investments. Ask your AI advisor anything about your money — and get answers grounded in your actual transactions.*

</div>

---

## What is Nummoria?

Nummoria is a full-stack personal finance platform with three layers:

- **Web app** (React + Vite) — dashboards, reports, charts, AI chat
- **Mobile app** (React Native + Expo) — iOS & Android, receipt scanner, push notifications
- **Backend API** (Node.js + Express + MongoDB) — auth, transactions, AI agent, market data

The design language is "Neural Finance Terminal" — near-black backgrounds, neon mint/cyan/violet accents, data-dense layouts.

Fork it, self-host it, extend it. MIT licensed.

---

## Features

| Area | What it does |
|---|---|
| **Auth** | Email/password + Google, GitHub, Twitter/X, Apple (iOS) OAuth |
| **Accounts** | Checking, savings, credit, cash, investment — multi-currency |
| **Transactions** | Income, expenses, investments — categories, recurring, reminders |
| **Reports** | Totals by category/account/currency, pie charts, trend lines, net worth |
| **Investments** | Stocks, crypto, gold, real estate — units, symbols, P&L |
| **AI Advisor** | Chat with Gemini or GPT-4o about your actual transactions |
| **Receipt Scanner** | Scan barcodes or photos — OCR extracts and pre-fills expense forms |
| **Push Notifications** | Expo-powered — reminders for recurring transactions |
| **Admin** | User management, activity audit log |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Web Frontend** | React 19, Vite, React Router 7 |
| **Mobile** | React Native 0.81, Expo 54, Expo Camera, ML Kit OCR |
| **Backend** | Node.js 22, Express, MongoDB + Mongoose |
| **Auth** | JWT, Google / GitHub / Twitter / Apple OAuth |
| **AI** | Google Gemini 2.5 Flash (default) or OpenAI GPT-4o-mini |
| **Market Data** | Financial Modeling Prep (FMP) API |
| **Email** | Gmail OAuth API (transactional) |
| **Job Queue** | Bull + Redis (recurring reminders, push worker) |
| **Deployment** | Vercel (web) · Railway (API) · MongoDB Atlas |

---

## Project Structure

```
nummoria/
├── backend/
│   └── src/
│       ├── ai/                  # Prompts, metrics, PDF parser, financial helper
│       ├── controllers/         # Auth, transactions, AI advisor, receipts, admin
│       ├── models/              # Mongoose schemas — User, Account, Transaction, etc.
│       ├── routes/              # Express routers
│       ├── utils/               # JWT, consent, registration token helpers
│       ├── workers/             # Bull push notification worker
│       └── server.js
│
├── frontend/
│   └── src/
│       ├── pages/               # Dashboard, Expenses, Income, Investments,
│       │                        # Reports, FinancialAdvisor, Login, ...
│       ├── components/          # Charts, nav, modals, shared UI
│       └── lib/                 # Axios instance
│
├── mobile/
│   └── src/
│       ├── screens/             # Dashboard, Expenses, Income, Investments,
│       │                        # FinancialAdvisor, ScanReceipt, Login, ...
│       ├── components/          # DashboardMenuFab, TutorialOverlay, ...
│       ├── navigation/          # MainStack (post-auth navigator)
│       ├── notifications/       # Expo push token registration
│       └── lib/                 # Axios instance (points to API_URL)
│
├── README.md
└── LICENSE
```

---

## Self-Hosting Guide

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x | `node -v` to check |
| MongoDB | Any | Local, Docker, or [MongoDB Atlas](https://cloud.mongodb.com) (free tier works) |
| Redis | Any | Required for recurring reminders. [Upstash](https://upstash.com) has a free tier |
| Git | Any | |

Optional (for AI features):
- [Google Gemini API key](https://aistudio.google.com/app/apikey) — free tier available
- [OpenAI API key](https://platform.openai.com/api-keys) — pay-as-you-go

---

### 1. Clone the repo

```bash
git clone https://github.com/gokmeroz/nummoria.git
cd nummoria
```

---

### 2. Backend

#### Install & configure

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in the values — see the full reference below.

#### Run

```bash
npm run dev          # API on http://localhost:4000
```

To also run the push notification worker in parallel:

```bash
npm run dev:all
```

---

### 3. Web Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The frontend auto-proxies `/api/*` requests to `localhost:4000` in dev mode (configured in `vite.config.js`). No extra env vars needed for local development.

---

### 4. Mobile (iOS / Android)

```bash
cd mobile
npm install
npx expo start --go   # Scan the QR with Expo Go on your phone
```

Before running, set `API_URL` in `src/lib/api.js` to your backend:

```js
// src/lib/api.js
const API_URL = __DEV__
  ? "http://YOUR_LOCAL_IP:4000/api"   // e.g. 192.168.1.42:4000
  : "https://your-api-domain.com/api";
```

> Use your machine's **local network IP** (not `localhost`) so your phone can reach it over Wi-Fi.

---

## Backend Environment Variables

Create `backend/.env` from the table below. Only the **Required** ones are needed to get the app running — everything else unlocks specific features.

### Core (Required)

| Variable | Description | Example |
|---|---|---|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/nummoria` or Atlas URI |
| `JWT_SECRET` | Secret for signing JWTs — any long random string | `openssl rand -hex 32` |
| `REGISTRATION_TOKEN_SECRET` | Secret for encrypting registration tokens | `openssl rand -hex 32` |
| `PORT` | Port the API listens on | `4000` |
| `NODE_ENV` | Environment | `development` or `production` |
| `FRONTEND_URL` | Your web app's URL (used for CORS & OAuth redirects) | `http://localhost:5173` |
| `APP_URL` | Same as FRONTEND_URL | `http://localhost:5173` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |

### Google OAuth (for "Sign in with Google")

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add your frontend URL to **Authorized JavaScript origins** and your redirect URI to **Authorized redirect URIs**

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | e.g. `http://localhost:4000/api/auth/google/callback` |

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new) → **New OAuth App**
2. Set **Authorization callback URL** to your redirect URI

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_REDIRECT_URI` | e.g. `http://localhost:4000/api/auth/github/callback` |

### Twitter / X OAuth

1. Go to [developer.twitter.com](https://developer.twitter.com) → Create a project and app
2. Enable **OAuth 2.0** and set the callback URL

| Variable | Description |
|---|---|
| `TWITTER_CLIENT_ID` | Twitter OAuth 2.0 Client ID |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth 2.0 Client Secret |
| `TWITTER_REDIRECT_URI` | e.g. `http://localhost:4000/api/auth/twitter/callback` |
| `TWITTER_CLIENT_TYPE` | `confidential` |
| `X_API_KEY` | Twitter API Key (v1.1) |
| `X_API_KEY_SECRET` | Twitter API Key Secret (v1.1) |

### Apple Sign-In (iOS only)

1. Go to [Apple Developer Portal](https://developer.apple.com) → **Certificates, IDs & Profiles → Keys**
2. Create a **Sign in with Apple** key, download the `.p8` file

| Variable | Description |
|---|---|
| `APPLE_CLIENT_ID` | Your Services ID (e.g. `com.yourapp.web`) |
| `APPLE_TEAM_ID` | Your 10-character Apple Team ID |
| `APPLE_KEY_ID` | The Key ID from the downloaded key |
| `APPLE_PRIVATE_KEY_BASE64` | Contents of the `.p8` file, base64 encoded: `base64 -i AuthKey_XXXX.p8` |
| `APPLE_REDIRECT_URI` | e.g. `https://your-api-domain.com/api/auth/apple/callback` |
| `APPLE_IOS_BUNDLE_ID` | Your iOS bundle ID (e.g. `com.yourapp.ios`) |
| `APPLE_ALLOWED_AUDIENCES` | Comma-separated — your client ID and bundle ID |

### Email — Gmail OAuth (for verification emails)

Nummoria sends verification emails via Gmail's API using OAuth (more reliable than SMTP app passwords).

1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground)
2. Click ⚙️ → **Use your own OAuth credentials** → paste your Google Client ID & Secret
3. Select scope `https://mail.google.com/` → **Authorize APIs**
4. Click **Exchange authorization code for tokens** → copy the **Refresh token**

| Variable | Description |
|---|---|
| `GMAIL_API_CLIENT_ID` | Same Google Client ID as OAuth above |
| `GMAIL_API_CLIENT_SECRET` | Same Google Client Secret |
| `GMAIL_API_REFRESH_TOKEN` | Refresh token from OAuth Playground |
| `GMAIL_API_REDIRECT_URI` | `https://developers.google.com/oauthplayground` |
| `GMAIL_SENDER` | The Gmail address that sends emails |
| `MAIL_FROM` | Display name + address e.g. `Nummoria <you@gmail.com>` |
| `FORCE_EMAIL_SEND` | Set `true` in production to actually send emails. Leave unset locally — verification codes print to console instead. |

> **Tip:** Gmail refresh tokens expire if unused for 6 months. Regenerate via OAuth Playground if you get `invalid_grant` errors.

### AI Financial Advisor

Pick **one** AI provider (Gemini is free to start):

**Option A — Google Gemini (recommended, free tier)**

1. Get an API key at [aistudio.google.com](https://aistudio.google.com/app/apikey)

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key |
| `FINANCIAL_HELPER_AGENT` | `gemini` |

**Option B — OpenAI GPT-4o-mini**

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `FINANCIAL_HELPER_AGENT` | `openai` |

> If neither key is set, the AI advisor falls back to a rule-based response engine — the app still works, just without LLM responses.

### Market Data (for Investment Performance)

1. Sign up free at [financialmodelingprep.com](https://financialmodelingprep.com)
2. Copy your API key from the dashboard

| Variable | Description |
|---|---|
| `FMP_API_KEY` | Financial Modeling Prep API key |

### Redis / Bull (for recurring reminders & push notifications)

| Variable | Description | Example |
|---|---|---|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` or Upstash URL |

> If Redis is unavailable, set `SKIP_REMINDERS=true` to disable the job queue and run the app without it.

### Rate Limiting (optional, has sensible defaults)

| Variable | Default | Description |
|---|---|---|
| `RATE_MAX` | `100` | Requests per window (general) |
| `RATE_WINDOW_MS` | `900000` | Window duration in ms (15 min) |
| `RATE_LOGIN_MAX` | `10` | Max login attempts per window |
| `RATE_AI_MAX` | `20` | Max AI advisor requests per window |
| `RATE_CONTACT_MAX` | `5` | Max contact form submissions |

### Development Shortcuts

| Variable | Description |
|---|---|
| `AUTH_SKIP_EMAIL_VERIFICATION` | Set `true` to bypass email verification in dev |
| `DEBUG_VERIFY` | Set `true` to print verification codes to console |
| `DEV_VERIFICATION_CODE` | Fixed code to use instead of random one during dev |

---

## Deployment

### Recommended stack (all have free tiers)

| Service | What it hosts | Free tier |
|---|---|---|
| [Vercel](https://vercel.com) | Web frontend | Yes |
| [Railway](https://railway.app) | Backend API | Yes ($5/mo hobby) |
| [MongoDB Atlas](https://cloud.mongodb.com) | Database | Yes (512 MB) |
| [Upstash](https://upstash.com) | Redis | Yes |
| [Expo](https://expo.dev) | Mobile builds & OTA | Yes |

### Deployment checklist

```
□ Set NODE_ENV=production in Railway
□ Set MONGO_URI to Atlas connection string
□ Set REDIS_URL to Upstash URL
□ Set FRONTEND_URL and CORS_ORIGINS to your Vercel domain
□ Set FORCE_EMAIL_SEND=true if you want real emails
□ Set GEMINI_API_KEY (or OPENAI_API_KEY) + FINANCIAL_HELPER_AGENT
□ Set all OAuth redirect URIs to production URLs
□ Set JWT_SECRET and REGISTRATION_TOKEN_SECRET to long random strings
```

### Architecture

```
Browser / iOS / Android
        │
        ▼
Vercel (React web)        Expo Go / App Store (React Native)
        │                           │
        └───────────┬───────────────┘
                    ▼
           Railway (Express API)
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
    MongoDB Atlas  Redis   Gmail API
                  (Bull)   (emails)
```

---

## Running with Docker (local MongoDB + Redis)

If you don't want to install MongoDB and Redis locally:

```bash
# Start MongoDB + Redis with Docker Compose
docker compose up -d

# Then set in backend/.env:
# MONGO_URI=mongodb://localhost:27017/nummoria
# REDIS_URL=redis://localhost:6379
```

Create a `docker-compose.yml` in the root:

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
volumes:
  mongo_data:
```

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a PR against `main`

---

## License

MIT © 2025 [Göktuğ Mert Özdoğan](https://github.com/gokmeroz)

Use it, fork it, ship your own version. That's the point.
