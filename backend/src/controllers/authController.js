// backend/src/controllers/authController.js
import "../config/env.js"; // <- MUST be first
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { User } from "../models/user.js";
import { requireEnv } from "../config/env.js";
import { setAuthCookie, clearAuthCookie } from "../utils/cookies.js";
import { createRegToken, readRegToken } from "../utils/registrationToken.js";

/* ─────────────────────────── Config & Flags ─────────────────────────── */

const FRONTEND_URL_RAW = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, "");

const IS_DEV = process.env.NODE_ENV !== "production"; // define FIRST
const IS_PROD = !IS_DEV;

const JWT_SECRET = requireEnv("JWT_SECRET");

// Feature flags / dev helpers
const SKIP_EMAIL_VERIFICATION =
  String(process.env.AUTH_SKIP_EMAIL_VERIFICATION || "false") === "true"; // allow login without verifying (DEV only)
const DEV_VERIFICATION_CODE = process.env.DEV_VERIFICATION_CODE || "000000"; // universal code in DEV if you want
const FORCE_EMAIL_SEND =
  String(process.env.FORCE_EMAIL_SEND || "false") === "true"; // actually send SMTP in dev
const DEBUG_VERIFY = String(process.env.DEBUG_VERIFY || "false") === "true"; // include devVerificationCode in responses

// OAuth env
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;
const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_REDIRECT_URI,
  TWITTER_CLIENT_TYPE,
} = process.env;
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI } =
  process.env;

/* ─────────────────────────── Small utils ────────────────────────────── */

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

function maskEmail(email = "") {
  const [u, d] = String(email).split("@");
  if (!d) return email;
  if (!u || u.length <= 2) return `${(u || "").slice(0, 1)}*@${d}`;
  return `${u[0]}${"*".repeat(Math.max(1, u.length - 2))}${
    u[u.length - 1]
  }@${d}`;
}

/* ─────────────────────────── Mailer (inline) ─────────────────────────── */

