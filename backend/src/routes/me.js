// backend/src/routes/me.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { requireAuth } from "../middlewares/auth.js";
import {
  getMe,
  updateMe,
  softDeleteMe,
} from "../controllers/userController.js";
import { User } from "../models/user.js";

const router = express.Router();

// ---------- base /me (this router MUST be mounted at app.use("/me", meRouter) ----------
router.get("/", requireAuth, getMe);
router.put("/", requireAuth, updateMe);
router.delete("/", requireAuth, softDeleteMe);

// ---------- uploads setup ----------
const uploadDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
    // unique filename per upload to avoid stale caches; tied to userId
    cb(null, `avatar_${req.userId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// helper to build absolute public URL for uploaded file
function buildPublicUrl(req, filename) {
  const base =
    process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`; // e.g. http://localhost:4000
  return `${base}/uploads/${filename}`;
}

// ---------- POST /me/avatar ----------
router.post(
  "/avatar",
  requireAuth,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const newUrl = buildPublicUrl(req, req.file.filename);
      const avatarVersion = Date.now();

      // best-effort: remove previous disk file if it was under /uploads
      const prev = await User.findById(req.userId).lean();
      if (prev?.avatarUrl?.includes("/uploads/")) {
        try {
          const prevRel = prev.avatarUrl.replace(/^https?:\/\/[^/]+/, ""); // strip host
          const absPrev = path.join(process.cwd(), prevRel.replace(/^\//, ""));
          if (absPrev.startsWith(uploadDir)) fs.unlink(absPrev, () => {});
        } catch {}
      }

      await User.findByIdAndUpdate(
        req.userId,
        { $set: { avatarUrl: newUrl, avatarVersion } },
        { runValidators: true }
      );

      return res.json({ avatarUrl: newUrl, avatarVersion });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Upload failed" });
    }
  }
);

// ---------- DELETE /me/avatar ----------
router.delete("/avatar", requireAuth, async (req, res) => {
  try {
    const current = await User.findById(req.userId).lean();
    if (current?.avatarUrl?.includes("/uploads/")) {
      try {
        const rel = current.avatarUrl.replace(/^https?:\/\/[^/]+/, "");
        const abs = path.join(process.cwd(), rel.replace(/^\//, ""));
        if (abs.startsWith(uploadDir)) fs.unlink(abs, () => {});
      } catch {}
    }

    const avatarVersion = Date.now();
    await User.findByIdAndUpdate(
      req.userId,
      { $set: { avatarUrl: undefined, avatarVersion } },
      { runValidators: true }
    );

    return res.json({ ok: true, avatarUrl: undefined, avatarVersion });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Remove failed" });
  }
});

export default router;
