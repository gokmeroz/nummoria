// backend/src/routes/adminUserRoutes.js
import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import {
  adminSearchUsers,
  adminGetUserById,
  adminGetUserAccounts,
  // lifecycle
  adminDeactivateUser,
  adminReactivateUser,
  adminHardDeleteUser,

  // NEW: Phase 1
  adminResendVerification,
  adminForceLogout,
  adminSendPasswordReset,
  adminUpdateUserSubscription,
} from "../controllers/adminUserController.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/users", adminSearchUsers);
router.get("/users/:id", adminGetUserById);
router.get("/users/:id/accounts", adminGetUserAccounts);

// lifecycle endpoints
router.patch("/users/:id/deactivate", adminDeactivateUser);
router.patch("/users/:id/reactivate", adminReactivateUser);
router.delete("/users/:id/hard", adminHardDeleteUser);

// NEW: Phase 1 endpoints
router.post("/users/:id/resend-verification", adminResendVerification);
router.post("/users/:id/force-logout", adminForceLogout);
router.post("/users/:id/send-password-reset", adminSendPasswordReset);
router.patch("/users/:id/subscription", adminUpdateUserSubscription);

export default router;
