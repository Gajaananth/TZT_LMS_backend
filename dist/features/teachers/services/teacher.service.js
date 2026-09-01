"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherService = void 0;
const client_1 = require("../../../db/prisma/client");
const supabase_1 = require("../../../lib/supabase");
class TeacherService {
    /**
     * Create a new teacher with associated user account
     */
    static async createTeacher(data, userId) {
        // Generate official employee ID (TCH + 6-digit number)
        const employeeId = `TCH${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
        const teacher = await client_1.prisma.teacher.create({
            data: {
                userId,
                employeeId,
                specialization: data.specialization,
                dateOfJoining: data.dateOfJoining ? new Date(data.dateOfJoining) : new Date(),
                salary: data.salary ? Number((Math.round(data.salary * 100) / 100).toFixed(2)) : null,
                isActive: true,
                createdBy: userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        avatarUrl: true,
                    },
                },
                teacherAssignments: true,
            },
        });
        return teacher;
    }
    /**
     * Get all teachers with pagination and filtering
     */
    static async listTeachers(query) {
        const { page = 1, limit = 10, search, specialization, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const skip = (page - 1) * limit;
        const whereClause = {
            deletedAt: null,
        };
        if (search) {
            whereClause.OR = [
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { lastName: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { employeeId: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (specialization)
            whereClause.specialization = { contains: specialization, mode: 'insensitive' };
        if (isActive !== undefined)
            whereClause.isActive = isActive;
        const [teachers, total] = await Promise.all([
            client_1.prisma.teacher.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                            avatarUrl: true,
                        },
                    },
                    teacherAssignments: { where: { deletedAt: null }, include: { course: true, batch: true } },
                },
            }),
            client_1.prisma.teacher.count({ where: whereClause }),
        ]);
        return {
            teachers,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get a single teacher with full details
     */
    static async getTeacherById(teacherId) {
        const teacher = await client_1.prisma.teacher.findUnique({
            where: { id: teacherId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        avatarUrl: true,
                        userRoles: {
                            include: {
                                role: {
                                    include: {
                                        rolePermissions: {
                                            include: { permission: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                teacherAssignments: {
                    where: { deletedAt: null },
                    include: { course: true, batch: true, module: true },
                },
                performanceReports: { where: { deletedAt: null } },
            },
        });
        if (!teacher)
            return null;
        return teacher;
    }
    /**
     * Update teacher information
     */
    static async updateTeacher(teacherId, data, userId) {
        const teacher = await client_1.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher)
            return null;
        const oldValues = {
            specialization: teacher.specialization,
            salary: teacher.salary?.toString(),
            isActive: teacher.isActive,
        };
        // If updating firstName or lastName, update the User model too
        if (data.firstName || data.lastName) {
            await client_1.prisma.user.update({
                where: { id: teacher.userId },
                data: {
                    ...(data.firstName && { firstName: data.firstName }),
                    ...(data.lastName && { lastName: data.lastName }),
                },
            });
        }
        const updated = await client_1.prisma.teacher.update({
            where: { id: teacherId },
            data: {
                ...(data.specialization && { specialization: data.specialization }),
                ...(data.salary !== undefined && { salary: data.salary ? Number((Math.round(data.salary * 100) / 100).toFixed(2)) : null }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                updatedBy: userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        avatarUrl: true,
                    },
                },
                teacherAssignments: { where: { deletedAt: null } },
            },
        });
        // Record audit log
        await client_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'UPDATE',
                tableName: 'Teacher',
                recordId: teacherId,
                changes: { before: oldValues, after: data },
                createdBy: userId,
            },
        });
        return updated;
    }
    static async deleteTeacher(teacherId, userId) {
        const existing = await client_1.prisma.teacher.findUnique({
            where: { id: teacherId },
            include: { user: true },
        });
        if (!existing) {
            return null;
        }
        const teacher = await client_1.prisma.teacher.update({
            where: { id: teacherId },
            data: { deletedAt: new Date(), isActive: false, updatedBy: userId },
        });
        // Soft delete associated User
        if (existing.userId) {
            await client_1.prisma.user.update({
                where: { id: existing.userId },
                data: { deletedAt: new Date(), isActive: false, updatedBy: userId },
            });
            // Revoke in Supabase Auth
            if (existing.user?.supabaseUserId) {
                try {
                    await supabase_1.supabaseAdmin.auth.admin.deleteUser(existing.user.supabaseUserId);
                }
                catch (e) {
                    console.warn('Supabase auth user delete warning for teacher:', e.message);
                }
            }
        }
        // Record audit log
        await client_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'DELETE',
                tableName: 'Teacher',
                recordId: teacherId,
                changes: { deleted: true },
                createdBy: userId,
            },
        });
        return teacher;
    }
    /**
     * Assign teacher to a course/batch/module
     */
    static async assignTeacherToCourse(teacherId, data, userId) {
        // Check if teacher already assigned
        const existing = await client_1.prisma.teacherAssignment.findFirst({
            where: {
                teacherId,
                courseId: data.courseId,
                batchId: data.batchId,
                moduleId: data.moduleId || null,
                deletedAt: null,
            },
        });
        if (existing) {
            throw new Error('Teacher is already assigned to this course/batch');
        }
        const assignment = await client_1.prisma.teacherAssignment.create({
            data: {
                teacherId,
                ...data,
                createdBy: userId,
            },
            include: {
                course: true,
                batch: true,
                module: true,
            },
        });
        return assignment;
    }
    /**
     * Get teacher's course assignments
     */
    static async getTeacherAssignments(teacherId) {
        return client_1.prisma.teacherAssignment.findMany({
            where: { teacherId, deletedAt: null },
            include: { course: true, batch: true, module: true },
        });
    }
    /**
     * Get teacher's performance report
     */
    static async getTeacherPerformance(teacherId) {
        return client_1.prisma.performanceReport.findMany({
            where: { teacherId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Get teachers by department/course
     */
    static async getTeachersByCourse(courseId) {
        return client_1.prisma.teacherAssignment.findMany({
            where: { courseId, deletedAt: null },
            include: {
                teacher: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                },
            },
        });
    }
}
exports.TeacherService = TeacherService;
