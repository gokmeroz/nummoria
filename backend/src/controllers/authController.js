import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";

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
          "This account was created with Google. Please sign in with Google or set a password.",
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // short-lived access token
    );

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
// // POST /auth/request-password-reset
// export async function forgotPassword(req, res) {
//   try {
//     const { email } = req.body;
//     if (!email) {
//       return res.status(400).json({ error: "Email is required" });
//     }
//     const user = await User.findOne({ email });
//     if (!user) {
//       // To prevent email enumeration, respond with success even if user not found
//       return res.json({
//         message:
//           "If that email is registered, check your inbox for reset instructions.",
//       });
//     }
//     const rawToken = crypto.randomBytes(32).toString("hex");
//     const tokenHash = await bcrypt.hash(rawToken, 10);
//     const expires = new Date(Date.now() + 30 * 60 * 1000); // 0.5 hour from now

//     user.resetPasswordTokenHash = tokenHash;
//     user.resetPasswordExpiresAt = expires;
//     await user.save();

//     const resetUrl = `http://localhost:4000/reset-password?token=${rawToken}&email=${encodeURIComponent(
//       email
//     )}`;

//     console.log(
//       `Password reset requested for ${email}. Reset URL (valid for 30 mins): ${resetUrl}`
//     );
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }
// at top of file (or config)
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
// const BACKEND_URL  = process.env.BACKEND_URL  || "http://localhost:3000"; // if needed
const IS_DEV = process.env.NODE_ENV !== "production";

// POST /auth/forgot-password
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });

    // Always behave the same to avoid email enumeration
    if (!user) {
      return res.json({
        message:
          "If that email is registered, check your inbox for reset instructions.",
      });
    }

    // 1) create token & expiry
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expires;
    await user.save();

    // 2) build a FRONTEND reset link (user should land on the React app)
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      email
    )}`;

    console.log(
      `Password reset requested for ${email}. Reset URL (valid for 30 mins): ${resetUrl}`
    );

    // 3) RESPOND IMMEDIATELY so the browser doesn't hang
    // In dev we can also return `token` to allow instant redirect (your Option A).
    return res.json({
      message: "Reset link created",
      resetUrl, // prod-friendly
      ...(IS_DEV ? { token: rawToken } : {}), // dev-only convenience
    });

    // 4) OPTIONAL: send email async (do NOT await before responding)
    // sendResetEmail(email, resetUrl).catch(err => console.error("Email error:", err));
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

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
// ===== GOOGLE OAUTH =====
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  JWT_SECRET,
} = process.env;

// GET /auth/google
export async function googleStart(req, res) {
  try {
    const state = encodeURIComponent(req.query.next || "/"); // optional next
    const scope = ["openid", "email", "profile"].join(" ");

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent", // ensures refresh_token on each flow in dev
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /auth/google/callback
export async function googleCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: "Missing code" });

    // 1) Exchange code for tokens
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

    // 2) Fetch user profile
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
    // profile: { sub, email, email_verified, name, given_name, family_name, picture, ... }
    const googleId = profile.sub;
    const email = (profile.email || "").toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Google account has no email" });
    }

    // 3) Find or create/link user
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (!user) {
      // create new social user (no password required)
      user = await User.create({
        email,
        name: profile.name || "",
        googleId,
        avatarUrl: profile.picture || null,
        lastLogin: new Date(),
        isActive: true,
      });
    } else {
      // link account if needed, update basics
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      // keep name/avatar fresh (don’t overwrite if you don’t want to)
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

    // 4) Issue your normal JWT (same shape as password login)
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // 5) Redirect back to your frontend with the token
    //    Frontend should read it and store (like your email/password flow).
    const next = state ? decodeURIComponent(state) : "/";
    const redirectTo = `${FRONTEND_URL}/oauth-callback?provider=google&token=${encodeURIComponent(
      token
    )}&next=${encodeURIComponent(next)}`;

    return res.redirect(redirectTo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
