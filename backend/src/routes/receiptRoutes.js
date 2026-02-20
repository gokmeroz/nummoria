// backend/src/routes/receiptRoutes.js
import express from "express";
import multer from "multer";
import { receiptParse } from "../controllers/receiptController.js";

const router = express.Router();

// Memory storage because we usually forward bytes to OCR providers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
  },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp";

    if (!ok) return cb(new Error("Unsupported file type. Use JPG/PNG/WebP."));
    cb(null, true);
  },
});

// POST /receipt/parse  (multipart form-data: file=<image>)
router.post("/parse", upload.single("file"), receiptParse);

export default router;
