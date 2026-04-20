import "../config/env.js"; // <- MUST be first

import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { User } from "../models/user.js";
import { requireEnv } from "../config/env.js";
import { setAuthCookie, clearAuthCookie } from "../utils/cookies.js";
import { createRegToken, readRegToken } from "../utils/registrationToken.js";
import { seedDefaultCategoriesForUser } from "../services/categorySeedService.js";

// Apple Sign-In verification + client_secret JWT
import { SignJWT, importPKCS8, createRemoteJWKSet, jwtVerify } from "jose";

/* ─────────────────────────── Config & Flags ─────────────────────────── */

const FRONTEND_URL_RAW = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, "");

const IS_DEV = process.env.NODE_ENV !== "production";
const IS_PROD = !IS_DEV;

const JWT_SECRET = requireEnv("JWT_SECRET");
const CURRENT_CONSENT_VERSION = "v1";

// Feature flags / dev helpers
const SKIP_EMAIL_VERIFICATION =
  String(process.env.AUTH_SKIP_EMAIL_VERIFICATION || "false") === "true";
const DEV_VERIFICATION_CODE = process.env.DEV_VERIFICATION_CODE || "000000";
const FORCE_EMAIL_SEND =
  String(process.env.FORCE_EMAIL_SEND || "false") === "true";
const DEBUG_VERIFY = String(process.env.DEBUG_VERIFY || "false") === "true";

// OAuth env
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

// Apple OAuth env
const {
  APPLE_CLIENT_ID, // WEB Service ID
  APPLE_IOS_BUNDLE_ID, // iOS bundle id
  APPLE_REDIRECT_URI,
  APPLE_TEAM_ID,
  APPLE_KEY_ID,
  APPLE_PRIVATE_KEY,
  APPLE_ALLOWED_AUDIENCES,
} = process.env;

/* ─────────────────────────── Small utils ────────────────────────────── */

