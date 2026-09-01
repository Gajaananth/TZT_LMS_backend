"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fee_controller_1 = require("../controllers/fee.controller");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const validate_middleware_1 = require("../../../middleware/validate.middleware");
const fee_validator_1 = require("../validators/fee.validator");
const router = (0, express_1.Router)({ mergeParams: true });
// All routes require authentication
router.use(auth_middleware_1.requireAuth);
/**
 * POST /api/v1/fees/structures - Create configurable fee structure
 * Supports: FIXED, PER_CLASS, PER_ATTENDANCE pricing models
 * Body: { batchId, courseId?, name, baseAmount, ruleType, ruleValue?, attendanceThreshold?, effectiveFrom, effectiveUntil? }
 */
router.post('/structures', (0, validate_middleware_1.validate)(fee_validator_1.createFeeStructureSchema), fee_controller_1.FeeController.createFeeStructure);
/**
 * GET /api/v1/fees/structures - List fee structures
 * Query: { batchId?, courseId?, isActive?, page, limit }
 */
router.get('/structures', (0, validate_middleware_1.validate)(fee_validator_1.listFeeStructuresSchema, 'query'), fee_controller_1.FeeController.listFeeStructures);
/**
 * PATCH /api/v1/fees/structures/:id - Update fee structure
 */
router.patch('/structures/:id', (0, validate_middleware_1.validate)(fee_validator_1.updateFeeStructureSchema), fee_controller_1.FeeController.updateFeeStructure);
/**
 * POST /api/v1/fees/invoices - Create invoice
 * AUTO-TRIGGER: Will check attendance threshold and create if crossed
 */
router.post('/invoices', (0, validate_middleware_1.validate)(fee_validator_1.createInvoiceSchema), fee_controller_1.FeeController.createInvoice);
/**
 * GET /api/v1/fees/invoices - Get payment history
 * Query: { studentId?, batchId?, status?, page, limit }
 */
router.get('/invoices', (0, validate_middleware_1.validate)(fee_validator_1.getPaymentHistorySchema, 'query'), fee_controller_1.FeeController.getPaymentHistory);
/**
 * POST /api/v1/fees/payments - Record payment
 * Body: { invoiceId, amount, paymentMethod, transactionId?, notes? }
 */
router.post('/payments', (0, validate_middleware_1.validate)(fee_validator_1.recordPaymentSchema), fee_controller_1.FeeController.recordPayment);
/**
 * GET /api/v1/fees/revenue - Revenue dashboard (Owner/Admin)
 * Query: { batchId?, courseId?, startDate?, endDate?, groupBy }
 * Returns: Recharts-compatible chart data
 */
router.get('/revenue', (0, validate_middleware_1.validate)(fee_validator_1.revenueReportSchema, 'query'), fee_controller_1.FeeController.getRevenueReport);
/**
 * GET /api/v1/fees/pending - Pending payments dashboard
 */
router.get('/pending', fee_controller_1.FeeController.getPendingPayments);
exports.default = router;
