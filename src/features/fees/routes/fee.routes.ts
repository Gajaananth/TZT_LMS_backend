import { Router } from 'express';
import { FeeController } from '../controllers/fee.controller';
import { requireAuth } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import {
  createFeeStructureSchema,
  updateFeeStructureSchema,
  listFeeStructuresSchema,
  createInvoiceSchema,
  recordPaymentSchema,
  getPaymentHistorySchema,
  revenueReportSchema,
} from '../validators/fee.validator';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/fees/structures - Create configurable fee structure
 * Supports: FIXED, PER_CLASS, PER_ATTENDANCE pricing models
 * Body: { batchId, courseId?, name, baseAmount, ruleType, ruleValue?, attendanceThreshold?, effectiveFrom, effectiveUntil? }
 */
router.post('/structures', validate(createFeeStructureSchema), FeeController.createFeeStructure);

/**
 * GET /api/v1/fees/structures - List fee structures
 * Query: { batchId?, courseId?, isActive?, page, limit }
 */
router.get('/structures', validate(listFeeStructuresSchema, 'query'), FeeController.listFeeStructures);

/**
 * PATCH /api/v1/fees/structures/:id - Update fee structure
 */
router.patch('/structures/:id', validate(updateFeeStructureSchema), FeeController.updateFeeStructure);

/**
 * POST /api/v1/fees/invoices - Create invoice
 * AUTO-TRIGGER: Will check attendance threshold and create if crossed
 */
router.post('/invoices', validate(createInvoiceSchema), FeeController.createInvoice);

/**
 * GET /api/v1/fees/invoices - Get payment history
 * Query: { studentId?, batchId?, status?, page, limit }
 */
router.get('/invoices', validate(getPaymentHistorySchema, 'query'), FeeController.getPaymentHistory);

/**
 * POST /api/v1/fees/payments - Record payment
 * Body: { invoiceId, amount, paymentMethod, transactionId?, notes? }
 */
router.post('/payments', validate(recordPaymentSchema), FeeController.recordPayment);

/**
 * GET /api/v1/fees/revenue - Revenue dashboard (Owner/Admin)
 * Query: { batchId?, courseId?, startDate?, endDate?, groupBy }
 * Returns: Recharts-compatible chart data
 */
router.get('/revenue', validate(revenueReportSchema, 'query'), FeeController.getRevenueReport);

/**
 * GET /api/v1/fees/pending - Pending payments dashboard
 */
router.get('/pending', FeeController.getPendingPayments);

export default router;
