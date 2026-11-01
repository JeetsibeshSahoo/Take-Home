import express from 'express';
import {
  sanctionLoan,
  approveLoan,
  getApprovalsQueue,
  getDueStatus,
  recordRepayment,
  closeLoanAndReleaseGold,
  getLoans,
  getLoanById,
} from '../controllers/loanController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

// Loan listing & details
router.get('/', getLoans);
router.get('/approvals-queue', authorizeRoles('BRANCH_MANAGER', 'ADMIN'), getApprovalsQueue);
router.get('/:id', getLoanById);
router.get('/:id/due-calculator', getDueStatus);

// Loan lifecycle mutations
router.post('/sanction', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), sanctionLoan);
router.post('/:id/approve', authorizeRoles('BRANCH_MANAGER', 'ADMIN'), approveLoan);
router.post('/:id/repayments', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), recordRepayment);
router.post('/:id/close', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), closeLoanAndReleaseGold);

export default router;