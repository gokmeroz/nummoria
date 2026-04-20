export async function createTransactionCore({ userId, body }) {
  console.log("[CORE] step 1 - entered", body);

  const {
    accountId,
    categoryId,
    type,
    amountMinor,
    currency,
    date,
    nextDate,
    description,
    notes,
    tags,
    assetSymbol,
    units,
    reminder,
    frequency,
    endDate,
  } = body || {};

  console.log("[CORE] step 2 - destructured", {
    accountId,
    categoryId,
    type,
    amountMinor,
    currency,
    date,
    frequency,
    endDate,
  });

  if (!accountId || !type || currency == null || date == null) {
    console.log("[CORE] step 3 - missing required");
    throw new Error("accountId, type, currency, and date are required");
  }

  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    console.log("[CORE] step 4 - invalid accountId", accountId);
    throw new Error("Invalid accountId");
  }

  if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
    console.log("[CORE] step 5 - invalid categoryId", categoryId);
    throw new Error("Invalid categoryId");
  }

  console.log("[CORE] step 6 - before category lookup");

  let categoryDoc = null;
  if (categoryId) {
    categoryDoc = await Category.findOne({
      _id: categoryId,
      userId,
      isDeleted: { $ne: true },
    })
      .select("name kind")
      .lean();

    console.log("[CORE] step 7 - category lookup result", categoryDoc);

    if (!categoryDoc) throw new Error("Category not found");
  }

  console.log("[CORE] step 8 - before account lookup");
  const acct = await getAccountOrThrow({ accountId, userId });
  console.log("[CORE] step 9 - account found", acct);

  const cur = normalizeCurrency(currency);
  const when = startOfUTC(date);

  const baseDoc = {
    userId,
    accountId,
    categoryId: categoryId || null,
    type,
    amountMinor: Math.abs(amountMinor),
    currency: cur,
    date: when,
    nextDate: nextDate ? startOfUTC(nextDate) : undefined,
    description: description || null,
    notes: notes || null,
    tags: Array.isArray(tags) ? tags : [],
    assetSymbol:
      typeof assetSymbol === "string" && assetSymbol.trim()
        ? String(assetSymbol).toUpperCase().trim()
        : null,
    units:
      typeof units === "number" && !Number.isNaN(units) ? Number(units) : null,
    reminder: {
      enabled: false,
      offsetMinutes: 1440,
      remindAt: null,
    },
    isDeleted: false,
    frequency: frequency || undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  };

  console.log("[CORE] step 10 - before balance update");

  const delta = shouldAffectBalance(when)
    ? deltaFor(type, baseDoc.amountMinor)
    : 0;

  if (delta !== 0) {
    await incBalanceOrThrow({ accountId, userId, delta });
  }

  console.log("[CORE] step 11 - before Transaction.create");
  const doc = await Transaction.create(baseDoc);
  console.log("[CORE] step 12 - created", doc?._id?.toString?.());

  return { createdCount: 1, created: [doc.toObject()] };
}
