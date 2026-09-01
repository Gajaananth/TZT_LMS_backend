import { prisma } from '@/db/prisma/client';
import { RecordAttendanceInput, CorrectAttendanceInput, GetAttendanceViewQuery, AttendanceReportQuery, BulkRecordAttendanceInput } from '../validators/attendance.validator';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceService {
  /**
   * Record attendance for a single student (append-only pattern)
   * Stores classDate (when class happened) and recordedAt (when record created, auto-set)
   */
  static async recordAttendance(data: RecordAttendanceInput, userId: string) {
    const record = await prisma.attendanceRecord.create({
      data: {
        studentId: data.studentId,
        courseId: data.courseId,
        batchId: data.batchId,
        moduleId: data.moduleId,
        classDate: new Date(data.classDate),
        attendanceDate: new Date(), // recordedAt
        status: data.status as AttendanceStatus,
        remarks: data.remarks,
        createdBy: userId,
      },
      include: {
        student: { select: { id: true, studentId: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        course: { select: { id: true, title: true, code: true } },
        batch: { select: { id: true, name: true } },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        tableName: 'AttendanceRecord',
        recordId: record.id,
        changes: { created: record },
        createdBy: userId,
      },
    });

    return record;
  }

  /**
   * Bulk record attendance (e.g., entire class from a sheet)
   */
  static async bulkRecordAttendance(records: BulkRecordAttendanceInput, userId: string) {
    const created = await Promise.all(
      records.map(record => this.recordAttendance(record, userId))
    );

    return {
      total: created.length,
      records: created,
    };
  }

  /**
   * Correct attendance via append-only pattern:
   * - Never mutate original record
   * - Create new correction record with auditTrail entry
   * - Mark original as "superseded" conceptually (via audit trail)
   */
  static async correctAttendance(data: CorrectAttendanceInput, userId: string) {
    // Get original record
    const original = await prisma.attendanceRecord.findUnique({
      where: { id: data.originalAttendanceId },
    });

    if (!original) {
      throw new Error('Attendance record not found');
    }

    // Create correction audit entry (append-only)
    const audit = await prisma.attendanceAudit.create({
      data: {
        attendanceId: original.id,
        oldValue: original.status,
        newValue: data.newStatus as AttendanceStatus,
        reason: data.reason,
        changedBy: userId,
        changedAt: new Date(),
      },
    });

    // Note: Original record status NOT updated to maintain append-only pattern
    // UI should show: original + all audit entries, with audit entries showing history
    // Latest status inferred from most recent audit entry

    // Log this as a system action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        tableName: 'AttendanceRecord',
        recordId: original.id,
        changes: {
          type: 'correction',
          reason: data.reason,
          oldStatus: original.status,
          newStatus: data.newStatus,
        },
        createdBy: userId,
      },
    });

    return { original, audit };
  }

  private static getEffectiveStatus(record: any) {
    if (Array.isArray(record.auditTrail) && record.auditTrail.length > 0) {
      const latestAudit = [...record.auditTrail].sort((a, b) => {
        const aTime = new Date(a.changedAt || 0).getTime();
        const bTime = new Date(b.changedAt || 0).getTime();
        return bTime - aTime;
      })[0];

      return latestAudit?.newValue || record.status;
    }

    return record.status;
  }

  /**
   * Get attendance records with flexible views
   */
  static async getAttendanceRecords(query: GetAttendanceViewQuery) {
    const {
      page = 1,
      limit = 50,
      batchId,
      courseId,
      moduleId,
      startDate,
      endDate,
      status,
      viewBy = 'date',
    } = query;

    const skip = (page - 1) * limit;

    const whereClause: any = { deletedAt: null };

    if (batchId) whereClause.batchId = batchId;
    if (courseId) whereClause.courseId = courseId;
    if (moduleId) whereClause.moduleId = moduleId;
    if (status) whereClause.status = status;

    if (startDate || endDate) {
      whereClause.classDate = {};
      if (startDate) whereClause.classDate.gte = new Date(startDate);
      if (endDate) whereClause.classDate.lte = new Date(endDate);
    }

    const orderBy: any = {};
    if (viewBy === 'date') orderBy.classDate = 'desc';
    if (viewBy === 'student') orderBy.studentId = 'asc';
    if (viewBy === 'course') orderBy.courseId = 'asc';
    if (viewBy === 'batch') orderBy.batchId = 'asc';

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      orderBy,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        course: { select: { id: true, code: true, title: true } },
        batch: { select: { id: true, name: true } },
        module: { select: { id: true, title: true } },
        auditTrail: { orderBy: { changedAt: 'desc' } },
      },
    });

    const normalizedRecords = records.map((r: any) => ({
      ...r,
      latestStatus: this.getEffectiveStatus(r),
    }));

    const filteredRecords = status
      ? normalizedRecords.filter((r: any) => r.latestStatus === status.toUpperCase())
      : normalizedRecords;

    const paginatedRecords = filteredRecords.slice(skip, skip + limit);

    const breakdown = {
      total: filteredRecords.length,
      present: filteredRecords.filter((r: any) => r.latestStatus === 'PRESENT').length,
      absent: filteredRecords.filter((r: any) => r.latestStatus === 'ABSENT').length,
      late: filteredRecords.filter((r: any) => r.latestStatus === 'LATE').length,
      excused: filteredRecords.filter((r: any) => r.latestStatus === 'EXCUSED').length,
    };

    return {
      records: paginatedRecords,
      breakdown,
      pagination: {
        total: filteredRecords.length,
        page,
        limit,
        totalPages: Math.ceil(filteredRecords.length / limit),
      },
    };
  }

  /**
   * Get student's attendance history (append-only view with audit trail)
   */
  static async getStudentAttendanceHistory(studentId: string, courseId?: string) {
    const records = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        ...(courseId && { courseId }),
        deletedAt: null,
      },
      orderBy: { classDate: 'desc' },
      take: 100,
      include: {
        course: { select: { id: true, code: true, title: true } },
        batch: { select: { id: true, name: true } },
        auditTrail: { orderBy: { changedAt: 'desc' } },
      },
    });

    return records.map((r: any) => ({
      ...r,
      latestStatus: this.getEffectiveStatus(r),
      history: [
        { date: r.attendanceDate, status: r.status, type: 'original' },
        ...r.auditTrail.map((a: any) => ({ date: a.changedAt, status: a.newValue, type: 'correction', reason: a.reason })),
      ],
    }));
  }

  /**
   * Get attendance summary by batch/course for a date range
   */
  static async getAttendanceSummary(query: AttendanceReportQuery) {
    const { batchId, courseId, startDate, endDate, reportType = 'summary' } = query;

    const whereClause: any = { deletedAt: null };
    if (batchId) whereClause.batchId = batchId;
    if (courseId) whereClause.courseId = courseId;

    if (startDate || endDate) {
      whereClause.classDate = {};
      if (startDate) whereClause.classDate.gte = new Date(startDate);
      if (endDate) whereClause.classDate.lte = new Date(endDate);
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        auditTrail: true,
      },
    });

    const normalizedRecords = records.map((r: any) => ({ ...r, latestStatus: this.getEffectiveStatus(r) }));

    if (reportType === 'summary') {
      return {
        totalClasses: new Set(normalizedRecords.map((r: any) => r.classDate.toDateString())).size,
        totalRecords: normalizedRecords.length,
        breakdown: {
          present: normalizedRecords.filter((r: any) => r.latestStatus === 'PRESENT').length,
          absent: normalizedRecords.filter((r: any) => r.latestStatus === 'ABSENT').length,
          late: normalizedRecords.filter((r: any) => r.latestStatus === 'LATE').length,
          excused: normalizedRecords.filter((r: any) => r.latestStatus === 'EXCUSED').length,
        },
        attendanceRate: normalizedRecords.length > 0 ? ((normalizedRecords.filter((r: any) => r.latestStatus === 'PRESENT' || r.latestStatus === 'LATE').length / normalizedRecords.length) * 100).toFixed(2) : '0.00',
      };
    }

    if (reportType === 'detailed') {
      const byStudent = normalizedRecords.reduce((acc: any, r: any) => {
        if (!acc[r.studentId]) {
          acc[r.studentId] = {
            student: r.student,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          };
        }
        acc[r.studentId].total++;
        acc[r.studentId][r.latestStatus.toLowerCase()]++;
        return acc;
      }, {});

      return Object.values(byStudent);
    }

    if (reportType === 'exception') {
      // Students with low attendance
      const byStudent = normalizedRecords.reduce((acc: any, r: any) => {
        if (!acc[r.studentId]) {
          acc[r.studentId] = { student: r.student, total: 0, present: 0 };
        }
        acc[r.studentId].total++;
        if (r.latestStatus === 'PRESENT' || r.latestStatus === 'LATE') acc[r.studentId].present++;
        return acc;
      }, {});

      return Object.values(byStudent)
        .filter((s: any) => s.total > 0 && (s.present / s.total) < 0.75)
        .sort((a: any, b: any) => (a.present / a.total) - (b.present / b.total));
    }
  }

  /**
   * Get latest status for a record (from audit trail or original)
   */
  static getLatestStatus(record: any) {
    if (record.auditTrail && record.auditTrail.length > 0) {
      return record.auditTrail[0].newValue;
    }
    return record.status;
  }
}
