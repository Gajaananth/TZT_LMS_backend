"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const attendance_service_1 = require("../services/attendance.service");
const api_response_1 = require("../../../utils/api-response");
class AttendanceController {
    /**
     * POST /attendance - Record attendance for a student
     * Allows backdating via classDate parameter
     */
    static async recordAttendance(req, res, next) {
        try {
            const { studentId, courseId, batchId, classDate, status, moduleId, remarks } = req.body;
            if (!studentId || !courseId || !batchId || !classDate || !status) {
                return (0, api_response_1.sendError)(res, 'Missing required fields: studentId, courseId, batchId, classDate, status', 400);
            }
            const record = await attendance_service_1.AttendanceService.recordAttendance({ studentId, courseId, batchId, moduleId, classDate, status, remarks }, req.user.id);
            return (0, api_response_1.sendSuccess)(res, record, 'Attendance recorded successfully', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /attendance/bulk - Bulk record attendance (e.g., from CSV)
     */
    static async bulkRecordAttendance(req, res, next) {
        try {
            const records = req.body;
            if (!Array.isArray(records) || records.length === 0) {
                return (0, api_response_1.sendError)(res, 'Expected array of attendance records', 400);
            }
            const result = await attendance_service_1.AttendanceService.bulkRecordAttendance(records, req.user.id);
            return (0, api_response_1.sendSuccess)(res, result, `${result.total} attendance records created`, 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /attendance - View attendance records with filtering and breakdown
     * Views: batch, course, student, date
     */
    static async getAttendance(req, res, next) {
        try {
            const { page, limit, batchId, courseId, moduleId, startDate, endDate, status, viewBy } = req.query;
            const result = await attendance_service_1.AttendanceService.getAttendanceRecords({
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 50,
                batchId: batchId,
                courseId: courseId,
                moduleId: moduleId,
                startDate: startDate,
                endDate: endDate,
                status: status,
                viewBy: viewBy || 'date',
            });
            return (0, api_response_1.sendSuccess)(res, result, 'Attendance records retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /attendance/student/:studentId - Get a specific student's attendance history
     */
    static async getStudentAttendance(req, res, next) {
        try {
            const { studentId } = req.params;
            const { courseId } = req.query;
            const history = await attendance_service_1.AttendanceService.getStudentAttendanceHistory(studentId, courseId);
            return (0, api_response_1.sendSuccess)(res, history, 'Student attendance history retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /attendance/:id/correct - Correct attendance (append-only pattern)
     * Creates audit trail entry, never mutates original
     */
    static async correctAttendance(req, res, next) {
        try {
            const { originalAttendanceId, newStatus, reason } = req.body;
            if (!originalAttendanceId || !newStatus || !reason) {
                return (0, api_response_1.sendError)(res, 'Missing required fields: originalAttendanceId, newStatus, reason', 400);
            }
            const result = await attendance_service_1.AttendanceService.correctAttendance({ originalAttendanceId, newStatus, reason }, req.user.id);
            return (0, api_response_1.sendSuccess)(res, result, 'Attendance corrected successfully (append-only)', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /attendance/summary - Get attendance summary report
     * Types: summary, detailed, exception
     */
    static async getAttendanceSummary(req, res, next) {
        try {
            const { batchId, courseId, startDate, endDate, reportType } = req.query;
            const summary = await attendance_service_1.AttendanceService.getAttendanceSummary({
                batchId: batchId,
                courseId: courseId,
                startDate: startDate,
                endDate: endDate,
                reportType: reportType || 'summary',
            });
            return (0, api_response_1.sendSuccess)(res, summary, 'Attendance summary retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.AttendanceController = AttendanceController;
