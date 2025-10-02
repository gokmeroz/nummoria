// routes/me.js (or wherever you define user routes)
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  getMe,
  updateMe,
  softDeleteMe,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/", requireAuth, getMe);
router.put("/", requireAuth, updateMe);
router.delete("/", requireAuth, softDeleteMe);

// Ensure uploads dir exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// simple disk storage; swap for S3/etc. if needed
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname || ".jpg");
      cb(null, `avatar_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.post("/me/avatar", upload.single("avatar"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // public URL for the uploaded file (serve /uploads as static)
    const avatarUrl = `/uploads/${req.file.filename}`;

    // bump version so client cache-busts
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        avatarUrl,
        $inc: { avatarVersion: 1 },
        updatedAt: new Date(),
      },
      {
        new: true,
        projection:
          "name email profession baseCurrency tz avatarUrl avatarVersion updatedAt",
      }
    );

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

export default router;
