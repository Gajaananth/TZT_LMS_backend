"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherController = void 0;
const client_1 = require("../../../db/prisma/client");
const teacher_service_1 = require("../services/teacher.service");
const api_response_1 = require("../../../utils/api-response");
const supabase_1 = require("../../../lib/supabase");
class TeacherController {
    /**
     * POST /teachers - Create a new teacher
     * Only SuperAdmin, Admin can create teachers
     */
    static async createTeacher(req, res, next) {
        try {
            const { firstName, lastName, email, password, specialization, dateOfJoining, salary } = req.body;
            if (!firstName || !lastName || !email || !password) {
                return (0, api_response_1.sendError)(res, 'Missing required fields: firstName, lastName, email, password', 400);
            }
            // Create Supabase user
            const { data: supabaseUser, error: supabaseError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: false,
                user_metadata: { firstName, lastName },
            });
            if (supabaseError || !supabaseUser) {
                return (0, api_response_1.sendError)(res, supabaseError?.message || 'Failed to create user', 400);
            }
            // Get teacher role ID
            const teacherRole = await client_1.prisma.role.findUnique({ where: { name: 'Teacher' } });
            if (!teacherRole) {
                return (0, api_response_1.sendError)(res, 'Teacher role not found', 500);
            }
            // Create local user record
            const user = await client_1.prisma.user.create({
                data: {
                    supabaseUserId: supabaseUser.user.id,
                    email,
                    firstName,
                    lastName,
                    passwordHash: '',
                    userRoles: {
                        create: {
                            roleId: teacherRole.id,
                        },
                    },
                },
            });
            // Create teacher record
            const teacher = await teacher_service_1.TeacherService.createTeacher({ firstName, lastName, email, password, specialization, dateOfJoining, salary }, user.id);
            // Log audit
            await client_1.prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'CREATE',
                    tableName: 'Teacher',
                    recordId: teacher.id,
                    changes: { created: teacher },
                    createdBy: req.user.id,
                },
            });
            return (0, api_response_1.sendSuccess)(res, teacher, 'Teacher created successfully', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /teachers - List all teachers with pagination and filtering
     */
    static async listTeachers(req, res, next) {
        try {
            const { page = '1', limit = '10', search, specialization, isActive, sortBy, sortOrder } = req.query;
            const result = await teacher_service_1.TeacherService.listTeachers({
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                specialization: specialization,
                isActive: isActive ? isActive === 'true' : undefined,
                sortBy: sortBy || 'createdAt',
                sortOrder: sortOrder || 'desc',
            });
            return (0, api_response_1.sendSuccess)(res, result, 'Teachers retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    static async importTeachers(req, res, next) {
        try {
            const { csv } = req.body;
            if (!csv)
                return (0, api_response_1.sendError)(res, 'CSV content is required', 400);
            const lines = csv.split(/\r?\n/).filter(Boolean);
            if (lines.length < 2)
                return (0, api_response_1.sendError)(res, 'CSV must include a header row and at least one record', 400);
            const header = lines[0].split(',').map((h) => h.trim());
            const created = [];
            const errors = [];
            for (const [index, line] of lines.slice(1).entries()) {
                const values = line.split(',').map((v) => v.trim());
                const row = Object.fromEntries(header.map((h, i) => [h, values[i] || '']));
                if (!row.firstName || !row.lastName || !row.email) {
                    errors.push({ row: index + 2, message: 'firstName, lastName, and email are required' });
                    continue;
                }
                try {
                    const teacher = await teacher_service_1.TeacherService.createTeacher({
                        firstName: row.firstName,
                        lastName: row.lastName,
                        email: row.email,
                        password: row.password || 'TempPassword123!',
                        specialization: row.specialization,
                        salary: row.salary ? parseFloat(row.salary) : undefined,
                    }, req.user.id);
                    created.push(teacher);
                }
                catch (error) {
                    errors.push({ row: index + 2, message: error.message || 'Failed to create teacher' });
                }
            }
            return (0, api_response_1.sendSuccess)(res, { created, errors }, 'Teachers import completed', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    static async exportTeachers(req, res, next) {
        try {
            const { page = '1', limit = '1000', search, specialization, isActive, sortBy, sortOrder } = req.query;
            const result = await teacher_service_1.TeacherService.listTeachers({
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                specialization: specialization,
                isActive: isActive ? isActive === 'true' : undefined,
                sortBy: sortBy || 'createdAt',
                sortOrder: sortOrder || 'desc',
            });
            const header = ['firstName', 'lastName', 'email', 'employeeId', 'specialization'];
            const rows = result.teachers.map((teacher) => [teacher.user?.firstName || '', teacher.user?.lastName || '', teacher.user?.email || '', teacher.employeeId, teacher.specialization || '']);
            const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=teachers.csv');
            return res.send(csv);
        }
        catch (error) {
            return next(error);
        }
    }
    static async uploadTeacherPhoto(req, res, next) {
        try {
            const { id } = req.params;
            const { fileName, mimeType, fileData } = req.body;
            if (!fileName || !mimeType || !fileData)
                return (0, api_response_1.sendError)(res, 'fileName, mimeType, and fileData are required', 400);
            const bucket = 'avatars';
            const cleanFileName = fileName.replace(/\s+/g, '-').toLowerCase();
            const path = `teachers/${id}/${Date.now()}-${cleanFileName}`;
            const fileBuffer = Buffer.from(fileData, 'base64');
            const { data, error } = await supabase_1.supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: false,
            });
            if (error || !data)
                return (0, api_response_1.sendError)(res, error?.message || 'Failed to upload photo', 400);
            const { data: publicUrlData } = supabase_1.supabaseAdmin.storage.from(bucket).getPublicUrl(path);
            const teacher = await client_1.prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
            await client_1.prisma.user.update({ where: { id: teacher?.userId }, data: { avatarUrl: publicUrlData.publicUrl } });
            return (0, api_response_1.sendSuccess)(res, { avatarUrl: publicUrlData.publicUrl }, 'Teacher photo uploaded successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /teachers/:id - Get single teacher with full details
     */
    static async getTeacher(req, res, next) {
        try {
            const { id } = req.params;
            const teacher = await teacher_service_1.TeacherService.getTeacherById(id);
            if (!teacher) {
                return (0, api_response_1.sendError)(res, 'Teacher not found', 404);
            }
            return (0, api_response_1.sendSuccess)(res, teacher, 'Teacher retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * PATCH /teachers/:id - Update teacher information
     * Only SuperAdmin, Admin, or the teacher themselves can update
     */
    static async updateTeacher(req, res, next) {
        try {
            const { id } = req.params;
            const data = req.body;
            const teacher = await teacher_service_1.TeacherService.updateTeacher(id, data, req.user.id);
            if (!teacher) {
                return (0, api_response_1.sendError)(res, 'Teacher not found', 404);
            }
            return (0, api_response_1.sendSuccess)(res, teacher, 'Teacher updated successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * DELETE /teachers/:id - Delete (soft) a teacher
     * Only SuperAdmin or Admin can delete
     */
    static async deleteTeacher(req, res, next) {
        try {
            const { id } = req.params;
            const { password } = req.body;
            if (!password) {
                return (0, api_response_1.sendError)(res, 'Administrator password is required to remove a teacher.', 400);
            }
            // Verify requesting admin's credentials
            const adminEmail = req.user?.email;
            if (!adminEmail) {
                return (0, api_response_1.sendError)(res, 'Unauthorized administrator.', 401);
            }
            const { error: authError } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
                email: adminEmail,
                password,
            });
            if (authError) {
                return (0, api_response_1.sendError)(res, 'Incorrect administrator password. Deletion cancelled.', 401);
            }
            const teacher = await teacher_service_1.TeacherService.deleteTeacher(id, req.user.id);
            if (!teacher) {
                return (0, api_response_1.sendError)(res, 'Teacher not found', 404);
            }
            return (0, api_response_1.sendSuccess)(res, null, 'Teacher removed successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /teachers/:id/assign - Assign teacher to a course/batch
     */
    static async assignTeacher(req, res, next) {
        try {
            const { id } = req.params;
            const { courseId, batchId, moduleId, assignmentType } = req.body;
            if (!courseId || !batchId) {
                return (0, api_response_1.sendError)(res, 'courseId and batchId are required', 400);
            }
            const assignment = await teacher_service_1.TeacherService.assignTeacherToCourse(id, { courseId, batchId, moduleId, assignmentType: assignmentType || 'teaching' }, req.user.id);
            return (0, api_response_1.sendSuccess)(res, assignment, 'Teacher assigned successfully', 201);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /teachers/:id/assignments - Get teacher's course assignments
     */
    static async getAssignments(req, res, next) {
        try {
            const { id } = req.params;
            const assignments = await teacher_service_1.TeacherService.getTeacherAssignments(id);
            return (0, api_response_1.sendSuccess)(res, assignments, 'Assignments retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /teachers/:id/performance - Get teacher's performance reports
     */
    static async getPerformance(req, res, next) {
        try {
            const { id } = req.params;
            const performance = await teacher_service_1.TeacherService.getTeacherPerformance(id);
            return (0, api_response_1.sendSuccess)(res, performance, 'Performance reports retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * GET /courses/:courseId/teachers - Get all teachers for a course
     */
    static async getTeachersByCourse(req, res, next) {
        try {
            const { courseId } = req.params;
            const teachers = await teacher_service_1.TeacherService.getTeachersByCourse(courseId);
            return (0, api_response_1.sendSuccess)(res, teachers, 'Teachers retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /teachers/:id/enroll-student-by-id - Enroll a student by their unique ID
     */
    static async enrollStudentByUniqueId(req, res, next) {
        try {
            const { id: teacherId } = req.params;
            const { uniqueId, courseId, batchId } = req.body;
            if (!uniqueId || !courseId || !batchId) {
                return (0, api_response_1.sendError)(res, 'uniqueId, courseId, and batchId are required', 400);
            }
            // Import StudentService here to avoid circular dependency
            const { StudentService } = await Promise.resolve().then(() => __importStar(require('../../students/services/student.service')));
            const enrollment = await StudentService.enrollByUniqueId(teacherId, uniqueId, courseId, batchId, req.user.id);
            return (0, api_response_1.sendSuccess)(res, enrollment, 'Student enrolled successfully by unique ID', 201);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.TeacherController = TeacherController;
