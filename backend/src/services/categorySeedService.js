import { Category } from "../models/category.js";

const EXPENSE_CATEGORIES = [
  "Rent",
  "Housing Payments & Maintenance",
  "Debt Payments",
  "Transportation",
  "Health & Medical",
  "Utilities",
  "Groceries",
  "Dining Out",
  "Education",
  "Miscellaneous",
  "Entertainment",
  "Travel",
  "Gifts & Donations",
  "Personal Care",
  "Shopping",
  "Subscriptions",
  "Taxes",
  "Insurance",
  "Business Expenses",
  "Other Expense",
];
const INCOME_CATEGORIES = [
  "Salary",
  "Rentals",
  "Business Income & Freelance",
  "Dividends",
  "Other Income",
];
const INVESTMENT_CATEGORIES = [
  "Stock Market",
  "Crypto Currency Exchange",
  "Foreign Currency Exchange",
  "Gold",
  "Real Estate Investments",
  "Land Investments",
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
  if (!userId) {
    throw new Error("seedDefaultCategoriesForUser requires userId");
  }

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
