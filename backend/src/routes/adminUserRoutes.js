import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import {
  adminSearchUsers,
  adminGetUserById,
  adminDeactivateUser,
  adminReactivateUser,
  adminHardDeleteUser,
} from "../controllers/adminUserController.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/users", adminSearchUsers);
router.get("/users/:id", adminGetUserById);

// lifecycle actions
router.patch("/users/:id/deactivate", adminDeactivateUser);
router.patch("/users/:id/reactivate", adminReactivateUser);
router.delete("/users/:id/hard", adminHardDeleteUser);

export default router;
