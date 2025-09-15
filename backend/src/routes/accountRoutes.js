import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  softDeleteAccount,
  hardDeleteAccount,
} from "../controllers/accountController.js";

const router = express.Router();
router.use(requireAuth); // Apply authentication middleware to all routes

router.get("/", getAccounts);
router.get("/:id", getAccountById);
router.post("/", createAccount);
router.put("/:id", updateAccount);
router.delete("/:id", softDeleteAccount);
router.delete("/:id/hard", hardDeleteAccount);

export default router;
