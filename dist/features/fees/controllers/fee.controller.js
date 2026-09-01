"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeController = void 0;
const fee_service_1 = require("../services/fee.service");
const api_response_1 = require("../../../utils/api-response");
class FeeController {
    /**
     * POST /fees/structures - Create a fee structure
     */
    static async createFeeStructure(req, res, next) {
        try {
            const { batchId, courseId, name, description, baseAmount, ruleType, ruleValue, attendanceThreshold, isActive, effectiveFrom, effectiveUntil } = req.body;
            if (!batchId || !name || baseAmount === undefined || !effectiveFrom) {
                return (0, api_response_1.sendError)(res, 'Missing required fields: batchId, name, baseAmount, effectiveFrom', 400);
            }
            const structure = await fee_service_1.FeeService.createFeeStructure({ batchId, courseId, name, description, baseAmount, ruleType, ruleValue, attendanceThreshold, isActive, effectiveFrom, effectiveUntil }, req.user.id);
            return (0, api_response_1.sendSuccess)(res, structure, 'Fee structure created', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /fees/structures - List fee structures
     */
    static async listFeeStructures(req, res, next) {
        try {
            const { batchId, courseId, isActive, page, limit } = req.query;
            const result = await fee_service_1.FeeService.listFeeStructures({
                batchId: batchId,
                courseId: courseId,
                isActive: isActive ? isActive === 'true' : undefined,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
            });
            return (0, api_response_1.sendSuccess)(res, result, 'Fee structures retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * PATCH /fees/structures/:id - Update fee structure
     */
    static async updateFeeStructure(req, res, next) {
        try {
            const { id } = req.params;
            const data = req.body;
            const structure = await fee_service_1.FeeService.updateFeeStructure(id, data, req.user.id);
            return (0, api_response_1.sendSuccess)(res, structure, 'Fee structure updated', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /fees/invoices - Create an invoice
     */
    static async createInvoice(req, res, next) {
        try {
            const { studentId, feeStructureId, batchId, courseId, amount, dueDate, description, attendedClasses } = req.body;
            if (!studentId || !feeStructureId || !batchId || !courseId || amount === undefined || !dueDate) {
                return (0, api_response_1.sendError)(res, 'Missing required fields', 400);
            }
            const invoice = await fee_service_1.FeeService.createInvoice({ studentId, feeStructureId, batchId, courseId, amount, dueDate, description, attendedClasses }, req.user.id);
            return (0, api_response_1.sendSuccess)(res, invoice, 'Invoice created', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /fees/payments - Record a payment
     */
    static async recordPayment(req, res, next) {
        try {
            const { invoiceId, amount, paymentMethod, transactionId, notes } = req.body;
            if (!invoiceId || !amount || !paymentMethod) {
                return (0, api_response_1.sendError)(res, 'Missing required fields: invoiceId, amount, paymentMethod', 400);
            }
            const payment = await fee_service_1.FeeService.recordPayment({ invoiceId, amount, paymentMethod, transactionId, notes }, req.user.id);
            return (0, api_response_1.sendSuccess)(res, payment, 'Payment recorded', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /fees/invoices - Get payment history/invoices
     */
    static async getPaymentHistory(req, res, next) {
        try {
            const { studentId, batchId, status, page, limit } = req.query;
            const result = await fee_service_1.FeeService.getPaymentHistory({
                studentId: studentId,
                batchId: batchId,
                status: status,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
            });
            return (0, api_response_1.sendSuccess)(res, result, 'Payment history retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /fees/revenue - Revenue dashboard (Owner/Admin only)
     */
    static async getRevenueReport(req, res, next) {
        try {
            const { batchId, courseId, startDate, endDate, groupBy } = req.query;
            const report = await fee_service_1.FeeService.getRevenueReport({
                batchId: batchId,
                courseId: courseId,
                startDate: startDate,
                endDate: endDate,
                groupBy: groupBy || 'month',
            });
            return (0, api_response_1.sendSuccess)(res, report, 'Revenue report retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /fees/pending - Pending payments dashboard
     */
    static async getPendingPayments(req, res, next) {
        try {
            const pending = await fee_service_1.FeeService.getPendingPayments();
            return (0, api_response_1.sendSuccess)(res, pending, 'Pending payments retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.FeeController = FeeController;
