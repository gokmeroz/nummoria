# Nummora – Personal Finance Tracker

Nummora is a full-stack personal finance application that helps you manage **expenses, income, investments, and accounts** in one place.  
It’s built for clarity, control, and insights — with support for multi-currency, recurring transactions, and AI-powered analysis (coming soon).

---

## ✨ Features

- 🔑 **Authentication**
  - Email + password login
  - Google OAuth (auto-login after signup)
  - (Planned) Facebook & LinkedIn login
- 👤 **User Profiles**
  - Name, profession, timezone, base currency
  - Profile photo upload
- 💳 **Accounts**
  - Checking, savings, credit, cash, and more
  - Multi-currency support
- 💸 **Transactions**
  - Income, expenses, and investments
  - Categories with custom management
  - Recurring transactions (daily, weekly, monthly, yearly)
- 📊 **Reports & Dashboards**
  - Totals by category, currency, or account
  - Pie charts, bar charts, and trends
- 📈 **Investments**
  - Track stock, crypto, gold, real estate, land
  - Units + symbols (e.g. AAPL, BTC-USD)
  - Upcoming/recurring investment plans
- 🔮 **(Upcoming)** AI Financial Expert Agent
  - Personalized insights & predictions
  - Smart budgeting and savings recommendations

---

## 🛠️ Tech Stack

**Frontend**
- React + Vite  
- React Router  
- TailwindCSS  

**Backend**
- Node.js + Express  
- MongoDB + Mongoose  
- JWT Auth + OAuth (Google integrated)  

**Other**
- Docker (optional for DB)  
- ESLint + Prettier  

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/gokmeroz/nummora.git
cd nummora
2️⃣ Backend Setup
cd backend
npm install
cp .env.example .env   # update MONGO_URI, JWT_SECRET, etc.
npm run dev
3️⃣ Frontend Setup
cd frontend
npm install
npm run dev

Frontend → http://localhost:5173
Backend → http://localhost:4000

## 📂 Project Structure
nummora/
├── backend/
│   ├── src/
│   │   ├── models/        # Database schemas
│   │   ├── controllers/   # API controllers
│   │   ├── routes/        # Express routes
│   │   └── lib/           # Middleware & helpers
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── pages/         # React pages (Login, Dashboard, Investments…)
│   │   ├── components/    # Reusable UI components
│   │   ├── lib/           # API client & utilities
│   │   └── App.jsx
│   └── index.html
└── README.md

## 📜 MIT License

Copyright (c) 2025 Göktuğ Mert Özdoğan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

MIT License – free to use and modify.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
