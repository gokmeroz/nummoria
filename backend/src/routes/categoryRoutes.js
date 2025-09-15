import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  softDeleteCategory,
  hardDeleteCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", softDeleteCategory);
router.delete("/:id/hard", hardDeleteCategory); // Hard delete

export default router;
