import api from "./api";

// POST /auto/transactions/text
export async function autoCreateFromText({
  accountId,
  text,
  type,
  date,
  currency, // ✅ NEW
  reminder,
}) {
  const res = await api.post(
    "/auto/transactions/text",
    {
      accountId,
      text,
      type,
      date,
      currency, // ✅ NEW
      reminder,
    },
    {
      // ✅ Optional but safe: force JSON for this endpoint
      headers: { "Content-Type": "application/json" },
    }
  );

  return res.data;
}
