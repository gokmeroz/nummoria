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
  twitterCallback,
  twitterStart,
  githubStart,
  githubCallback,
  appleStart,
  appleCallback,
  appleMobile,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

//Email Verification
router.post("/verify-email", verifyEmail);
router.post("/verify-existing-email", verifyExistingEmail);
router.post("/resend-code", resendCode);
// Google OAuth
router.get("/google", googleStart);
router.get("/google/callback", googleCallback);

// Twitter OAuth
router.get("/twitter", twitterStart);
router.get("/twitter/callback", twitterCallback);

// Github OAuth
router.get("/github", githubStart);
router.get("/github/callback", githubCallback);
// Apple OAuth
router.get("/apple", appleStart);
router.post("/apple/callback", appleCallback); // form_post
router.get("/apple/callback", appleCallback); // fallback if query-mode ever used
router.post("/apple/mobile", appleMobile);

export default router;
