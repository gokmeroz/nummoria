// backend/src/routes/financialHelperRoutes.js
import { Router } from "express";
import { upload, ingestFile } from "../controllers/ingestController.js";
import * as ctrl from "../controllers/financialHelperController.js";
import { requireAuth } from "../middlewares/auth.js";
import { aiQuota } from "../middlewares/aiQuota.js";

const router = Router();

// ✅ Upload + ingest handled by ingestController (CSV/PDF auto-detect + proper response)
// IMPORTANT: This must match frontend: fd.append("file", f)
router.post("/ingest", requireAuth, upload.single("file"), ingestFile);

// Chat stays in your financialHelperController
router.post("/chat", requireAuth, ctrl.chat);
router.post("/ai/advisor", requireAuth, aiQuota, ctrl.aiAdvisor);

export default router;
