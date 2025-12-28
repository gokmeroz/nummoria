import { User } from "../models/user.js";

const ALLOWED_ROLES = new Set(["user", "admin"]);
const ALLOWED_SUBSCRIPTIONS = new Set(["Standard", "Plus", "Premium"]);

export async function adminSearchUsers(req, res) {
  try {
    const qRaw = (req.query.q || "").toString();
    const q = qRaw.trim();

    const limitParsed = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParsed)
      ? Math.min(Math.max(limitParsed, 1), 50)
      : 20;

    const pageParsed = Number.parseInt(req.query.page, 10);
    const page = Number.isFinite(pageParsed) ? Math.max(pageParsed, 1) : 1;

    const skip = (page - 1) * limit;

    // Default: include active only unless explicitly asked
    const includeInactive = req.query.includeInactive === "true";
    const filters = includeInactive ? {} : { isActive: true };

    // Optional filters (validated)
    if (req.query.role && ALLOWED_ROLES.has(req.query.role)) {
      filters.role = req.query.role;
    }
    if (
      req.query.subscription &&
      ALLOWED_SUBSCRIPTIONS.has(req.query.subscription)
    ) {
      filters.subscription = req.query.subscription;
    }
    if (req.query.isEmailVerified === "true") filters.isEmailVerified = true;
    if (req.query.isEmailVerified === "false") filters.isEmailVerified = false;

    const or = [];
    if (q) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(q);

      // Guard: avoid expensive scans for tiny queries (unless ObjectId)
      if (!isObjectId && q.length < 2) {
        return res.json({ page, limit, pages: 0, total: 0, items: [] });
      }

      if (isObjectId) or.push({ _id: q });

      const escaped = escapeRegex(q);

      // Prefer exact-ish email match when user pastes an email
      if (q.includes("@")) {
        or.push({ email: q.toLowerCase() });
      }

      // Starts-with is usually better than contains for search UX and perf
      or.push({ email: { $regex: `^${escaped}`, $options: "i" } });
      or.push({ name: { $regex: escaped, $options: "i" } });
    }

    const query = or.length ? { ...filters, $or: or } : filters;

    const [items, total] = await Promise.all([
      User.find(query)
        .select(
          "name email role subscription isActive isEmailVerified lastLogin createdAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit);

    res.json({ page, limit, pages, total, items });
  } catch (err) {
    console.error("adminSearchUsers failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function adminGetUserById(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select(
      "name email role profession tz baseCurrency avatarUrl avatarVersion subscription isActive isEmailVerified lastLogin createdAt emailVerifiedAt googleId githubId twitterId"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("adminGetUserById failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PATCH /admin/users/:id/deactivate
 * Sets isActive=false
 */
export async function adminDeactivateUser(req, res) {
  try {
    const { id } = req.params;

    // Safety: prevent admin from deactivating themselves
    const requesterId = req.user?._id?.toString?.() || req.user?.id;
    if (requesterId && requesterId.toString() === id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot deactivate your own account." });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    ).select(
      "name email role profession tz baseCurrency avatarUrl avatarVersion subscription isActive isEmailVerified lastLogin createdAt emailVerifiedAt googleId githubId twitterId"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("adminDeactivateUser failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PATCH /admin/users/:id/reactivate
 * Sets isActive=true
 */
export async function adminReactivateUser(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true }
    ).select(
      "name email role profession tz baseCurrency avatarUrl avatarVersion subscription isActive isEmailVerified lastLogin createdAt emailVerifiedAt googleId githubId twitterId"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("adminReactivateUser failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * DELETE /admin/users/:id/hard
 * Permanently deletes the user (irreversible)
 *
 * Recommended rules:
 * - cannot delete self
 * - optional: require user to be inactive first
 */
export async function adminHardDeleteUser(req, res) {
  try {
    const { id } = req.params;

    const requesterId = req.user?._id?.toString?.() || req.user?.id;
    if (requesterId && requesterId.toString() === id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account." });
    }

    const user = await User.findById(id).select("_id isActive email");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Strong safety default: require inactive first
    if (user.isActive !== false) {
      return res.status(400).json({
        message:
          "User must be deactivated before hard delete. Deactivate first, then try again.",
      });
    }

    await User.deleteOne({ _id: id });

    return res.json({ ok: true });
  } catch (err) {
    console.error("adminHardDeleteUser failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
