// backend/src/controllers/adminUserController.js
import "../config/env.js"; // keep early so env is loaded
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { User } from "../models/user.js";
import { Account } from "../models/account.js";

/* ───────────────────────── Mail / URLs ───────────────────────── */

const FRONTEND_URL_RAW = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, "");

const transporter = (() => {
  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  if (url || host) {
    return nodemailer.createTransport(
      url
        ? url
        : {
            host,
            port: port || 587,
            secure: !!secure,
            auth: user && pass ? { user, pass } : undefined,
          }
    );
  }

  // Dev-only console fallback (no real emails)
  return {
    sendMail: async (opts) => {
      console.log("[MAIL:DEV-FALLBACK] Not sending real email.", {
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
      });
      return { messageId: `dev-${Date.now()}` };
    },
  };
})();

const MAIL_FROM = process.env.MAIL_FROM || "Nummoria <no-reply@nummoria.app>";

async function sendMail({ to, subject, text, html }) {
  return transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
}

function makeVerificationCode() {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

function buildVerifyEmailMessage({ email, code }) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(
    email
  )}`;
  const subject = "Verify your email for Nummoria";
  const text = `Your Nummoria verification code is ${code}. It expires in 15 minutes.\n\nOpen: ${verifyUrl}`;
  const html = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
      <h2>Verify your email</h2>
      <p>Your Nummoria verification code is:</p>
      <div style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</div>
      <p style="color:#666">This code expires in 15 minutes.</p>
      <p><a href="${verifyUrl}" target="_blank" rel="noopener">Open verification page</a></p>
    </div>
  `;
  return { subject, text, html };
}

/* ───────────────────────── Validation helpers ───────────────────────── */

const ALLOWED_ROLES = new Set(["user", "admin"]);
const ALLOWED_SUBSCRIPTIONS = new Set(["Standard", "Plus", "Premium"]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActorId(req) {
  const v = req?.user?._id || req?.user?.id || req?.auth?._id || req?.auth?.id;
  return v ? String(v) : null;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

/* ───────────────────────── Users list / detail ───────────────────────── */

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

    const includeInactive = req.query.includeInactive === "true";
    const filters = includeInactive ? {} : { isActive: true };

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

      if (!isObjectId && q.length < 2) {
        return res.json({ page, limit, pages: 0, total: 0, items: [] });
      }

      if (isObjectId) or.push({ _id: q });

      const escaped = escapeRegex(q);

      if (q.includes("@")) {
        or.push({ email: q.toLowerCase() });
      }

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

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id).select(
      "name email role profession tz baseCurrency avatarUrl avatarVersion subscription isActive isEmailVerified emailVerifiedAt lastLogin createdAt googleId githubId twitterId"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err) {
    console.error("adminGetUserById failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
// Admin: get accounts of a user
export async function adminGetUserAccounts(req, res) {
  try {
    const { id } = req.params;
    const includeInactive = req.query.includeInactive === "true";

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const userExists = await User.exists({ _id: id });
    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    const query = {
      userId: id,
      ...(includeInactive ? {} : { isDeleted: false }),
    };

    const accounts = await Account.find(query)
      .select(
        "name type balance currency institution last4 isDeleted createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ accounts });
  } catch (err) {
    console.error("adminGetUserAccounts failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/* ───────────────────────── lifecycle actions ───────────────────────── */

export async function adminDeactivateUser(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const actorId = getActorId(req);
    if (actorId && actorId === String(id)) {
      return res
        .status(400)
        .json({ message: "You cannot deactivate yourself" });
    }

    const user = await User.findById(id).select(
      "name email role subscription isActive isEmailVerified lastLogin createdAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isActive === false) {
      return res.status(400).json({ message: "User is already inactive" });
    }

    user.isActive = false;
    await user.save();

    return res.json({ user });
  } catch (err) {
    console.error("adminDeactivateUser failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function adminReactivateUser(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id).select(
      "name email role subscription isActive isEmailVerified lastLogin createdAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isActive !== false) {
      return res.status(400).json({ message: "User is already active" });
    }

    user.isActive = true;
    await user.save();

    return res.json({ user });
  } catch (err) {
    console.error("adminReactivateUser failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function adminHardDeleteUser(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const actorId = getActorId(req);
    if (actorId && actorId === String(id)) {
      return res
        .status(400)
        .json({ message: "You cannot permanently delete yourself" });
    }

    const user = await User.findById(id).select(
      "email role isActive createdAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isActive !== false) {
      return res.status(400).json({
        message:
          "User must be inactive before hard delete. Deactivate first, then delete.",
      });
    }

    if (user.role === "admin") {
      return res
        .status(403)
        .json({ message: "Admin users cannot be hard deleted" });
    }

    await User.deleteOne({ _id: user._id });

    return res.json({ ok: true });
  } catch (err) {
    console.error("adminHardDeleteUser failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/* ───────────────────────── Phase 1 actions ───────────────────────── */

// Resend verification for an existing (unverified) user
export async function adminResendVerification(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    // IMPORTANT: emailVerificationCodeHash is select:false in schema
    const user = await User.findById(id).select(
      "email name isEmailVerified +emailVerificationCodeHash +emailVerificationExpiresAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    const code = makeVerificationCode();
    user.emailVerificationCodeHash = await bcrypt.hash(code, 10);
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const { subject, text, html } = buildVerifyEmailMessage({
      email: user.email,
      code,
    });

    await sendMail({ to: user.email, subject, text, html });

    return res.json({ ok: true, message: "Verification code resent" });
  } catch (err) {
    console.error("adminResendVerification failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Force logout (invalidate all existing sessions)
export async function adminForceLogout(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const actorId = getActorId(req);
    if (actorId && actorId === String(id)) {
      return res
        .status(400)
        .json({ message: "You cannot force logout yourself" });
    }

    const user = await User.findById(id).select("_id authInvalidBefore");
    if (!user) return res.status(404).json({ message: "User not found" });

    user.authInvalidBefore = new Date();
    await user.save();

    return res.json({ ok: true, message: "User logged out everywhere" });
  } catch (err) {
    console.error("adminForceLogout failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Reset assist: send password reset link (same flow as forgotPassword)
export async function adminSendPasswordReset(req, res) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id).select("email name");
    if (!user) return res.status(404).json({ message: "User not found" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = await bcrypt.hash(rawToken, 10);
    user.resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      user.email
    )}`;

    await sendMail({
      to: user.email,
      subject: "Password reset",
      text: `Use this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes.`,
      html: `
        <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
          <h2>Password reset</h2>
          <p>Click the link below to reset your password (expires in 30 minutes):</p>
          <p><a href="${resetUrl}" target="_blank" rel="noopener">${resetUrl}</a></p>
        </div>
      `,
    });

    return res.json({ ok: true, message: "Password reset email sent" });
  } catch (err) {
    console.error("adminSendPasswordReset failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
// NEW: update subscription
export async function adminUpdateUserSubscription(req, res) {
  try {
    const { id } = req.params;
    const { subscription } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const allowed = new Set(["Standard", "Plus", "Premium"]);
    if (!allowed.has(subscription)) {
      return res.status(400).json({ message: "Invalid subscription plan" });
    }

    const user = await User.findById(id).select(
      "name email subscription isActive isEmailVerified lastLogin createdAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    user.subscription = subscription;
    await user.save();

    return res.json({
      ok: true,
      user: {
        _id: user._id,
        subscription: user.subscription,
      },
    });
  } catch (err) {
    console.error("adminUpdateUserSubscription failed:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
