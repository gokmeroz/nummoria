import { Router } from "express";
import {
  upload,
  ingestCsv,
  ingestPdf,
} from "../controllers/ingestController.js";

const router = Router();

router.post("/csv", upload.single("file"), ingestCsv);
router.post("/pdf", upload.single("file"), ingestPdf);

export default router;
