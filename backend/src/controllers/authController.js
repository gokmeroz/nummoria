import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer"; // 🔵 ADDED
import { User } from "../models/user.js";

/* ─────────────────────────── Config & Helpers ─────────────────────────── */

const FRONTEND_URL_RAW = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, "");
const IS_DEV = process.env.NODE_ENV !== "production";
const { JWT_SECRET } = process.env;

// Google env
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

// Twitter (X) env
const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_REDIRECT_URI,
  TWITTER_CLIENT_TYPE,
} = process.env;

// Github env
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI } =
  process.env;

// base64url helper (for PKCE)
function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function sha256ToBase64url(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64url(hash);
}

// ensure `next` stays a relative path (prevents broken URLs or open redirects)
function sanitizeNext(nextRaw) {
  if (!nextRaw) return "/";
  try {
    if (/^https?:\/\//i.test(nextRaw)) {
      const u = new URL(nextRaw);
      return (u.pathname || "/") + (u.search || "") + (u.hash || "");
    }
    return nextRaw.startsWith("/") ? nextRaw : "/" + nextRaw;
  } catch {
    return "/";
  }
}

/* ─────────────────────────── Mailer (no lib folder) ───────────────────── */

const transporter = (() => {
  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined;
  const secure = process.env.SMTP_SECURE === "true";

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

  // In production, fail hard if SMTP isn't configured
  if (IS_PROD) {
    throw new Error(
      "SMTP is required in production. Set SMTP_URL or SMTP_HOST/SMTP_USER/SMTP_PASS."
    );
  }

  // Dev-only console fallback
  return {
    sendMail: async (opts) => {
      console.log("[MAIL:DEV] (console fallback)", {
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

/* ─────────────────────── Email verification helpers ───────────────────── */

// 🔵 ADDED: generate a 6-digit code
function makeVerificationCode() {
  // 6 digits, zero-padded
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

async function setNewEmailCode(user) {
  const code = makeVerificationCode();
  user.emailVerificationCodeHash = await bcrypt.hash(code, 10);
  user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  await user.save();
  return code;
}

async function emailVerificationMessage({ email, code }) {
  // Deep link so your FE can show a verify screen; still require POST verify on BE
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

/* ───────────────────────────── Local Auth ─────────────────────────────── */

export async function register(req, res) {
  try {
    const { email, password, name, profession, role, tz, baseCurrency } =
      req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(400).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      profession,
      role,
      tz,
      baseCurrency,
      isEmailVerified: false, // 🔵 ADDED
    });

    // 🔵 ADDED: create & send verification code
    const code = await setNewEmailCode(user);
    const { subject, text, html } = await emailVerificationMessage({
      email: user.email,
      code,
    });
    await sendMail({ to: user.email, subject, text, html });

    // In dev, also reveal the code to assist testing
    return res.json({
      message: "Registration successful. Check your inbox for the code.",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: (email || "").toLowerCase(),
    }).select(
      "+passwordHash +emailVerificationCodeHash +emailVerificationExpiresAt"
    );
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.passwordHash) {
      return res.status(401).json({
        error:
          "This account was created via social login. Please sign in with Google/Twitter or set a password.",
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // 🔵 ADDED: block login until verified (only for local/password accounts)
    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: "Email not verified",
        hint: "Please verify your email to continue. You can request a new code.",
        needsVerification: true,
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tz: user.tz,
        baseCurrency: user.baseCurrency,
        profession: user.profession,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ─────────────── NEW: Verify email & Resend code endpoints ────────────── */

// POST /auth/verify-email { email, code }
export async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res.status(400).json({ error: "email and code are required" });

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+emailVerificationCodeHash +emailVerificationExpiresAt"
    );
    if (
      !user ||
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    if (user.emailVerificationExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const ok = await bcrypt.compare(code, user.emailVerificationCodeHash);
    if (!ok) return res.status(400).json({ error: "Invalid or expired code" });

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    return res.json({ message: "Email verified successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /auth/resend-code { email }
export async function resendCode(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // avoid email enumeration
      return res.json({ message: "If the email exists, a new code was sent." });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    const code = await setNewEmailCode(user);
    const { subject, text, html } = await emailVerificationMessage({
      email: user.email,
      code,
    });
    await sendMail({ to: user.email, subject, text, html });

    return res.json({
      message: "A new verification code was sent.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────── Password Reset Flow ────────────────────────── */

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        message:
          "If that email is registered, check your inbox for reset instructions.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expires;
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      email
    )}`;
    console.log(
      `Password reset requested for ${email}. Reset URL (valid for 30 mins): ${resetUrl}`
    );

    return res.json({
      message: "Reset link created",
      resetUrl,
      ...(IS_DEV ? { token: rawToken } : {}),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res
        .status(400)
        .json({ error: "email, token, newPassword required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    if (user.resetPasswordExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const ok = await bcrypt.compare(token, user.resetPasswordTokenHash);
    if (!ok) return res.status(400).json({ error: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── Google OAuth ────────────────────────────── */

export async function googleStart(req, res) {
  try {
    const state = encodeURIComponent(sanitizeNext(req.query.next || "/"));
    const scope = ["openid", "email", "profile"].join(" ");

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function googleCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: "Missing code" });

    const tokenParams = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: GOOGLE_REDIRECT_URI,
    });

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res
        .status(400)
        .json({ error: "Token exchange failed", details: t });
    }
    const tokens = await tokenResp.json();
    const { access_token } = tokens;

    const userResp = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );
    if (!userResp.ok) {
      const t = await userResp.text();
      return res
        .status(400)
        .json({ error: "Userinfo fetch failed", details: t });
    }
    const profile = await userResp.json();
    const googleId = profile.sub;
    const email = (profile.email || "").toLowerCase();
    if (!email)
      return res.status(400).json({ error: "Google account has no email" });

    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      user = await User.create({
        email,
        name: profile.name || "",
        googleId,
        avatarUrl: profile.picture || null,
        lastLogin: new Date(),
        isActive: true,
        isEmailVerified: true, // 🔵 Mark verified via OAuth
        emailVerifiedAt: new Date(),
      });
    } else {
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (profile.name && profile.name !== user.name) {
        user.name = profile.name;
        changed = true;
      }
      if (profile.picture && profile.picture !== user.avatarUrl) {
        user.avatarUrl = profile.picture;
        changed = true;
      }
      user.lastLogin = new Date();
      changed = true;
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const next = sanitizeNext(state ? decodeURIComponent(state) : "/");
    const usp = new URLSearchParams({ provider: "google", token });
    if (next) usp.set("next", next);
    const redirectTo = `${FRONTEND_URL}/oauth-callback?${usp.toString()}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── Twitter OAuth ───────────────────────────── */

export async function twitterStart(req, res) {
  try {
    const state = encodeURIComponent(sanitizeNext(req.query.next || "/")); // relative only

    const code_verifier = base64url(crypto.randomBytes(64));
    const code_challenge = sha256ToBase64url(code_verifier);

    res.cookie("tw_cv", code_verifier, {
      httpOnly: true,
      secure: !IS_DEV,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    const scope = ["users.read", "tweet.read", "offline.access"].join(" ");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: TWITTER_REDIRECT_URI,
      scope,
      state,
      code_challenge,
      code_challenge_method: "S256",
    });

    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function twitterCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: "Missing code" });

    const code_verifier = req.cookies?.tw_cv;
    if (!code_verifier) {
      return res
        .status(400)
        .json({ error: "Missing PKCE verifier (cookie expired)" });
    }

    const isConfidential =
      (TWITTER_CLIENT_TYPE || "").toLowerCase() === "confidential";

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: TWITTER_CLIENT_ID,
      code,
      redirect_uri: TWITTER_REDIRECT_URI,
      code_verifier,
    });

    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    if (isConfidential) {
      const basic = Buffer.from(
        `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`
      ).toString("base64");
      headers.Authorization = `Basic ${basic}`;
    }

    const tokenResp = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: tokenParams.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res
        .status(400)
        .json({ error: "Twitter token exchange failed", details: t });
    }

    const tokens = await tokenResp.json();
    const { access_token } = tokens;

    const userResp = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username,verified,created_at",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!userResp.ok) {
      const t = await userResp.text();
      return res
        .status(400)
        .json({ error: "Twitter user fetch failed", details: t });
    }

    const payload = await userResp.json();
    const tw = payload?.data;
    if (!tw?.id)
      return res.status(400).json({ error: "Twitter profile missing id" });

    const twitterId = tw.id;
    const username = tw.username || "";
    const displayName = tw.name || username || "";
    let avatarUrl = tw.profile_image_url || null;
    if (avatarUrl) avatarUrl = avatarUrl.replace("_normal", "_400x400");

    let email = null;
    if (!email) {
      const localName = username
        ? `${username}+${twitterId}`
        : `xuser_${twitterId}`;
      email = `${localName}@x.local`.toLowerCase();
    }

    let user = await User.findOne({ $or: [{ email }, { twitterId }] });

    if (!user) {
      user = await User.create({
        email,
        name: displayName,
        twitterId,
        avatarUrl,
        lastLogin: new Date(),
        isActive: true,
        isEmailVerified: true, // 🔵 mark as verified for social
        emailVerifiedAt: new Date(),
      });
    } else {
      let changed = false;
      if (!user.twitterId) {
        user.twitterId = twitterId;
        changed = true;
      }
      if (displayName && displayName !== user.name) {
        user.name = displayName;
        changed = true;
      }
      if (avatarUrl && avatarUrl !== user.avatarUrl) {
        user.avatarUrl = avatarUrl;
        changed = true;
      }
      user.lastLogin = new Date();
      changed = true;
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.clearCookie("tw_cv", { path: "/" });

    const next = sanitizeNext(state ? decodeURIComponent(state) : "/");
    const usp = new URLSearchParams({ provider: "twitter", token });
    if (next) usp.set("next", next);
    const redirectTo = `${FRONTEND_URL}/oauth-callback?${usp.toString()}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── GitHub OAuth ───────────────────────────── */

export async function githubStart(req, res) {
  try {
    const state = encodeURIComponent(sanitizeNext(req.query.next || "/"));
    const scope = ["read:user", "user:email"].join(" ");

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
      scope,
      state,
      allow_signup: "true",
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    console.log("[GitHub] authorize URL =>", authUrl);
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function githubCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: "Missing code" });

    const tokenParams = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    });

    const tokenResp = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: tokenParams.toString(),
      }
    );
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res
        .status(400)
        .json({ error: "GitHub token exchange failed", details: t });
    }

    const { access_token } = await tokenResp.json();
    if (!access_token)
      return res.status(400).json({ error: "No access_token from GitHub" });

    const ghUserResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!ghUserResp.ok) {
      const t = await ghUserResp.text();
      return res
        .status(400)
        .json({ error: "GitHub user fetch failed", details: t });
    }
    const ghUser = await ghUserResp.json();

    const ghEmailResp = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    let email = null;
    if (ghEmailResp.ok) {
      const emails = await ghEmailResp.json();
      const primary = emails?.find((e) => e.primary && e.verified)?.email;
      email = (primary || emails?.[0]?.email || "").toLowerCase();
    }

    const githubId = String(ghUser.id);
    const displayName = ghUser.name || ghUser.login || "";
    const avatarUrl = ghUser.avatar_url || null;

    const safeEmail = email || `ghuser_${githubId}@github.local`;

    let user = await User.findOne({
      $or: [{ email: safeEmail }, { githubId }],
    });

    if (!user) {
      user = await User.create({
        email: safeEmail,
        name: displayName,
        githubId,
        avatarUrl,
        lastLogin: new Date(),
        isActive: true,
        isEmailVerified: true, // 🔵 mark as verified for social
        emailVerifiedAt: new Date(),
      });
    } else {
      let changed = false;
      if (!user.githubId) {
        user.githubId = githubId;
        changed = true;
      }
      if (displayName && displayName !== user.name) {
        user.name = displayName;
        changed = true;
      }
      if (avatarUrl && avatarUrl !== user.avatarUrl) {
        user.avatarUrl = avatarUrl;
        changed = true;
      }
      user.lastLogin = new Date();
      changed = true;
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const next = sanitizeNext(state ? decodeURIComponent(state) : "/");
    const qs = new URLSearchParams({ provider: "github", token });
    if (next) qs.set("next", next);
    const redirectTo = `${FRONTEND_URL}/oauth-callback?${qs.toString()}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
