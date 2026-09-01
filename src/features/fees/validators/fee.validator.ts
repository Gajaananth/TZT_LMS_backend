import { z } from 'zod';

export const createFeeStructureSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  courseId: z.string().uuid('Invalid course ID').optional(),
  name: z.string().min(3, 'Fee structure name required'),
  description: z.string().optional(),
  // Configurable pricing rules
  baseAmount: z.number().nonnegative('Base amount cannot be negative'),
  ruleType: z.enum(['FIXED', 'PER_CLASS', 'PER_ATTENDANCE']).default('FIXED'),
  ruleValue: z.number().nonnegative().optional(), // e.g., for PER_CLASS: Rs 150 per 8 classes
  attendanceThreshold: z.number().min(0).max(100, 'Threshold must be 0-100').optional(), // Percentage
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().optional(),
});

export const updateFeeStructureSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  baseAmount: z.number().nonnegative().optional(),
  ruleType: z.enum(['FIXED', 'PER_CLASS', 'PER_ATTENDANCE']).optional(),
  ruleValue: z.number().nonnegative().optional(),
  attendanceThreshold: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  effectiveUntil: z.string().datetime().optional(),
});

export const listFeeStructuresSchema = z.object({
  batchId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  page: z.string().transform(Number).default('1').optional(),
  limit: z.string().transform(Number).default('10').optional(),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  feeStructureId: z.string().uuid('Invalid fee structure ID'),
  batchId: z.string().uuid('Invalid batch ID'),
  courseId: z.string().uuid('Invalid course ID'),
  amount: z.number().nonnegative('Amount cannot be negative'),
  dueDate: z.string().datetime('Invalid due date'),
  description: z.string().optional(),
  attendedClasses: z.number().nonnegative('Classes cannot be negative').optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE_WALLET', 'UPI']),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

export const getPaymentHistorySchema = z.object({
  studentId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'REFUNDED']).optional(),
  page: z.string().transform(Number).default('1').optional(),
  limit: z.string().transform(Number).default('20').optional(),
});

export const revenueReportSchema = z.object({
  batchId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['batch', 'course', 'month']).default('month'),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;
export type ListFeeStructuresQuery = z.infer<typeof listFeeStructuresSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type GetPaymentHistoryQuery = z.infer<typeof getPaymentHistorySchema>;
export type RevenueReportQuery = z.infer<typeof revenueReportSchema>;
