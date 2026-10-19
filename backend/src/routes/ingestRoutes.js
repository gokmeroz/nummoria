import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  upload,
  ingestCsv,
  ingestPdf,
} from "../controllers/ingestController.js";

const router = Router();

// These write ledger rows: authentication comes before multer so an
// anonymous request is rejected before its upload is buffered.
router.post("/csv", requireAuth, upload.single("file"), ingestCsv);
router.post("/pdf", requireAuth, upload.single("file"), ingestPdf);

export default router;
