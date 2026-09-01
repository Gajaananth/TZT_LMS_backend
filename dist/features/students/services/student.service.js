"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentService = void 0;
const client_1 = require("../../../db/prisma/client");
const supabase_1 = require("../../../lib/supabase");
const crypto_1 = __importDefault(require("crypto"));
class StudentService {
    /**
     * Create a new student with associated user account
     */
    static async createStudent(data, userId) {
        // Generate official student ID (STU + 6-digit number)
        const studentId = `STU${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
        const student = await client_1.prisma.student.create({
            data: {
                userId,
                studentId,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
                gender: data.gender,
                addressLine1: data.addressLine1,
                addressLine2: data.addressLine2,
                city: data.city,
                state: data.state,
                postalCode: data.postalCode,
                country: data.country,
                batchId: data.batchId,
                departmentId: data.departmentId,
                dateOfAdmission: data.dateOfAdmission ? new Date(data.dateOfAdmission) : new Date(),
                isActive: true,
                createdBy: userId,
                // Guardian
                guardian: data.guardianFirstName
                    ? {
                        create: {
                            firstName: data.guardianFirstName,
                            lastName: data.guardianLastName || '',
                            relationship: data.guardianRelationship || 'Parent',
                            phone: data.guardianPhone || '',
                            email: data.guardianEmail,
                        },
                    }
                    : undefined,
                // Emergency Contact
                emergencyContact: data.emergencyContactFirstName
                    ? {
                        create: {
                            firstName: data.emergencyContactFirstName,
                            lastName: data.emergencyContactLastName || '',
                            relationship: data.emergencyContactRelationship || 'Emergency',
                            phone: data.emergencyContactPhone || '',
                            email: data.emergencyContactEmail,
                        },
                    }
                    : undefined,
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
                batch: true,
                department: true,
                guardian: true,
                emergencyContact: true,
            },
        });
        return student;
    }
    /**
     * Get all students with pagination, filtering, and searching
     */
    static async listStudents(query) {
        const { page = 1, limit = 10, search, batchId, departmentId, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const skip = (page - 1) * limit;
        const whereClause = {
            deletedAt: null,
        };
        // Search filter (name, email, or student ID)
        if (search) {
            whereClause.OR = [
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { lastName: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { studentId: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (batchId)
            whereClause.batchId = batchId;
        if (departmentId)
            whereClause.departmentId = departmentId;
        if (isActive !== undefined)
            whereClause.isActive = isActive;
        const [students, total] = await Promise.all([
            client_1.prisma.student.findMany({
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
                    batch: true,
                    department: true,
                    enrollments: { where: { deletedAt: null }, select: { courseId: true } },
                },
            }),
            client_1.prisma.student.count({ where: whereClause }),
        ]);
        return {
            students,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get a single student with full details
     */
    static async getStudentById(studentId) {
        const student = await client_1.prisma.student.findUnique({
            where: { id: studentId },
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
                batch: true,
                department: true,
                guardian: true,
                emergencyContact: true,
                academicHistory: { where: { deletedAt: null } },
                enrollments: { where: { deletedAt: null }, include: { course: true, batch: true } },
                certificates: { where: { deletedAt: null } },
            },
        });
        if (!student)
            return null;
        return student;
    }
    /**
     * Update student information
     */
    static async updateStudent(studentId, data, userId) {
        const student = await client_1.prisma.student.findUnique({ where: { id: studentId } });
        if (!student)
            return null;
        // Log audit trail
        const oldValues = {
            firstName: student.city,
            lastName: student.state,
            dateOfBirth: student.dateOfBirth,
            gender: student.gender,
            address: `${student.addressLine1}, ${student.city}`,
            batchId: student.batchId,
            departmentId: student.departmentId,
        };
        // If updating firstName or lastName, update the User model too
        if (data.firstName || data.lastName) {
            await client_1.prisma.user.update({
                where: { id: student.userId },
                data: {
                    ...(data.firstName && { firstName: data.firstName }),
                    ...(data.lastName && { lastName: data.lastName }),
                },
            });
        }
        const updated = await client_1.prisma.student.update({
            where: { id: studentId },
            data: {
                ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
                ...(data.gender && { gender: data.gender }),
                ...(data.addressLine1 && { addressLine1: data.addressLine1 }),
                ...(data.addressLine2 && { addressLine2: data.addressLine2 }),
                ...(data.city && { city: data.city }),
                ...(data.state && { state: data.state }),
                ...(data.postalCode && { postalCode: data.postalCode }),
                ...(data.country && { country: data.country }),
                ...(data.batchId && { batchId: data.batchId }),
                ...(data.departmentId && { departmentId: data.departmentId }),
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
                batch: true,
                department: true,
                guardian: true,
                emergencyContact: true,
            },
        });
        // Record audit log
        await client_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'UPDATE',
                tableName: 'Student',
                recordId: studentId,
                changes: { before: oldValues, after: data },
                createdBy: userId,
            },
        });
        return updated;
    }
    /**
     * Soft delete a student
     */
    static async deleteStudent(studentId, userId) {
        const existing = await client_1.prisma.student.findUnique({
            where: { id: studentId },
            include: { user: true },
        });
        if (!existing) {
            return null;
        }
        const student = await client_1.prisma.student.update({
            where: { id: studentId },
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
                    console.warn('Supabase auth user delete warning:', e.message);
                }
            }
        }
        // Record audit log
        await client_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'DELETE',
                tableName: 'Student',
                recordId: studentId,
                changes: { deleted: true },
                createdBy: userId,
            },
        });
        return student;
    }
    /**
     * Enroll student in a course
     */
    static async enrollInCourse(studentId, courseId, batchId, userId) {
        // Check if already enrolled
        const existing = await client_1.prisma.enrollment.findUnique({
            where: {
                studentId_courseId: { studentId, courseId },
            },
        });
        if (existing && !existing.deletedAt) {
            throw new Error('Student is already enrolled in this course');
        }
        const enrollment = await client_1.prisma.enrollment.create({
            data: {
                studentId,
                courseId,
                batchId,
                status: 'active',
                createdBy: userId,
            },
            include: { course: true, batch: true },
        });
        return enrollment;
    }
    /**
     * Get student's enrollments
     */
    static async getStudentEnrollments(studentId) {
        return client_1.prisma.enrollment.findMany({
            where: { studentId, deletedAt: null },
            include: { course: true, batch: true },
        });
    }
    /**
     * Get student's attendance records
     */
    static async getStudentAttendance(studentId, courseId) {
        const whereClause = { studentId, deletedAt: null };
        if (courseId)
            whereClause.courseId = courseId;
        const records = await client_1.prisma.attendanceRecord.findMany({
            where: whereClause,
            orderBy: { classDate: 'desc' },
            take: 30, // Last 30 records
            include: {
                course: { select: { id: true, code: true, title: true } },
                batch: { select: { id: true, name: true } },
                auditTrail: { orderBy: { changedAt: 'desc' } },
            },
        });
        // Normalize to expose latestStatus and history (append-only corrections)
        return records.map((r) => ({
            ...r,
            latestStatus: (r.auditTrail && r.auditTrail.length > 0) ? r.auditTrail[0].newValue : r.status,
            history: [
                { date: r.attendanceDate, status: r.status, type: 'original' },
                ...(r.auditTrail || []).map((a) => ({ date: a.changedAt, status: a.newValue, type: 'correction', reason: a.reason })),
            ],
        }));
    }
    /**
     * Update student's associated user profile
     */
    static async updateStudentProfile(studentId, firstName, lastName, phone) {
        const student = await client_1.prisma.student.findUnique({
            where: { id: studentId },
            select: { userId: true },
        });
        if (!student)
            return null;
        return client_1.prisma.user.update({
            where: { id: student.userId },
            data: {
                firstName,
                lastName,
                ...(phone && { phone }),
            },
        });
    }
    /**
     * Generate and assign a unique ID for a student (format: TZTSTU-XXXXXX)
     * Called when student profile is completed
     */
    static async generateAndAssignUniqueId(studentId, userId) {
        const student = await client_1.prisma.student.findUnique({ where: { id: studentId } });
        if (!student)
            throw new Error('Student not found');
        // If already has a unique ID, return existing
        if (student.uniqueId) {
            return {
                ...student,
                uniqueId: student.uniqueId,
            };
        }
        // Generate unique ID: TZTSTU-XXXXXX (6 random alphanumeric chars)
        let uniqueId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;
        while (!isUnique && attempts < maxAttempts) {
            const randomChars = crypto_1.default.randomBytes(4).toString('hex').toUpperCase().substring(0, 6);
            uniqueId = `TZTSTU-${randomChars}`;
            // Check if already exists
            const existing = await client_1.prisma.student.findUnique({
                where: { uniqueId },
            });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }
        if (!isUnique) {
            throw new Error('Failed to generate unique ID after multiple attempts');
        }
        // Update student with unique ID and issue date
        const updated = await client_1.prisma.student.update({
            where: { id: studentId },
            data: {
                uniqueId: uniqueId,
                idCardIssuedAt: new Date(),
                qrCodeVersion: 1,
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
                batch: true,
                department: true,
            },
        });
        return updated;
    }
    /**
     * Get student ID card information (for display/print/download)
     */
    static async getStudentIdCard(studentId) {
        const student = await client_1.prisma.student.findUnique({
            where: { id: studentId },
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
                batch: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
            },
        });
        if (!student)
            throw new Error('Student not found');
        return {
            id: student.id,
            uniqueId: student.uniqueId,
            studentId: student.studentId,
            name: `${student.user.firstName} ${student.user.lastName}`,
            email: student.user.email,
            phone: student.user.phone,
            photoUrl: student.photoUrl,
            batch: student.batch?.name,
            department: student.department?.name,
            dateOfAdmission: student.dateOfAdmission,
            idCardIssuedAt: student.idCardIssuedAt,
            qrCodeVersion: student.qrCodeVersion,
        };
    }
    /**
     * Enroll a student by their unique ID (used by teachers to add students)
     */
    static async enrollByUniqueId(teacherId, uniqueId, courseId, batchId, userId) {
        // Find student by unique ID
        const student = await client_1.prisma.student.findUnique({
            where: { uniqueId },
        });
        if (!student) {
            throw new Error(`No student found with ID: ${uniqueId}`);
        }
        // Get the course to verify teacher can teach it (simplified check)
        const course = await client_1.prisma.course.findUnique({
            where: { id: courseId },
        });
        if (!course) {
            throw new Error('Course not found');
        }
        // Enroll the student
        return this.enrollInCourse(student.id, courseId, batchId, userId);
    }
    /**
     * Withdraw student from a course (soft delete - update status instead)
     */
    static async withdrawFromCourse(enrollmentId, studentId, userId) {
        // Verify enrollment belongs to the student
        const enrollment = await client_1.prisma.enrollment.findUnique({
            where: { id: enrollmentId },
        });
        if (!enrollment || enrollment.studentId !== studentId) {
            throw new Error('Enrollment not found or does not belong to this student');
        }
        // Update status instead of hard delete
        const updated = await client_1.prisma.enrollment.update({
            where: { id: enrollmentId },
            data: {
                status: 'withdrawn',
                deletedAt: new Date(),
                updatedBy: userId,
            },
            include: { course: true, batch: true, student: { include: { user: true } } },
        });
        // TODO: Send notification to teachers and admins about the withdrawal
        // await NotificationService.notifyWithdrawal(updated);
        return updated;
    }
}
exports.StudentService = StudentService;
