"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const client_1 = require("../../../db/prisma/client");
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
            const user = req.user;
            const roles = user?.userRoles?.map((ur) => ur.role?.name || ur) || [];
            let studentIdFilter = undefined;
            let teacherCourseIds = undefined;
            if (roles.includes('Student') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
                const student = await client_1.prisma.student.findUnique({ where: { userId: user.id } });
                studentIdFilter = student ? student.id : 'no-match';
            }
            else if (roles.includes('Teacher') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
                const teacher = await client_1.prisma.teacher.findUnique({
                    where: { userId: user.id },
                    include: { teacherAssignments: true },
                });
                if (teacher) {
                    teacherCourseIds = teacher.teacherAssignments.map(ta => ta.courseId);
                }
            }
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
                studentId: studentIdFilter,
                courseIds: teacherCourseIds,
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
    /**
     * GET /attendance/options - Dropdown options used by the recording UI:
     * lists batches, courses, and students for the authenticated user context.
     */
    static async getOptions(req, res, next) {
        try {
            const user = req.user;
            const roles = user?.userRoles?.map((ur) => ur.role?.name || ur) || [];
            if (roles.includes('Student') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
                return (0, api_response_1.sendSuccess)(res, { batches: [], courses: [], students: [] }, 'Attendance options retrieved', 200);
            }
            if (roles.includes('Teacher') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
                const teacher = await client_1.prisma.teacher.findUnique({
                    where: { userId: user.id },
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
                    return (0, api_response_1.sendSuccess)(res, { batches: [], courses: [], students: [] }, 'Attendance options retrieved', 200);
                }
                const courseIds = teacher.teacherAssignments.map((ta) => ta.courseId);
                const batchIds = teacher.teacherAssignments.map((ta) => ta.batchId);
                const batchesMap = new Map();
                const coursesMap = new Map();
                for (const ta of teacher.teacherAssignments) {
                    if (ta.batch)
                        batchesMap.set(ta.batch.id, ta.batch);
                    if (ta.course)
                        coursesMap.set(ta.course.id, ta.course);
                }
                const enrollments = await client_1.prisma.enrollment.findMany({
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
                const studentsMap = new Map();
                for (const e of enrollments) {
                    if (e.student && !studentsMap.has(e.student.id)) {
                        studentsMap.set(e.student.id, {
                            id: e.student.id,
                            studentId: e.student.studentId,
                            name: `${e.student.user?.firstName ?? ''} ${e.student.user?.lastName ?? ''}`.trim() ||
                                e.student.studentId ||
                                'Student',
                            email: e.student.user?.email || null,
                        });
                    }
                }
                return (0, api_response_1.sendSuccess)(res, {
                    batches: Array.from(batchesMap.values()),
                    courses: Array.from(coursesMap.values()),
                    students: Array.from(studentsMap.values()),
                }, 'Attendance options retrieved', 200);
            }
            const [batches, courses, students] = await Promise.all([
                client_1.prisma.batch.findMany({
                    where: { isActive: true, deletedAt: null },
                    select: { id: true, name: true, code: true },
                    orderBy: { name: 'asc' },
                    take: 200,
                }),
                client_1.prisma.course.findMany({
                    where: { deletedAt: null },
                    select: { id: true, title: true, code: true },
                    orderBy: { title: 'asc' },
                    take: 200,
                }),
                client_1.prisma.student.findMany({
                    where: { deletedAt: null },
                    include: {
                        user: { select: { firstName: true, lastName: true, email: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 500,
                }),
            ]);
            return (0, api_response_1.sendSuccess)(res, {
                batches: batches || [],
                courses: courses || [],
                students: students?.map((s) => ({
                    id: s.id,
                    studentId: s.studentId,
                    name: `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() ||
                        s.studentId ||
                        'Student',
                    email: s.user?.email || null,
                })) || [],
            }, 'Attendance options retrieved', 200);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.AttendanceController = AttendanceController;
