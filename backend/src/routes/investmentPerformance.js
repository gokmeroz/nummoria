import { Router } from "express";
import { getInvestmentPerformance } from "../controllers/investmentPerformance.js"; // plural 'investments'
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/performance", getInvestmentPerformance);
export default router;
