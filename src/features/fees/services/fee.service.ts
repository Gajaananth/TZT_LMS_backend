import { prisma } from '@/db/prisma/client';
import {
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
  ListFeeStructuresQuery,
  CreateInvoiceInput,
  RecordPaymentInput,
  GetPaymentHistoryQuery,
  RevenueReportQuery,
} from '../validators/fee.validator';

export class FeeService {
  /**
   * Create a configurable fee structure (rule-based, not hardcoded)
   * Supports FIXED, PER_CLASS, PER_ATTENDANCE pricing models
   */
  static async createFeeStructure(data: CreateFeeStructureInput, userId: string) {
    const feeStructure = await prisma.feeStructure.create({
      data: {
        batchId: data.batchId,
        courseId: data.courseId,
        name: data.name,
        description: data.description,
        amountPerClass: data.baseAmount,
        classesRequired: data.ruleValue ?? 0,
        isActive: data.isActive,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveUntil ? new Date(data.effectiveUntil) : null,
        createdBy: userId,
      },
      include: {
        batch: true,
        course: true,
      },
    });

    return feeStructure;
  }

  /**
   * Update fee structure (supports future rule changes without code edits)
   */
  static async updateFeeStructure(feeStructureId: string, data: UpdateFeeStructureInput, userId: string) {
    const feeStructure = await prisma.feeStructure.update({
      where: { id: feeStructureId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.baseAmount !== undefined ? { amountPerClass: data.baseAmount } : {}),
        ...(data.ruleValue !== undefined ? { classesRequired: data.ruleValue } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.effectiveUntil ? { effectiveTo: new Date(data.effectiveUntil) } : {}),
        updatedBy: userId,
      },
    });

