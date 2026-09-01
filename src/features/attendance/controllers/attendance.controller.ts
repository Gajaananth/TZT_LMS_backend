import { NextFunction, Request, Response } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { sendError, sendSuccess } from '@/utils/api-response';

export class AttendanceController {
  /**
   * POST /attendance - Record attendance for a student
   * Allows backdating via classDate parameter
   */
  static async recordAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, courseId, batchId, classDate, status, moduleId, remarks } = req.body;

      if (!studentId || !courseId || !batchId || !classDate || !status) {
        return sendError(res, 'Missing required fields: studentId, courseId, batchId, classDate, status', 400);
      }

      const record = await AttendanceService.recordAttendance(
        { studentId, courseId, batchId, moduleId, classDate, status, remarks },
        req.user!.id,
      );

      return sendSuccess(res, record, 'Attendance recorded successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /attendance/bulk - Bulk record attendance (e.g., from CSV)
   */
  static async bulkRecordAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const records = req.body;

      if (!Array.isArray(records) || records.length === 0) {
        return sendError(res, 'Expected array of attendance records', 400);
      }

      const result = await AttendanceService.bulkRecordAttendance(records, req.user!.id);
      return sendSuccess(res, result, `${result.total} attendance records created`, 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /attendance - View attendance records with filtering and breakdown
   * Views: batch, course, student, date
   */
  static async getAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, batchId, courseId, moduleId, startDate, endDate, status, viewBy } = req.query;

      const result = await AttendanceService.getAttendanceRecords({
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        batchId: batchId as string | undefined,
        courseId: courseId as string | undefined,
        moduleId: moduleId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as any,
        viewBy: (viewBy as any) || 'date',
      });

      return sendSuccess(res, result, 'Attendance records retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /attendance/student/:studentId - Get a specific student's attendance history
   */
  static async getStudentAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      const history = await AttendanceService.getStudentAttendanceHistory(studentId, courseId as string | undefined);
      return sendSuccess(res, history, 'Student attendance history retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /attendance/:id/correct - Correct attendance (append-only pattern)
   * Creates audit trail entry, never mutates original
   */
  static async correctAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { originalAttendanceId, newStatus, reason } = req.body;

      if (!originalAttendanceId || !newStatus || !reason) {
        return sendError(res, 'Missing required fields: originalAttendanceId, newStatus, reason', 400);
      }

      const result = await AttendanceService.correctAttendance(
        { originalAttendanceId, newStatus, reason },
        req.user!.id,
      );

      return sendSuccess(res, result, 'Attendance corrected successfully (append-only)', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /attendance/summary - Get attendance summary report
   * Types: summary, detailed, exception
   */
  static async getAttendanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, courseId, startDate, endDate, reportType } = req.query;

      const summary = await AttendanceService.getAttendanceSummary({
        batchId: batchId as string | undefined,
        courseId: courseId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        reportType: (reportType as any) || 'summary',
      });

      return sendSuccess(res, summary, 'Attendance summary retrieved', 200);
    } catch (error) {
      return next(error);
    }
  }
}
