"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueReportSchema = exports.getPaymentHistorySchema = exports.recordPaymentSchema = exports.createInvoiceSchema = exports.listFeeStructuresSchema = exports.updateFeeStructureSchema = exports.createFeeStructureSchema = void 0;
const zod_1 = require("zod");
exports.createFeeStructureSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid('Invalid batch ID'),
    courseId: zod_1.z.string().uuid('Invalid course ID').optional(),
    name: zod_1.z.string().min(3, 'Fee structure name required'),
    description: zod_1.z.string().optional(),
    // Configurable pricing rules
    baseAmount: zod_1.z.number().nonnegative('Base amount cannot be negative'),
    ruleType: zod_1.z.enum(['FIXED', 'PER_CLASS', 'PER_ATTENDANCE']).default('FIXED'),
    ruleValue: zod_1.z.number().nonnegative().optional(), // e.g., for PER_CLASS: Rs 150 per 8 classes
    attendanceThreshold: zod_1.z.number().min(0).max(100, 'Threshold must be 0-100').optional(), // Percentage
    isActive: zod_1.z.boolean().default(true),
    effectiveFrom: zod_1.z.string().datetime(),
    effectiveUntil: zod_1.z.string().datetime().optional(),
});
exports.updateFeeStructureSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).optional(),
    description: zod_1.z.string().optional(),
    baseAmount: zod_1.z.number().nonnegative().optional(),
    ruleType: zod_1.z.enum(['FIXED', 'PER_CLASS', 'PER_ATTENDANCE']).optional(),
    ruleValue: zod_1.z.number().nonnegative().optional(),
    attendanceThreshold: zod_1.z.number().min(0).max(100).optional(),
    isActive: zod_1.z.boolean().optional(),
    effectiveUntil: zod_1.z.string().datetime().optional(),
});
exports.listFeeStructuresSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid().optional(),
    courseId: zod_1.z.string().uuid().optional(),
    isActive: zod_1.z.string().transform(v => v === 'true').optional(),
    page: zod_1.z.string().transform(Number).default('1').optional(),
    limit: zod_1.z.string().transform(Number).default('10').optional(),
});
exports.createInvoiceSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid('Invalid student ID'),
    feeStructureId: zod_1.z.string().uuid('Invalid fee structure ID'),
    batchId: zod_1.z.string().uuid('Invalid batch ID'),
    courseId: zod_1.z.string().uuid('Invalid course ID'),
    amount: zod_1.z.number().nonnegative('Amount cannot be negative'),
    dueDate: zod_1.z.string().datetime('Invalid due date'),
    description: zod_1.z.string().optional(),
    attendedClasses: zod_1.z.number().nonnegative('Classes cannot be negative').optional(),
});
exports.recordPaymentSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid('Invalid invoice ID'),
    amount: zod_1.z.number().positive('Payment amount must be greater than 0'),
    paymentMethod: zod_1.z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'ONLINE_WALLET', 'UPI']),
    transactionId: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.getPaymentHistorySchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid().optional(),
    batchId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(['PENDING', 'PAID', 'OVERDUE', 'REFUNDED']).optional(),
    page: zod_1.z.string().transform(Number).default('1').optional(),
    limit: zod_1.z.string().transform(Number).default('20').optional(),
});
exports.revenueReportSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid().optional(),
    courseId: zod_1.z.string().uuid().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    groupBy: zod_1.z.enum(['batch', 'course', 'month']).default('month'),
});
