// backend/src/routes/adminRoutes.js
import express from "express";
import {
  adminGetUserNotes,
  adminAddUserNote,
  adminUpdateUserFlags,
} from "../controllers/adminUserMetaController.js";

// If you also have activity endpoints, keep them as-is.
import {
  adminGetUserActivity,
  adminGetGlobalActivity,
} from "../controllers/adminActivityController.js";
import { requireAdmin } from "../middlewares/requireRole.js";
const router = express.Router();

router.use(requireAdmin); // if you have it

// Notes
router.get("/users/:userId/notes", adminGetUserNotes);
router.post("/users/:userId/notes", adminAddUserNote);

// Flags
router.put("/users/:userId/flags", adminUpdateUserFlags);

// Keep your other admin routes here
router.get("/activity", adminGetGlobalActivity);
router.get("/users/:userId/activity", adminGetUserActivity);

export default router;
