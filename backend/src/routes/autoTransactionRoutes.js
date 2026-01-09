// backend/src/routes/autoTransactionRoutes.js
import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  autoCreateFromText,
  getDrafts,
  updateDraft,
  postDraft,
  rejectDraft,
} from "../controllers/autoTransactionController.js";

const router = express.Router();

router.use(requireAuth);

// auto capture
router.post("/text", autoCreateFromText);

// drafts
router.get("/drafts", getDrafts);
router.patch("/drafts/:id", updateDraft);
router.post("/drafts/:id/post", postDraft);
router.post("/drafts/:id/reject", rejectDraft);

export default router;
