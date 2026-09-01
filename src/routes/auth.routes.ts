import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  passwordResetRequest,
  passwordResetConfirm,
  sync,
  getMe,
  deleteAccount
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema
} from '../validators/auth.validator';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rate-limit';

const router = Router();

// Public endpoints
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', authLimiter, logout);
router.post('/refresh', authLimiter, validate(refreshSchema), refresh);
router.post('/password-reset-request', authLimiter, validate(passwordResetRequestSchema), passwordResetRequest);
router.post('/password-reset-confirm', authLimiter, validate(passwordResetConfirmSchema), passwordResetConfirm);

// Sync user after Supabase auth
router.post('/sync', sync);

// Protected endpoints
router.get('/me', requireAuth, getMe);
router.delete('/delete-account', requireAuth, deleteAccount);

export default router;
