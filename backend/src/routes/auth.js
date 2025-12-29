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

export default router;
