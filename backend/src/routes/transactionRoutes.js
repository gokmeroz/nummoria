import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  softDeleteTransaction,
  hardDeleteTransaction,
} from "../controllers/transactionController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getTransactions);
router.get("/:id", getTransactionById);
router.post("/", createTransaction);
router.put("/:id", updateTransaction);
router.delete("/:id", softDeleteTransaction); // Soft delete
router.delete("/:id/hard", hardDeleteTransaction); // Hard delete
export default router;