const transporter = (() => {
  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  // If SMTP configured explicitly, use it.
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

  // In production we require SMTP
  if (IS_PROD) {
    throw new Error(
      "SMTP is required in production. Set SMTP_URL or SMTP_HOST/SMTP_USER/SMTP_PASS."
    );
  }

  // Dev-only console fallback (no actual emails)
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

/* ───────────────────── Email verification helpers ───────────────────── */

function makeVerificationCode() {
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

/* ───────────────────────────── Local Auth ────────────────────────────── */

export async function register(req, res) {
  try {
    const { email, password, name, profession, role, tz, baseCurrency } =
      req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Prepare signup data but DO NOT create User yet
    const passwordHash = await bcrypt.hash(password, 10);

    const code = makeVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

    const regToken = createRegToken({
      email: normalizedEmail,
      passwordHash,
      name,
      profession,
      role,
      tz,
      baseCurrency,
      codeHash,
      expiresAt,
      iat: Date.now(),
    });

    if (FORCE_EMAIL_SEND) {
      const { subject, text, html } = buildVerifyEmailMessage({
        email: normalizedEmail,
        code,
      });
      await sendMail({ to: normalizedEmail, subject, text, html });
    } else {
      console.log("[VERIFY:DEV] Code for %s => %s", normalizedEmail, code);
    }

    return res.status(200).json({
      message:
        "Verification code sent. Please verify to complete registration.",
      requiresEmailVerification: true,
      maskedEmail: maskEmail(normalizedEmail),
      regToken,
      ...(IS_DEV && DEBUG_VERIFY && !FORCE_EMAIL_SEND
        ? { devVerificationCode: code }
        : {}),
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

    // Block login if email not verified (unless DEV bypass is enabled)
    if (!user.isEmailVerified) {
      if (IS_DEV && SKIP_EMAIL_VERIFICATION) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();
      } else {
        return res.status(403).json({
          error: "Email not verified",
          hint: "Please verify your email to continue. You can request a new code.",
          reason: "UNVERIFIED",
          maskedEmail: maskEmail(user.email),
          needsVerification: true,
        });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    setAuthCookie(res, token);

    return res.json({
      ok: true,
      token, // ✅ add this for mobile
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
        subscription: user.subscription,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
export async function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ ok: true });
}

/* ─────────────── Verify email & Resend code endpoints ─────────────── */

export async function verifyEmail(req, res) {
  try {
    const { regToken, code } = req.body;

    if (!regToken || !code) {
      return res.status(400).json({ error: "regToken and code are required" });
    }

    const data = readRegToken(regToken);
    if (!data || !data.email || !data.codeHash || !data.expiresAt) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    if (Number(data.expiresAt) < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    // DEV universal code bypass (optional)
    if (!(IS_DEV && code === DEV_VERIFICATION_CODE)) {
      const ok = await bcrypt.compare(code, data.codeHash);
      if (!ok)
        return res.status(400).json({ error: "Invalid or expired code" });
    }

    // If already created, treat as idempotent success
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return res.status(200).json({ message: "Email already verified." });
    }

    const user = await User.create({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      profession: data.profession,
      role: data.role,
      tz: data.tz,
      baseCurrency: data.baseCurrency,
      isEmailVerified: true,
      isActive: true,
      emailVerifiedAt: new Date(),
    });

    return res.status(201).json({
      message: "Email verified. Account created.",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isEmailVerified: true,
        isActive: true,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function resendCode(req, res) {
  try {
    const { regToken } = req.body;
    if (!regToken)
      return res.status(400).json({ error: "regToken is required" });

    const data = readRegToken(regToken);
    if (!data || !data.email || !data.passwordHash) {
      // avoid leaking anything
      return res.json({ message: "If the email exists, a new code was sent." });
    }

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return res.json({ message: "If the email exists, a new code was sent." });
    }

    const code = makeVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    const newRegToken = createRegToken({
      ...data,
      codeHash,
      expiresAt,
      iat: Date.now(),
    });

    if (FORCE_EMAIL_SEND) {
      const { subject, text, html } = buildVerifyEmailMessage({
        email: data.email,
        code,
      });
      await sendMail({ to: data.email, subject, text, html });
    } else {
      console.log("[VERIFY:DEV-RESEND] Code for %s => %s", data.email, code);
    }

    return res.json({
      message: "A new verification code was sent.",
      regToken: newRegToken,
      ...(IS_DEV && DEBUG_VERIFY && !FORCE_EMAIL_SEND
        ? { devVerificationCode: code }
        : {}),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────── Password Reset Flow ───────────────────────── */

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

/* ───────────────────────────── Google OAuth ───────────────────────────── */

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
        isEmailVerified: true,
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

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // ⬇️ Set cookie; keep token in URL for backward compatibility (front-end can ignore)
    setAuthCookie(res, token);

    const next = sanitizeNext(state ? decodeURIComponent(state) : "/");
    const usp = new URLSearchParams({ provider: "google" /*, token*/ });
    if (next) usp.set("next", next);
    const redirectTo = `${FRONTEND_URL}/oauth-callback?${usp.toString()}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── Twitter OAuth ──────────────────────────── */

export async function twitterStart(req, res) {
  try {
    const state = encodeURIComponent(sanitizeNext(req.query.next || "/"));

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

    const tw = (await userResp.json())?.data;
    if (!tw?.id)
      return res.status(400).json({ error: "Twitter profile missing id" });

    const twitterId = tw.id;
    const username = tw.username || "";
    const displayName = tw.name || username || "";
    let avatarUrl = tw.profile_image_url || null;
    if (avatarUrl) avatarUrl = avatarUrl.replace("_normal", "_400x400");

    // Twitter often lacks email; synthesize a stable local one
    const safeEmail = `${
      (username || "xuser") + "+" + twitterId
    }@x.local`.toLowerCase();

    let user = await User.findOne({
      $or: [{ email: safeEmail }, { twitterId }],
    });

    if (!user) {
      user = await User.create({
        email: safeEmail,
        name: displayName,
        twitterId,
        avatarUrl,
        lastLogin: new Date(),
        isActive: true,
        isEmailVerified: true,
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

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.clearCookie("tw_cv", { path: "/" });

    // ⬇️ Set cookie; keep URL params simple
    setAuthCookie(res, token);

    const next = sanitizeNext(state ? decodeURIComponent(state) : "/");
    const usp = new URLSearchParams({ provider: "twitter" /*, token*/ });
    if (next) usp.set("next", next);
    const redirectTo = `${FRONTEND_URL}/oauth-callback?${usp.toString()}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── GitHub OAuth ──────────────────────────── */

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

    const safeEmail = (
      email || `ghuser_${githubId}@github.local`
    ).toLowerCase();

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
        isEmailVerified: true,
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

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // ⬇️ Set cookie and redirect (no token in URL needed)
    setAuthCookie(res, token);

    const next = sanitizeNext(state ? decodeURIComponent(state) : "/");
    const qs = new URLSearchParams({ provider: "github" /*, token*/ });
    if (next) qs.set("next", next);
    const redirectTo = `${FRONTEND_URL}/oauth-callback?${qs.toString()}`;
    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
