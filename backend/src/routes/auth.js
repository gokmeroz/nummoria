import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleStart,
  googleCallback,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Google OAuth
router.get("/google", googleStart);
router.get("/google/callback", googleCallback);

export default router;
