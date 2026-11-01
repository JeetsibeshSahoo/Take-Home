import express from 'express';
import { getTodayRate, setDailyRate, getRateHistoryAndBreaches } from '../controllers/goldRateController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/today', getTodayRate);
router.get('/history', authorizeRoles('BRANCH_MANAGER', 'ADMIN'), getRateHistoryAndBreaches);
router.post('/', authorizeRoles('ADMIN'), setDailyRate);

export default router;