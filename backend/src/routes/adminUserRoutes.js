import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import {
  adminSearchUsers,
  adminGetUserById,
} from "../controllers/adminUserController.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/users", adminSearchUsers);
router.get("/users/:id", adminGetUserById);

export default router;
