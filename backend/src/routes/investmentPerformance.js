// backend/src/routes/investmentPerformance.js
import { Router } from "express";
import { getInvestmentPerformance } from "../controllers/investmentPerformance.js"; // plural 'investments'

const router = Router();
router.get("/performance", getInvestmentPerformance);
export default router;
