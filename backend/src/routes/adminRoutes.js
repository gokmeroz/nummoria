// backend/src/routes/adminRoutes.js
import express from "express";
import { adminGetUserActivity } from "../controllers/adminActivityController.js";
// import { requireAdmin } from "../middlewares/admin.js"; // if you have it

const router = express.Router();

// If you have admin auth middleware, apply it here:
// router.use(requireAdmin);

router.get("/users/:userId/activity", adminGetUserActivity);

export default router;