function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sanitizeNext(nextRaw) {
  if (!nextRaw) return "/";
  try {
    if (typeof nextRaw !== "string") return "/";
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

function safeDecodeURIComponentMaybe(s) {
  if (!s || typeof s !== "string") return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function buildOauthRedirectUrl({ provider, token, next }) {
  const qs = new URLSearchParams({ provider });

  const safeNext = sanitizeNext(next || "/");
  if (safeNext) qs.set("next", safeNext);

  if (token) qs.set("token", token);

  return `${FRONTEND_URL}/oauth-callback?${qs.toString()}`;
}

function normalizeConsentInput(consentInput) {
  const accepted = consentInput?.accepted === true;
  const version =
    typeof consentInput?.version === "string" && consentInput.version.trim()
      ? consentInput.version.trim()
      : CURRENT_CONSENT_VERSION;

  return {
    accepted,
    version: accepted ? version : null,
    acceptedAt: accepted ? new Date() : null,
  };
}

/* ───────────────────────── Apple helpers ───────────────────────── */

function normalizeApplePrivateKey(k = "") {
  return String(k).replace(/\\n/g, "\n");
}

function decodeJwtPayloadUnsafe(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;

    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getAppleAudiences() {
  const list = String(APPLE_ALLOWED_AUDIENCES || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (APPLE_CLIENT_ID && !list.includes(APPLE_CLIENT_ID)) {
    list.push(APPLE_CLIENT_ID);
  }

  if (APPLE_IOS_BUNDLE_ID && !list.includes(APPLE_IOS_BUNDLE_ID)) {
    list.push(APPLE_IOS_BUNDLE_ID);
  }

  return list;
}

async function createAppleClientSecret() {
  if (
    !APPLE_TEAM_ID ||
    !APPLE_CLIENT_ID ||
    !APPLE_KEY_ID ||
    !APPLE_PRIVATE_KEY
  ) {
    throw new Error(
      "Missing Apple env. Need APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1 hour

  const pk = await importPKCS8(
    normalizeApplePrivateKey(APPLE_PRIVATE_KEY),
    "ES256",
  );

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setSubject(APPLE_CLIENT_ID)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(pk);
}

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

async function verifyAppleIdToken(idToken) {
  const audiences = getAppleAudiences();
  if (!audiences.length) {
    throw new Error(
      "Apple audiences not configured. Set APPLE_CLIENT_ID / APPLE_IOS_BUNDLE_ID / APPLE_ALLOWED_AUDIENCES.",
    );
  }

  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: audiences,
  });

  return payload;
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

  if (url || host) {
    return nodemailer.createTransport(
      url
        ? url
        : {
            host,
            port: port || 587,
            secure: !!secure,
            auth: user && pass ? { user, pass } : undefined,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
          },
    );
  }

  if (IS_PROD) {
    throw new Error(
      "SMTP is required in production. Set SMTP_URL or SMTP_HOST/SMTP_USER/SMTP_PASS.",
    );
  }

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

function buildVerifyEmailMessage({ email, code }) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?email=${encodeURIComponent(
    email,
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
    const {
      email,
      password,
      name,
      profession,
      role,
      tz,
      baseCurrency,
      consent,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        error: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const code = makeVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    const normalizedConsent = normalizeConsentInput(consent);

    const regToken = createRegToken({
      email: normalizedEmail,
      passwordHash,
      name: name || "",
      profession: profession || "",
      role: role || "user",
      tz: tz || "UTC",
      baseCurrency: baseCurrency || "USD",
      codeHash,
      expiresAt,
      iat: Date.now(),
      consent: normalizedConsent,
    });

if (FORCE_EMAIL_SEND) {
  const { subject, text, html } = buildVerifyEmailMessage({
    email: normalizedEmail,
    code,
  });

  console.log("[REGISTER] before sendMail", {
    to: normalizedEmail,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE,
    smtpUser: process.env.SMTP_USER,
    mailFrom: process.env.MAIL_FROM,
  });

  try {
    const info = await sendMail({
      to: normalizedEmail,
      subject,
      text,
      html,
    });

    console.log("[REGISTER] sendMail success", {
      to: normalizedEmail,
      messageId: info?.messageId || null,
    });
  } catch (mailErr) {
    console.error("[REGISTER] sendMail failed", {
      message: mailErr?.message,
      code: mailErr?.code,
      response: mailErr?.response,
      responseCode: mailErr?.responseCode,
      command: mailErr?.command,
      stack: mailErr?.stack,
    });
    throw mailErr;
  }
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
    return res.status(500).json({
      error: err.message || "Registration failed",
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: (email || "").toLowerCase(),
    }).select(
      "+passwordHash +emailVerificationCodeHash +emailVerificationExpiresAt",
    );
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.passwordHash) {
      return res.status(401).json({
        error:
          "This account was created via social login. Please sign in with Google or Apple, or set a password.",
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

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
      { expiresIn: "8h" },
    );

    setAuthCookie(res, token);

    return res.json({
      ok: true,
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

    if (!(IS_DEV && code === DEV_VERIFICATION_CODE)) {
      const ok = await bcrypt.compare(code, data.codeHash);
      if (!ok)
        return res.status(400).json({ error: "Invalid or expired code" });
    }

    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return res.status(200).json({ message: "Email already verified." });
    }

    const consentData = normalizeConsentInput(data.consent);

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
      consent: consentData,
    });

    await seedDefaultCategoriesForUser(user._id);

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

export async function verifyExistingEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "email and code are required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select(
      "+emailVerificationCodeHash +emailVerificationExpiresAt isEmailVerified",
    );

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({ message: "Email already verified." });
    }

    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const ok = await bcrypt.compare(code, user.emailVerificationCodeHash);
    if (!ok) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    return res.json({ message: "Email verified." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function resendCode(req, res) {
  try {
    const { regToken } = req.body;
    if (!regToken) {
      return res.status(400).json({ error: "regToken is required" });
    }

    const data = readRegToken(regToken);
    if (!data || !data.email || !data.passwordHash) {
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
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expires;
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      email,
    )}`;
    console.log(
      `Password reset requested for ${email}. Reset URL (valid for 30 mins): ${resetUrl}`,
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
    const { email, userId, token, newPassword } = req.body;

    if ((!email && !userId) || !token || !newPassword) {
      return res.status(400).json({
        error: "email or userId, token, newPassword required",
      });
    }

    const query = userId
      ? { _id: userId }
      : { email: String(email).toLowerCase() };

    const user = await User.findOne(query);

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
    user.authInvalidBefore = new Date();

    await user.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── Apple OAuth (WEB) ───────────────────────────── */

export async function appleStart(req, res) {
  try {
    if (!APPLE_CLIENT_ID || !APPLE_REDIRECT_URI) {
      return res.status(500).json({
        error:
          "Apple OAuth not configured. Missing APPLE_CLIENT_ID or APPLE_REDIRECT_URI.",
      });
    }

    console.log("[APPLE START]");
    console.log("CLIENT_ID:", APPLE_CLIENT_ID);
    console.log("REDIRECT_URI:", APPLE_REDIRECT_URI);

    const state = encodeURIComponent(sanitizeNext(req.query.next || "/"));

    const params = new URLSearchParams({
      response_type: "code",
      response_mode: "form_post",
      client_id: APPLE_CLIENT_ID,
      redirect_uri: APPLE_REDIRECT_URI,
      scope: "name email",
      state,
    });

    const authUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function appleCallback(req, res) {
  try {
    const code = req.body?.code || req.query?.code;
    const state = req.body?.state || req.query?.state;

    if (!code) return res.status(400).json({ error: "Missing code" });

    console.log("[APPLE CALLBACK]");
    console.log("REDIRECT_URI USED:", APPLE_REDIRECT_URI);
    console.log("CLIENT_ID USED:", APPLE_CLIENT_ID);

    const client_secret = await createAppleClientSecret();

    const tokenParams = new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      client_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: APPLE_REDIRECT_URI,
    });

    const tokenResp = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res
        .status(400)
        .json({ error: "Apple token exchange failed", details: t });
    }

    const tokens = await tokenResp.json();
    const id_token = tokens.id_token;

    if (!id_token) {
      return res.status(400).json({ error: "Missing id_token from Apple" });
    }

    const payload = await verifyAppleIdToken(id_token);

    const appleId = String(payload.sub || "");
    const email = (payload.email || "").toLowerCase();
    const emailVerified =
      String(payload.email_verified || payload.email_verified === true) ===
      "true";

    let displayName = "";
    const userRaw = req.body?.user;
    if (userRaw) {
      try {
        const userObj =
          typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
        const first = userObj?.name?.firstName || "";
        const last = userObj?.name?.lastName || "";
        displayName = `${first} ${last}`.trim();
      } catch {}
    }

    if (!appleId) {
      return res.status(400).json({ error: "Apple token missing sub" });
    }

    let user = await User.findOne({
      $or: [{ appleId }, ...(email ? [{ email }] : [])],
    }).select("+passwordHash");

    if (!user) {
      const safeEmail = (email || `apple_${appleId}@apple.local`).toLowerCase();
      const randomPw = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPw, 10);

      user = await User.create({
        email: safeEmail,
        name: displayName || "Apple User",
        passwordHash,
        appleId,
        lastLogin: new Date(),
        isActive: true,
        isEmailVerified: email ? !!emailVerified : true,
        emailVerifiedAt: new Date(),
        consent: {
          accepted: true,
          acceptedAt: new Date(),
          version: CURRENT_CONSENT_VERSION,
        },
      });
    } else {
      let changed = false;

      if (!user.appleId) {
        user.appleId = appleId;
        changed = true;
      }

      if (email && user.email?.endsWith("@apple.local")) {
        user.email = email;
        changed = true;
      }

      if (displayName && !user.name) {
        user.name = displayName;
        changed = true;
      }

      user.lastLogin = new Date();
      changed = true;

      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        changed = true;
      }

      if (!user.passwordHash) {
        const randomPw = crypto.randomBytes(32).toString("hex");
        user.passwordHash = await bcrypt.hash(randomPw, 10);
        changed = true;
      }

      if (!user?.consent?.accepted) {
        user.consent = {
          accepted: true,
          acceptedAt: new Date(),
          version: CURRENT_CONSENT_VERSION,
        };
        changed = true;
      }

      if (changed) await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    setAuthCookie(res, token);

    const next = sanitizeNext(state ? safeDecodeURIComponentMaybe(state) : "/");

    const redirectTo = buildOauthRedirectUrl({
      provider: "apple",
      token,
      next,
    });

    return res.redirect(redirectTo);
  } catch (err) {
    console.log("[APPLE CALLBACK ERROR]", err?.message || err);
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
      },
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

    if (!email) {
      return res.status(400).json({ error: "Google account has no email" });
    }

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
        consent: {
          accepted: true,
          acceptedAt: new Date(),
          version: CURRENT_CONSENT_VERSION,
        },
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

      if (!user?.consent?.accepted) {
        user.consent = {
          accepted: true,
          acceptedAt: new Date(),
          version: CURRENT_CONSENT_VERSION,
        };
        changed = true;
      }

      if (changed) await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    setAuthCookie(res, token);

    const next = sanitizeNext(state ? safeDecodeURIComponentMaybe(state) : "/");

    const redirectTo = buildOauthRedirectUrl({
      provider: "google",
      token,
      next,
    });

    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────── Apple (MOBILE / Expo) ───────────────────────── */

export async function appleMobile(req, res) {
  try {
    const { identityToken, fullName } = req.body || {};

    if (!identityToken) {
      return res.status(400).json({ error: "identityToken is required" });
    }

    if (!APPLE_IOS_BUNDLE_ID && !APPLE_ALLOWED_AUDIENCES) {
      return res.status(500).json({
        error:
          "Apple mobile is not configured. Set APPLE_IOS_BUNDLE_ID and/or APPLE_ALLOWED_AUDIENCES.",
      });
    }

    const unsafe = decodeJwtPayloadUnsafe(identityToken);
    if (unsafe) {
      console.log("[APPLE MOBILE PAYLOAD UNSAFE]", {
        iss: unsafe.iss,
        aud: unsafe.aud,
        sub: unsafe.sub,
        email: unsafe.email,
      });
    }

    const payload = await verifyAppleIdToken(identityToken);

    const appleId = String(payload.sub || "");
    if (!appleId) {
      return res.status(400).json({ error: "Apple token missing sub" });
    }

    const email = (payload.email || "").toLowerCase();
    const emailVerified =
      String(payload.email_verified || payload.email_verified === true) ===
      "true";

    const displayName =
      (fullName && typeof fullName === "string" ? fullName.trim() : "") || "";

    let user = await User.findOne({
      $or: [{ appleId }, ...(email ? [{ email }] : [])],
    }).select("+passwordHash");

    if (!user) {
      const safeEmail = (email || `apple_${appleId}@apple.local`).toLowerCase();
      const randomPw = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPw, 10);

      user = await User.create({
        email: safeEmail,
        name: displayName || "Apple User",
        passwordHash,
        appleId,
        lastLogin: new Date(),
        isActive: true,
        isEmailVerified: email ? !!emailVerified : true,
        emailVerifiedAt: new Date(),
        consent: {
          accepted: true,
          acceptedAt: new Date(),
          version: CURRENT_CONSENT_VERSION,
        },
      });
    } else {
      let changed = false;

      if (!user.appleId) {
        user.appleId = appleId;
        changed = true;
      }

      if (email && user.email?.endsWith("@apple.local")) {
        user.email = email;
        changed = true;
      }

      if (displayName && !user.name) {
        user.name = displayName;
        changed = true;
      }

      user.lastLogin = new Date();
      changed = true;

      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        changed = true;
      }

      if (!user.passwordHash) {
        const randomPw = crypto.randomBytes(32).toString("hex");
        user.passwordHash = await bcrypt.hash(randomPw, 10);
        changed = true;
      }

      if (!user?.consent?.accepted) {
        user.consent = {
          accepted: true,
          acceptedAt: new Date(),
          version: CURRENT_CONSENT_VERSION,
        };
        changed = true;
      }

      if (changed) await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    return res.json({
      ok: true,
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
        subscription: user.subscription,
      },
    });
  } catch (err) {
    console.log("[APPLE_MOBILE] error:", err?.message);
    return res.status(400).json({
      error: "Apple sign-in failed",
      details: String(err?.message || err),
    });
  }
}