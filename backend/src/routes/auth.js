import express from "express";
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyExistingEmail,
  resendCode,
  googleStart,
  googleCallback,
  appleStart,
  appleCallback,
  appleMobile,
} from "../controllers/authController.js";

const router = express.Router();

// Local auth
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// Password
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Email Verification
router.post("/verify-email", verifyEmail);
router.post("/verify-existing-email", verifyExistingEmail);
router.post("/resend-code", resendCode);

// Google OAuth
router.get("/google", googleStart);
router.get("/google/callback", googleCallback);

// Apple OAuth (WEB)
router.get("/apple", appleStart);
router.post("/apple/callback", appleCallback); // form_post
router.get("/apple/callback", appleCallback); // fallback

// Apple OAuth (MOBILE)
router.post("/apple/mobile", appleMobile);

export default router;
