import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendCode,
  googleStart,
  googleCallback,
  twitterCallback,
  twitterStart,
  githubStart,
  githubCallback,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

//Email Verification
router.post("/verify-email", verifyEmail);
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

export default router;
