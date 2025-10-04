import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";

/* ─────────────────────────── Config & Helpers ─────────────────────────── */

const FRONTEND_URL_RAW = process.env.FRONTEND_URL || "http://localhost:5173";
// ensure no trailing slash to avoid `//oauth-callback`
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, "");
const IS_DEV = process.env.NODE_ENV !== "production";
const { JWT_SECRET } = process.env;

// Google env
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

// Twitter (X) env
const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET, // used when TWITTER_CLIENT_TYPE=confidential
  TWITTER_REDIRECT_URI, // e.g., http://localhost:4000/auth/twitter/callback
  TWITTER_CLIENT_TYPE, // "public" (default) or "confidential"
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
    // If a full URL was passed, collapse it to its path/query/hash
    if (/^https?:\/\//i.test(nextRaw)) {
      const u = new URL(nextRaw);
      return (u.pathname || "/") + (u.search || "") + (u.hash || "");
    }
    // Normalize: must start with "/"
    return nextRaw.startsWith("/") ? nextRaw : "/" + nextRaw;
  } catch {
    return "/";
  }
}

/* ───────────────────────────── Local Auth ─────────────────────────────── */

export async function register(req, res) {
  try {
    const { email, password, name, profession, role, tz, baseCurrency } =
      req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      name,
      profession,
      role,
      tz,
      baseCurrency,
    });

    res.json({
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
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.passwordHash) {
      return res.status(401).json({
        error:
          "This account was created via social login. Please sign in with Google/Twitter or set a password.",
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
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
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────── Password Reset Flow ────────────────────────── */

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });

    // behave the same to avoid enumeration
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

    const user = await User.findOne({ email });
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
    res.status(500).json({ error: err.message });
  }
}

/* ───────────────────────────── Google OAuth ────────────────────────────── */

export async function googleStart(req, res) {
  try {
    const state = encodeURIComponent(sanitizeNext(req.query.next || "/")); // relative only
    const scope = ["openid", "email", "profile"].join(" ");

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent", // ensures refresh_token in dev
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
    const { access_token /*, id_token, refresh_token */ } = tokens;

    const userResp = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
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
      if (changed) await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // build redirect: /oauth-callback?provider=google&token=...&next=/...
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

    // PKCE
    const code_verifier = base64url(crypto.randomBytes(64));
    const code_challenge = sha256ToBase64url(code_verifier);

    // store verifier short-lived in httpOnly cookie
    res.cookie("tw_cv", code_verifier, {
      httpOnly: true,
      secure: !IS_DEV,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10 min
      path: "/",
    });

    const scope = [
      "users.read",
      "tweet.read",
      "offline.access",
      // "email.read", // only if your app is approved for email
    ].join(" ");

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

    // 1) Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: TWITTER_CLIENT_ID, // keep even for confidential
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
    const { access_token /*, refresh_token, expires_in, scope, token_type */ } =
      tokens;

    // 2) Fetch Twitter user
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
    if (!tw?.id) {
      return res.status(400).json({ error: "Twitter profile missing id" });
    }

    const twitterId = tw.id;
    const username = tw.username || "";
    const displayName = tw.name || username || "";
    let avatarUrl = tw.profile_image_url || null;
    if (avatarUrl) avatarUrl = avatarUrl.replace("_normal", "_400x400");

    // Email is rarely available; synthesize a private, unique email for your DB
    let email = null;
    if (!email) {
      const localName = username
        ? `${username}+${twitterId}`
        : `xuser_${twitterId}`;
      email = `${localName}@x.local`.toLowerCase();
    }

    // 3) Find or create/link
    let user = await User.findOne({ $or: [{ email }, { twitterId }] });

    if (!user) {
      user = await User.create({
        email,
        name: displayName,
        twitterId,
        avatarUrl,
        lastLogin: new Date(),
        isActive: true,
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
      if (changed) await user.save();
    }

    // 4) Issue JWT (same as other flows)
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // clear PKCE cookie
    res.clearCookie("tw_cv", { path: "/" });

    // 5) Redirect to SPA with token (safe qs build + sanitized next)
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
    console.log("[GitHub] authorize URL =>", authUrl); // <— verify redirect_uri exactness
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function githubCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: "Missing code" });

    // 1) Exchange code for token
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
    if (!access_token) {
      return res.status(400).json({ error: "No access_token from GitHub" });
    }

    // 2) Fetch user profile
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

    // 3) Fetch emails (to get primary/verified)
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

    // If email still missing (private email), synthesize one
    const safeEmail = email || `ghuser_${githubId}@github.local`;

    // 4) Upsert user
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
      if (changed) await user.save();
    }

    // 5) Issue JWT and redirect to SPA
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
