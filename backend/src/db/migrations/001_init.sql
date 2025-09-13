-- users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  base_currency VARCHAR(3) DEFAULT 'USD',
  tz TEXT DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW()
);

-- accounts table
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cash','bank','card','wallet')) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id INT REFERENCES categories(id),
  kind TEXT CHECK (kind IN ('income','expense')) NOT NULL,
  color TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- transactions table
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('income','expense','transfer')) NOT NULL,
  amount_minor INT NOT NULL, -- cents
  currency VARCHAR(3) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
