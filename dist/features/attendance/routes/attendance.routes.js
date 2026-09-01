"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("../controllers/attendance.controller");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const rate_limit_1 = require("../../../middleware/rate-limit");
const validate_middleware_1 = require("../../../middleware/validate.middleware");
const attendance_validator_1 = require("../validators/attendance.validator");
const router = (0, express_1.Router)({ mergeParams: true });
// All routes require authentication
router.use(auth_middleware_1.requireAuth);
/**
 * POST /api/v1/attendance - Record attendance for a student
 * Allows classDate (for backdating) and auto-records attendanceDate
 * Body: { studentId, courseId, batchId, classDate, status, moduleId?, remarks? }
 */
router.post('/', (0, validate_middleware_1.validate)(attendance_validator_1.recordAttendanceSchema), attendance_controller_1.AttendanceController.recordAttendance);
/**
 * POST /api/v1/attendance/bulk - Bulk record attendance
 * Body: Array of attendance records
 */
router.post('/bulk', rate_limit_1.bulkLimiter, (0, validate_middleware_1.validate)(attendance_validator_1.bulkRecordAttendanceSchema), attendance_controller_1.AttendanceController.bulkRecordAttendance);
/**
 * GET /api/v1/attendance - View attendance with filtering
 * Query: { page, limit, batchId, courseId, moduleId, startDate, endDate, status, viewBy }
 * Returns: records with breakdown (present/absent/late/excused) and pagination
 */
router.get('/', (0, validate_middleware_1.validate)(attendance_validator_1.getAttendanceViewSchema, 'query'), attendance_controller_1.AttendanceController.getAttendance);
/**
 * GET /api/v1/attendance/student/:studentId - Get student's attendance history (append-only view)
 * Query: { courseId? }
 */
router.get('/student/:studentId', attendance_controller_1.AttendanceController.getStudentAttendance);
/**
 * POST /api/v1/attendance/correct - Correct attendance (creates audit entry, never mutates)
 * Body: { originalAttendanceId, newStatus, reason }
 * Restricted to Admin/SuperAdmin
 */
router.post('/correct', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin']), (0, validate_middleware_1.validate)(attendance_validator_1.correctAttendanceSchema), attendance_controller_1.AttendanceController.correctAttendance);
/**
 * GET /api/v1/attendance/summary - Get attendance summary report
 * Query: { batchId?, courseId?, startDate?, endDate?, reportType }
 * reportType: 'summary' | 'detailed' | 'exception'
 */
router.get('/summary', (0, validate_middleware_1.validate)(attendance_validator_1.attendanceReportSchema, 'query'), attendance_controller_1.AttendanceController.getAttendanceSummary);
exports.default = router;
