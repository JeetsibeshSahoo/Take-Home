import express from 'express';
import { createAppraisal, getAppraisalById } from '../controllers/appraisalController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), createAppraisal);
router.get('/:id', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), getAppraisalById);

export default router;