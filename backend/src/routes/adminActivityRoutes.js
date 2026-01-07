// backend/src/routes/adminActivityRoutes.js
import express from "express";
import { adminGetUserActivity } from "../controllers/adminActivityController.js";

// IMPORTANT: replace these with your real middlewares
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireRole.js";

const router = express.Router();

// GET /api/admin/users/:userId/activity?limit=50&cursor=ISO&types=a,b,c
router.get(
  "/admin/users/:userId/activity",
  requireAuth,
  requireAdmin,
  adminGetUserActivity
);

export default router;
