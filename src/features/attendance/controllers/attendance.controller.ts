import { NextFunction, Request, Response } from 'express';
import { prisma } from '@/db/prisma/client';
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
      const user = req.user;
      const roles = user?.userRoles?.map((ur: any) => ur.role?.name || ur) || [];

      let studentIdFilter: string | undefined = undefined;
      let teacherCourseIds: string[] | undefined = undefined;

      if (roles.includes('Student') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
        const student = await prisma.student.findUnique({ where: { userId: user!.id } });
        studentIdFilter = student ? student.id : 'no-match';
      } else if (roles.includes('Teacher') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: user!.id },
          include: { teacherAssignments: true },
        });
        if (teacher) {
          teacherCourseIds = teacher.teacherAssignments.map(ta => ta.courseId);
        }
      }

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
        studentId: studentIdFilter,
        courseIds: teacherCourseIds,
      } as any);

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

  /**
   * GET /attendance/options - Dropdown options used by the recording UI:
   * lists batches, courses, and students for the authenticated user context.
   */
  static async getOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const roles = user?.userRoles?.map((ur: any) => ur.role?.name || ur) || [];

      if (roles.includes('Student') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
        return sendSuccess(res, { batches: [], courses: [], students: [] }, 'Attendance options retrieved', 200);
      }

      if (roles.includes('Teacher') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: user!.id },
          include: {
            teacherAssignments: {
              include: {
                batch: { select: { id: true, name: true, code: true } },
                course: { select: { id: true, title: true, code: true } },
              },
            },
          },
        });

        if (!teacher) {
          return sendSuccess(res, { batches: [], courses: [], students: [] }, 'Attendance options retrieved', 200);
        }

        const courseIds = teacher.teacherAssignments.map((ta: any) => ta.courseId);
        const batchIds = teacher.teacherAssignments.map((ta: any) => ta.batchId);

        const batchesMap = new Map<string, any>();
        const coursesMap = new Map<string, any>();
        for (const ta of teacher.teacherAssignments) {
          if (ta.batch) batchesMap.set(ta.batch.id, ta.batch);
          if (ta.course) coursesMap.set(ta.course.id, ta.course);
        }

        const enrollments = await prisma.enrollment.findMany({
          where: {
            deletedAt: null,
            OR: [
              { courseId: { in: courseIds } },
              { batchId: { in: batchIds } },
            ],
          },
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        });

        const studentsMap = new Map<string, any>();
        for (const e of enrollments) {
          if (e.student && !studentsMap.has(e.student.id)) {
            studentsMap.set(e.student.id, {
              id: e.student.id,
              studentId: e.student.studentId,
              name:
                `${e.student.user?.firstName ?? ''} ${e.student.user?.lastName ?? ''}`.trim() ||
                e.student.studentId ||
                'Student',
              email: e.student.user?.email || null,
            });
          }
        }

        return sendSuccess(
          res,
          {
            batches: Array.from(batchesMap.values()),
            courses: Array.from(coursesMap.values()),
            students: Array.from(studentsMap.values()),
          },
          'Attendance options retrieved',
          200,
        );
      }

      const [batches, courses, students] = await Promise.all([
        prisma.batch.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
          take: 200,
        }),
        prisma.course.findMany({
          where: { deletedAt: null },
          select: { id: true, title: true, code: true },
          orderBy: { title: 'asc' },
          take: 200,
        }),
        prisma.student.findMany({
          where: { deletedAt: null },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
      ]);

      return sendSuccess(
        res,
        {
          batches: batches || [],
          courses: courses || [],
          students:
            students?.map((s: any) => ({
              id: s.id,
              studentId: s.studentId,
              name:
                `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() ||
                s.studentId ||
                'Student',
              email: s.user?.email || null,
            })) || [],
        },
        'Attendance options retrieved',
        200,
      );
    } catch (error) {
      return next(error);
    }
  }
}
