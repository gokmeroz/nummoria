import { Category } from "../models/category.js";

const EXPENSE_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Health",
  "Bills",
  "Shopping",
  "Entertainment",
  "Travel",
  "Education",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Rentals",
  "Business Income & Freelance",
  "Dividends",
  "Other Income",
];

const INVESTMENT_CATEGORIES = [
  "Stocks",
  "Crypto",
  "Funds / ETFs",
  "Bonds",
  "Gold & Precious Metals",
  "Real Estate",
  "Other Investments",
];

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function buildDefaults(userId) {
  return [
    ...EXPENSE_CATEGORIES.map((name) => ({
      userId,
      name,
      kind: "expense",
      isDeleted: false,
    })),
    ...INCOME_CATEGORIES.map((name) => ({
      userId,
      name,
      kind: "income",
      isDeleted: false,
    })),
    ...INVESTMENT_CATEGORIES.map((name) => ({
      userId,
      name,
      kind: "investment",
      isDeleted: false,
    })),
  ];
}

export async function seedDefaultCategoriesForUser(userId) {
  const defaults = buildDefaults(userId);

  const existing = await Category.find({
    userId,
    isDeleted: { $ne: true },
  }).select("_id name kind");

  const existingSet = new Set(
    existing.map((c) => `${c.kind}::${normalizeName(c.name)}`),
  );

  const missing = defaults.filter(
    (c) => !existingSet.has(`${c.kind}::${normalizeName(c.name)}`),
  );

  if (missing.length > 0) {
    await Category.insertMany(missing);
  }

  return {
    added: missing.length,
    existing: existing.length,
  };
}
