import { NextFunction, Request, Response } from 'express';
import { FeeService } from '../services/fee.service';
import { sendError, sendSuccess } from '@/utils/api-response';

export class FeeController {
  /**
   * POST /fees/structures - Create a fee structure
   */
  static async createFeeStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, courseId, name, description, baseAmount, ruleType, ruleValue, attendanceThreshold, isActive, effectiveFrom, effectiveUntil } = req.body;

      if (!batchId || !name || baseAmount === undefined || !effectiveFrom) {
        return sendError(res, 'Missing required fields: batchId, name, baseAmount, effectiveFrom', 400);
      }

      const structure = await FeeService.createFeeStructure(
        { batchId, courseId, name, description, baseAmount, ruleType, ruleValue, attendanceThreshold, isActive, effectiveFrom, effectiveUntil },
        req.user!.id,
      );

      return sendSuccess(res, structure, 'Fee structure created', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /fees/structures - List fee structures
   */
  static async listFeeStructures(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, courseId, isActive, page, limit } = req.query;

      const result = await FeeService.listFeeStructures({
        batchId: batchId as string | undefined,
        courseId: courseId as string | undefined,
        isActive: isActive ? (isActive as string) === 'true' : undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      return sendSuccess(res, result, 'Fee structures retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /fees/structures/:id - Update fee structure
   */
  static async updateFeeStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      const structure = await FeeService.updateFeeStructure(id, data, req.user!.id);
      return sendSuccess(res, structure, 'Fee structure updated', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /fees/invoices - Create an invoice
   */
  static async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, feeStructureId, batchId, courseId, amount, dueDate, description, attendedClasses } = req.body;

      if (!studentId || !feeStructureId || !batchId || !courseId || amount === undefined || !dueDate) {
        return sendError(res, 'Missing required fields', 400);
      }

      const invoice = await FeeService.createInvoice(
        { studentId, feeStructureId, batchId, courseId, amount, dueDate, description, attendedClasses },
        req.user!.id,
      );

      return sendSuccess(res, invoice, 'Invoice created', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /fees/payments - Record a payment
   */
  static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceId, amount, paymentMethod, transactionId, notes } = req.body;

      if (!invoiceId || !amount || !paymentMethod) {
        return sendError(res, 'Missing required fields: invoiceId, amount, paymentMethod', 400);
      }

      const payment = await FeeService.recordPayment(
        { invoiceId, amount, paymentMethod, transactionId, notes },
        req.user!.id,
      );

      return sendSuccess(res, payment, 'Payment recorded', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /fees/invoices - Get payment history/invoices
   */
  static async getPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, batchId, status, page, limit } = req.query;

      const result = await FeeService.getPaymentHistory({
        studentId: studentId as string | undefined,
        batchId: batchId as string | undefined,
        status: status as any,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      return sendSuccess(res, result, 'Payment history retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /fees/revenue - Revenue dashboard (Owner/Admin only)
   */
  static async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, courseId, startDate, endDate, groupBy } = req.query;

      const report = await FeeService.getRevenueReport({
        batchId: batchId as string | undefined,
        courseId: courseId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        groupBy: (groupBy as any) || 'month',
      });

      return sendSuccess(res, report, 'Revenue report retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /fees/pending - Pending payments dashboard
   */
  static async getPendingPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const pending = await FeeService.getPendingPayments();
      return sendSuccess(res, pending, 'Pending payments retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }
}
