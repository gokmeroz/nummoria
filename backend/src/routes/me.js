// backend/src/routes/me.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { requireAuth } from "../middlewares/auth.js";
import {
  getMe,
  updateMe,
  softDeleteMe,
} from "../controllers/userController.js";
import { User } from "../models/user.js";

const router = express.Router();

// /me base routes
router.get("/", requireAuth, getMe);
router.put("/", requireAuth, updateMe);
router.delete("/", requireAuth, softDeleteMe);

// Ensure uploads dir exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
      const ext = path.extname(file?.originalname || ".jpg");
      cb(null, `avatar_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB, change if you want
});

// IMPORTANT: this router mounts at /me, so this is /me + /avatar => /me/avatar
router.post(
  "/avatar",
  requireAuth,
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;

      const updated = await User.findByIdAndUpdate(
        req.userId,
        {
          $set: { avatarUrl },
          $inc: { avatarVersion: 1 },
          $currentDate: { updatedAt: true },
        },
        { new: true, projection: "-passwordHash" }
      ).lean();

      if (!updated) return res.status(404).json({ error: "User not found" });

      // Keep response small and predictable
      res.json({
        name: updated.name,
        email: updated.email,
        profession: updated.profession,
        baseCurrency: updated.baseCurrency,
        tz: updated.tz,
        avatarUrl: updated.avatarUrl,
        avatarVersion: updated.avatarVersion ?? Date.now(),
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
