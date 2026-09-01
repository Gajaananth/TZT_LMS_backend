import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';
import { bulkLimiter } from '@/middleware/rate-limit';
import { validate } from '@/middleware/validate.middleware';
import {
  recordAttendanceSchema,
  bulkRecordAttendanceSchema,
  getAttendanceViewSchema,
  correctAttendanceSchema,
  attendanceReportSchema,
} from '../validators/attendance.validator';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/attendance - Record attendance for a student
 * Allows classDate (for backdating) and auto-records attendanceDate
 * Body: { studentId, courseId, batchId, classDate, status, moduleId?, remarks? }
 */
router.post('/', validate(recordAttendanceSchema), AttendanceController.recordAttendance);

/**
 * POST /api/v1/attendance/bulk - Bulk record attendance
 * Body: Array of attendance records
 */
router.post('/bulk', bulkLimiter, validate(bulkRecordAttendanceSchema), AttendanceController.bulkRecordAttendance);

/**
 * GET /api/v1/attendance - View attendance with filtering
 * Query: { page, limit, batchId, courseId, moduleId, startDate, endDate, status, viewBy }
 * Returns: records with breakdown (present/absent/late/excused) and pagination
 */
router.get('/', validate(getAttendanceViewSchema, 'query'), AttendanceController.getAttendance);

/**
 * GET /api/v1/attendance/student/:studentId - Get student's attendance history (append-only view)
 * Query: { courseId? }
 */
router.get('/student/:studentId', AttendanceController.getStudentAttendance);

/**
 * POST /api/v1/attendance/correct - Correct attendance (creates audit entry, never mutates)
 * Body: { originalAttendanceId, newStatus, reason }
 * Restricted to Admin/SuperAdmin
 */
router.post('/correct', requireRole(['SuperAdmin', 'Admin']), validate(correctAttendanceSchema), AttendanceController.correctAttendance);

/**
 * GET /api/v1/attendance/summary - Get attendance summary report
 * Query: { batchId?, courseId?, startDate?, endDate?, reportType }
 * reportType: 'summary' | 'detailed' | 'exception'
 */
router.get('/summary', validate(attendanceReportSchema, 'query'), AttendanceController.getAttendanceSummary);

export default router;
