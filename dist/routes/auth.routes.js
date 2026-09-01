"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_validator_1 = require("../validators/auth.validator");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_1 = require("../middleware/rate-limit");
const router = (0, express_1.Router)();
// Public endpoints
router.post('/register', rate_limit_1.authLimiter, (0, validate_middleware_1.validate)(auth_validator_1.registerSchema), auth_controller_1.register);
router.post('/login', rate_limit_1.authLimiter, (0, validate_middleware_1.validate)(auth_validator_1.loginSchema), auth_controller_1.login);
router.post('/logout', rate_limit_1.authLimiter, auth_controller_1.logout);
router.post('/refresh', rate_limit_1.authLimiter, (0, validate_middleware_1.validate)(auth_validator_1.refreshSchema), auth_controller_1.refresh);
router.post('/password-reset-request', rate_limit_1.authLimiter, (0, validate_middleware_1.validate)(auth_validator_1.passwordResetRequestSchema), auth_controller_1.passwordResetRequest);
router.post('/password-reset-confirm', rate_limit_1.authLimiter, (0, validate_middleware_1.validate)(auth_validator_1.passwordResetConfirmSchema), auth_controller_1.passwordResetConfirm);
// Sync user after Supabase auth
router.post('/sync', auth_controller_1.sync);
// Protected endpoints
router.get('/me', auth_middleware_1.requireAuth, auth_controller_1.getMe);
router.delete('/delete-account', auth_middleware_1.requireAuth, auth_controller_1.deleteAccount);
exports.default = router;
