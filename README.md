
# Nummora – Personal Finance Tracker  
🚀 A modern **full-stack** personal finance app with **Node.js + Express + MongoDB** backend and **React (Vite + TailwindCSS)** frontend.  

Track your **income, expenses, and investments**, manage categories, and get financial summaries – all in one place.  

---

## ✨ Features
- 🔑 **User Authentication** with JWT (register/login/logout)  
- 🏦 Manage **Accounts** (create, update, soft delete, hard delete)  
- 💸 Track **Income, Expenses, Investments**  
- 🗂 **Categories** for better organization  
- 🔒 Secure password hashing with bcrypt  
- 📊 Financial summaries (total income, total expense, investment breakdowns)  
- 🛠 **Soft delete & isActive filtering** for clean data management  
- 📱 React frontend with TailwindCSS  

---

## 🏗 Tech Stack
**Frontend:** React (Vite), TailwindCSS, Axios  
**Backend:** Node.js, Express, JWT, bcrypt  
**Database:** MongoDB + Mongoose ODM  
**Tools:** Docker (optional for DB), Postman (API testing)  

---

## 📂 Project Structure
```

nummora/
│── backend/          # Express API
│   ├── models/       # Mongoose schemas
│   ├── routes/       # API endpoints
│   └── controllers/  # Business logic
│
│── frontend/         # React (Vite + TailwindCSS)
│   ├── src/
│   │   ├── pages/        # Screens (Dashboard, Expenses, Investments, etc.)
│   │   ├── components/   # Reusable UI
│   │   └── lib/          # API service (Axios)
│
└── README.md

````

---

## 🚀 Getting Started

### 1️⃣ Clone the repo
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
````

### 2️⃣ Backend Setup

cd backend
npm install
cp .env.example .env   # update MONGO_URI, JWT_SECRET, etc.
npm run dev
```

### 3️⃣ Frontend Setup

cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables

Backend `.env` example:

```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
PORT=5000
```

---

## 🛣 Roadmap

* [ ] Multi-currency support
* [ ] Export transactions (CSV/Excel)
* [ ] AI-powered expense categorization
* [ ] Mobile app (React Native)

---

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

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

---

```
