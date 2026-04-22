<div align="center">

# Nummoria

**AI-Powered Personal Finance Platform**

**Live → [nummoria.com](https://nummoria.com) · License: MIT · Node.js 18+ · React 18**

*Take control of your financial life — expenses, investments, and AI-driven insights, all in one terminal.*

</div>

---

## Overview

Nummoria is a full-stack personal finance platform with a **React web app**, **React Native mobile app**, and an **Express/MongoDB backend**. It gives you a unified view of your financial life — income, expenses, multi-currency accounts, investment portfolios — augmented by an AI financial agent that surfaces personalized insights and predictions.

The interface follows a **Neural Finance Terminal** design language: near-black backgrounds, neon mint/cyan/violet accents, and a data-dense layout that feels native to people who live in dashboards.

---

## ✨ Features

### 🔐 Authentication
- Email/password with JWT
- Google OAuth (auto-login after signup)
- Twitter/X & GitHub OAuth

### 👤 User Profiles
- Name, profession, timezone, base currency
- Profile photo upload

### 💳 Accounts
- Checking, savings, credit, cash, investment accounts
- Full multi-currency support

### 💸 Transactions
- Income, expenses, and investment transactions
- Category management (system + custom)
- Recurring transactions — daily, weekly, monthly, yearly
- Reminder scheduling via Bull/Redis job queue

### 📊 Reports & Dashboards
- Totals by category, currency, or account
- Pie charts, bar charts, trend lines
- Cross-account net worth tracking

### 📈 Investments
- Track stocks, crypto, gold, real estate, land
- Units + symbols (e.g. `AAPL`, `BTC-USD`)
- Upcoming & recurring investment plans

### 🤖 AI Financial Expert Agent *(in progress)*
- Personalized insights & spending predictions
- Smart budgeting and savings recommendations
- Natural language querying over your financial data

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Web Frontend** | React 18, Vite, TailwindCSS, React Router |
| **Mobile** | React Native, Expo |
| **Backend** | Node.js, Express, MongoDB, Mongoose |
| **Auth** | JWT, Google/GitHub/Twitter OAuth |
| **Job Queue** | Bull + Redis (recurring reminders) |
| **AI** | Anthropic Claude API |
| **Deployment** | Vercel (web) · Railway (API) · MongoDB Atlas |
| **Tooling** | ESLint, Prettier, Docker (local DB) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>=18`
- MongoDB (local or Atlas URI)
- Redis (required for recurring reminders — can be stubbed for local dev)

### 1. Clone

```bash
git clone https://github.com/gokmeroz/nummoria.git
cd nummoria
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # Fill in MONGO_URI, JWT_SECRET, OAuth credentials, Redis URL
npm run dev            # Starts on http://localhost:4000
```

### 3. Web Frontend

```bash
cd frontend
npm install
npm run dev            # Starts on http://localhost:5173
```

### 4. Mobile (optional)

```bash
cd mobile
npm install
npx expo start         # Scan QR with Expo Go or run on simulator
```

> **Tip:** If Redis is unavailable locally, the reminder scheduler will gracefully no-op — set `SKIP_REMINDERS=true` in your `.env` to bypass the job queue entirely.

---

## 📂 Project Structure

```
nummoria/
├── backend/                        # Express + MongoDB API
│   ├── src/
│   │   ├── models/                 # Mongoose schemas (User, Account, Transaction, Investment)
│   │   ├── controllers/            # Route controllers (auth, accounts, transactions, reports)
│   │   ├── routes/                 # Express routers
│   │   ├── jobs/                   # Bull job definitions (reminder scheduling)
│   │   └── lib/                    # Middleware, error handling, utilities
│   └── server.js
│
├── frontend/                       # React (Vite + TailwindCSS)
│   ├── src/
│   │   ├── pages/                  # Dashboard, Expenses, Investments, Reports, Auth
│   │   ├── components/             # Charts, Header, Sidebar, modals
│   │   ├── lib/                    # Axios instance, helpers
│   │   └── App.jsx
│   └── index.html
│
├── mobile/                         # React Native (Expo)
│   ├── src/
│   │   ├── screens/                # DashboardScreen, ExpensesScreen, etc.
│   │   ├── components/             # Shared mobile components
│   │   └── lib/                    # API client, navigation
│   └── App.js
│
├── .env.example
├── README.md
└── LICENSE
```

---

## 🌐 Deployment Architecture

```
Browser / iOS / Android
        │
        ▼
  Vercel (React)          Expo Go / App Store (React Native)
        │                           │
        └───────────┬───────────────┘
                    ▼
           Railway (Express API)
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   MongoDB Atlas          Redis (Bull)
```

---

## 📜 License

MIT © 2025 [Göktuğ Mert Özdoğan](https://github.com/gokmeroz)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
