import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', authorizeRoles('BRANCH_MANAGER', 'ADMIN'), getAuditLogs);

export default router;