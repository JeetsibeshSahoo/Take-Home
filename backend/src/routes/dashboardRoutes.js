import express from 'express';
import { getDashboardStats, exportLoansCSV } from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats', getDashboardStats);
router.get('/export-csv', exportLoansCSV);

export default router;