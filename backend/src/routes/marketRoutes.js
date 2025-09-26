// backend/src/routes/market.js
import { Router } from "express";
import { getQuote } from "../controllers/marketController.js";
import { requireAuth } from "../middlewares/auth.js";
const router = Router();
router.use(requireAuth);

router.get("/quote", getQuote);
export default router;
