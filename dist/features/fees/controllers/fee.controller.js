"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeController = void 0;
const client_1 = require("../../../db/prisma/client");
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
            let { studentId, batchId, status, page, limit } = req.query;
            const user = req.user;
            const roles = user?.userRoles?.map((ur) => ur.role?.name || ur) || [];
            // If student, strictly force studentId to their own
            if (roles.includes('Student') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
                const student = await client_1.prisma.student.findUnique({ where: { userId: user.id } });
                studentId = student ? student.id : 'no-match';
            }
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
     * GET /fees/student/me - Student self-view of their fee summary and invoices
     */
    static async getMyFeeStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const student = await client_1.prisma.student.findUnique({
                where: { userId },
                include: {
                    enrollments: {
                        where: { deletedAt: null },
                        include: { course: true, batch: true },
                    },
                },
            });
            if (!student) {
                return (0, api_response_1.sendSuccess)(res, { balance: 0, status: 'Cleared', invoices: [], totalPaid: 0, totalAmount: 0 });
            }
            const invoices = await client_1.prisma.invoice.findMany({
                where: { studentId: student.id, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                include: {
                    payments: { where: { deletedAt: null } },
                    feeStructure: true,
                },
            });
            let totalAmount = 0;
            let totalPaid = 0;
            const formattedInvoices = invoices.map((inv) => {
                const amount = Number(inv.totalAmount || inv.amount || 0);
                const paid = inv.payments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
                totalAmount += amount;
                totalPaid += paid;
                return {
                    id: inv.id,
                    invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 8),
                    feeName: inv.feeStructure?.name || 'Course Fee',
                    amount,
                    paidAmount: paid,
                    remainingAmount: Math.max(0, amount - paid),
                    status: inv.status,
                    dueDate: inv.dueDate,
                    createdAt: inv.createdAt,
                    payments: inv.payments || [],
                };
            });
            const balance = Math.max(0, totalAmount - totalPaid);
            let status = 'Cleared';
            const now = new Date();
            if (balance === 0) {
                status = 'Cleared';
            }
            else if (invoices.some((i) => i.dueDate && new Date(i.dueDate) < now && i.status !== 'PAID')) {
                status = 'Overdue';
            }
            else if (totalPaid > 0) {
                status = 'Partial';
            }
            else {
                status = 'Pending';
            }
            return (0, api_response_1.sendSuccess)(res, {
                studentId: student.id,
                studentName: `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim(),
                balance,
                status,
                totalAmount,
                totalPaid,
                invoices: formattedInvoices,
            }, 'Student fee status retrieved', 200);
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
    /**
     * GET /fees/teacher/student-status - Teacher view: list of students in their
     * assigned batches/courses with fee status (read-only).
     */
    static async getTeacherStudentStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const students = await fee_service_1.FeeService.getTeacherStudentStatuses(userId);
            return (0, api_response_1.sendSuccess)(res, { students }, 'Student fee status retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.FeeController = FeeController;
