import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  getMe,
  updateMe,
  softDeleteMe,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/", requireAuth, getMe);
router.put("/", requireAuth, updateMe);
router.delete("/", requireAuth, softDeleteMe);

export default router;
