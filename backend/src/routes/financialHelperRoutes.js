import { Router } from "express";
import multer from "multer";
import * as ctrl from "../controllers/financialHelperController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const ok =
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/csv" ||
      name.endsWith(".pdf") ||
      name.endsWith(".csv");
    cb(ok ? null : new Error("Only PDF or CSV files are allowed"), ok);
  },
});

router.post("/ingest", upload.single("file"), ctrl.ingestPdf);
router.post("/chat", ctrl.chat);
export default router;
