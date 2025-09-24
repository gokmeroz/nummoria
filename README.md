Nice, broski 👌 Yours is already solid but a bit too backend-only. Since **Nummora** is now full-stack (backend + React frontend), I’d polish it into something more professional but still simple.

Here’s an **updated README.md** version you can drop in right away:

```markdown
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
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
````

### 2️⃣ Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # update MONGO_URI, JWT_SECRET, etc.
npm run dev
```

### 3️⃣ Frontend Setup

```bash
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

## 📜 License

MIT License – free to use and modify.

```

---

👉 Do you want me to also add **screenshot placeholders** (so it looks more portfolio-ready on GitHub) or keep it lean for now?
```
