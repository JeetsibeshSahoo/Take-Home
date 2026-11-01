import express from 'express';
import { createCustomer, getCustomers, getCustomerById } from '../controllers/customerController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken); // Protected for all logged-in staff

router.post('/', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), createCustomer);
router.get('/', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), getCustomers);
router.get('/:id', authorizeRoles('BRANCH_STAFF', 'BRANCH_MANAGER', 'ADMIN'), getCustomerById);

export default router;