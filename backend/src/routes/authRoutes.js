import express from 'express';
import { requestCode, verifyCode, getCurrentUser } from '../controllers/authController.js';
import { magicCodeRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public auth endpoints
router.post('/request-code', magicCodeRateLimiter, requestCode);
router.post('/verify-code', verifyCode);

// Protected session check
router.get('/me', authenticateToken, getCurrentUser);

export default router;