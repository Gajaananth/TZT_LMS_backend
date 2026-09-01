"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceReportSchema = exports.correctAttendanceSchema = exports.getAttendanceViewSchema = exports.bulkRecordAttendanceSchema = exports.recordAttendanceSchema = void 0;
const zod_1 = require("zod");
exports.recordAttendanceSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid('Invalid student ID'),
    courseId: zod_1.z.string().uuid('Invalid course ID'),
    batchId: zod_1.z.string().uuid('Invalid batch ID'),
    moduleId: zod_1.z.string().uuid('Invalid module ID').optional(),
    classDate: zod_1.z.string().datetime('Invalid class date').or(zod_1.z.coerce.date()), // Allows backdating
    status: zod_1.z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    remarks: zod_1.z.string().optional(),
});
exports.bulkRecordAttendanceSchema = zod_1.z.array(exports.recordAttendanceSchema).min(1, 'At least one record required');
exports.getAttendanceViewSchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).default('1').optional(),
    limit: zod_1.z.string().transform(Number).default('50').optional(),
    batchId: zod_1.z.string().uuid().optional(),
    courseId: zod_1.z.string().uuid().optional(),
    moduleId: zod_1.z.string().uuid().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
    viewBy: zod_1.z.enum(['batch', 'course', 'student', 'date']).default('date'),
});
exports.correctAttendanceSchema = zod_1.z.object({
    originalAttendanceId: zod_1.z.string().uuid('Invalid attendance ID'),
    newStatus: zod_1.z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    reason: zod_1.z.string().min(5, 'Correction reason must be at least 5 characters'),
});
exports.attendanceReportSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid().optional(),
    courseId: zod_1.z.string().uuid().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    reportType: zod_1.z.enum(['summary', 'detailed', 'exception']).default('summary'),
});