    return feeStructure;
  }

  /**
   * List fee structures with filtering
   */
  static async listFeeStructures(query: ListFeeStructuresQuery) {
    const { batchId, courseId, isActive, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = { deletedAt: null };
    if (batchId) whereClause.batchId = batchId;
    if (courseId) whereClause.courseId = courseId;
    if (isActive !== undefined) whereClause.isActive = isActive;

    const [structures, total] = await Promise.all([
      prisma.feeStructure.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: { batch: true, course: true },
      }),
      prisma.feeStructure.count({ where: whereClause }),
    ]);

    return {
      structures,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Calculate fee based on configurable rule
   * Supports: FIXED, PER_CLASS, PER_ATTENDANCE
   */
  static async calculateFee(feeStructureId: string, attendedClasses: number = 0): Promise<number> {
    const feeStructure = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
    });

    if (!feeStructure) throw new Error('Fee structure not found');

    let amount = Number(feeStructure.amountPerClass);

    if (feeStructure.classesRequired > 0 && feeStructure.amountPerClass.toNumber() > 0) {
      const units = Math.floor(attendedClasses / feeStructure.classesRequired);
      amount = units * Number(feeStructure.amountPerClass);
    }

    return amount;
  }

  /**
   * Create an invoice
   */
  static async createInvoice(data: CreateInvoiceInput, userId: string) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now()}`,
        studentId: data.studentId,
        feeStructureId: data.feeStructureId,
        amount: data.amount,
        totalAmount: data.amount,
        taxAmount: 0,
        dueDate: new Date(data.dueDate),
        status: 'PENDING',
        createdBy: userId,
      },
      include: {
        student: { select: { id: true, studentId: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        feeStructure: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        tableName: 'Invoice',
        recordId: invoice.id,
        changes: { created: invoice },
        createdBy: userId,
      },
    });

    return invoice;
  }

  /**
   * AUTO-TRIGGER: Check student's attendance and create payment-due if threshold crossed
   * Called after attendance is recorded
   */
  static async checkAndCreatePaymentDue(studentId: string, courseId: string, batchId: string, userId: string) {
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        courseId,
        deletedAt: null,
      },
      include: { auditTrail: { orderBy: { changedAt: 'desc' } } },
    });

    const attendedClasses = attendanceRecords.filter((record: any) => {
      const latestStatus = record.auditTrail?.[0]?.newValue || record.status;
      return latestStatus === 'PRESENT' || latestStatus === 'LATE';
    }).length;

    // Get fee structure for this course/batch
    const feeStructure = await prisma.feeStructure.findFirst({
      where: {
        batchId,
        courseId,
        isActive: true,
        deletedAt: null,
        effectiveFrom: { lte: new Date() },
        effectiveTo: { gte: new Date() },
      },
    });

    if (!feeStructure) return null;

    // Check if attendance threshold crossed for auto-creating payment due
    if (feeStructure.amountPerClass.toNumber() > 0 && feeStructure.classesRequired > 0) {
      // Get total classes held
      const totalClasses = await prisma.attendanceRecord.findMany({
        where: { courseId, batchId, deletedAt: null },
        select: { classDate: true },
        distinct: ['classDate'],
      });

      const attendancePercentage = totalClasses.length > 0 ? (attendedClasses / totalClasses.length) * 100 : 0;

      if (attendancePercentage >= (feeStructure.classesRequired > 0 ? 100 : 0)) {
        // Check if invoice already exists
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            studentId,
            feeStructureId: feeStructure.id,
            status: 'PENDING',
          },
        });

        if (!existingInvoice) {
          // Calculate amount based on rule
          const amount = await this.calculateFee(feeStructure.id, attendedClasses);

          // Auto-create invoice
          const invoice = await this.createInvoice(
            {
              studentId,
              feeStructureId: feeStructure.id,
              batchId,
              courseId,
              amount,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
              description: `Fee for ${attendedClasses} attended classes`,
              attendedClasses,
            },
            userId,
          );

          // Create notification
          await prisma.notification.create({
            data: {
              userId: (await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } }))?.userId || '',
              type: 'FEE',
              title: 'Payment Due',
              body: `Payment of Rs. ${amount} is now due for ${attendedClasses} attended classes`,
              relatedId: invoice.id,
              relatedType: 'invoice',
            },
          });

          return invoice;
        }
      }
    }

    return null;
  }

  /**
   * Record a payment
   */
  static async recordPayment(data: RecordPaymentInput, userId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
    });

    if (!invoice) throw new Error('Invoice not found');

    const payment = await prisma.payment.create({
      data: {
        paymentNumber: `PAY-${Date.now()}`,
        invoiceId: data.invoiceId,
        studentId: invoice.studentId,
        amount: data.amount,
        taxAmount: 0,
        method: data.paymentMethod,
        transactionId: data.transactionId,
        status: 'PAID',
        paymentDate: new Date(),
        createdBy: userId,
      },
    });

    // Update invoice status if fully paid
    const totalPaid = await prisma.payment.aggregate({
      where: { invoiceId: data.invoiceId },
      _sum: { amount: true },
    });

    const totalPaidAmount = Number(totalPaid._sum.amount ?? 0);
    const invoiceAmount = Number(invoice.amount);

    if (totalPaidAmount >= invoiceAmount) {
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: { status: 'PAID' },
      });
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        tableName: 'Payment',
        recordId: payment.id,
        changes: { payment, invoiceStatus: totalPaidAmount >= invoiceAmount ? 'PAID' : 'PARTIAL' },
        createdBy: userId,
      },
    });

    return payment;
  }

  /**
   * Get payment history with filtering
   */
  static async getPaymentHistory(query: GetPaymentHistoryQuery) {
    const { studentId, batchId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const whereClause: any = { deletedAt: null };
    if (studentId) whereClause.studentId = studentId;
    if (status) whereClause.status = status;
    if (batchId) {
      whereClause.feeStructure = { is: { batchId } };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
          payments: true,
        },
      }),
      prisma.invoice.count({ where: whereClause }),
    ]);

    return {
      invoices: invoices.map((inv: any) => {
        const paidAmount = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        return {
          ...inv,
          paidAmount,
          remainingAmount: Math.max(0, Number(inv.amount) - paidAmount),
        };
      }),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get revenue dashboard data (Owner/Admin only)
   */
  static async getRevenueReport(query: RevenueReportQuery) {
    const { batchId, courseId, startDate, endDate, groupBy = 'month' } = query;

    const whereClause: any = { status: 'PAID', deletedAt: null };
    if (batchId || courseId) {
      whereClause.feeStructure = {
        is: {
          ...(batchId ? { batchId } : {}),
          ...(courseId ? { courseId } : {}),
        },
      };
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: { payments: true, feeStructure: { include: { batch: true, course: true } } },
    });

    const data: any = {};

    invoices.forEach((inv: any) => {
      let key: string;

      if (groupBy === 'batch') {
        key = inv.feeStructure?.batch?.name || 'Unknown';
      } else if (groupBy === 'course') {
        key = inv.feeStructure?.course?.title || 'Unknown';
      } else {
        // month
        key = new Date(inv.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
      }

      if (!data[key]) {
        data[key] = { revenue: 0, invoices: 0 };
      }

      const paidAmount = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      data[key].revenue += paidAmount;
      data[key].invoices++;
    });

    return {
      summary: {
        totalRevenue: invoices.reduce((sum: number, inv: any) => sum + inv.payments.reduce((s: number, p: any) => s + Number(p.amount), 0), 0),
        totalInvoices: invoices.length,
        avgInvoiceValue: invoices.length > 0 ? invoices.reduce((sum: number, inv: any) => sum + inv.payments.reduce((s: number, p: any) => s + Number(p.amount), 0), 0) / invoices.length : 0,
      },
      chartData: Object.entries(data).map(([label, value]: any) => ({
        label,
        revenue: value.revenue,
        invoices: value.invoices,
      })),
    };
  }

  /**
   * Get pending payments dashboard
   */
  static async getPendingPayments() {
    const pending = await prisma.invoice.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE'] }, deletedAt: null },
      include: { student: { include: { user: true } }, feeStructure: { include: { course: true, batch: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return pending.map((inv: any) => ({
      ...inv,
      isOverdue: inv.dueDate ? new Date() > inv.dueDate : false,
      daysOverdue: inv.dueDate ? Math.floor((new Date().getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
    }));
  }
}
