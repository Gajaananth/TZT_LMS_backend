"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const supabase_1 = require("../lib/supabase");
const client_1 = __importDefault(require("../db/prisma/client"));
class AuthService {
    async verifyToken(token) {
        const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error)
            throw error;
        return data.user;
    }
    async getUserById(userId) {
        return await client_1.default.user.findUnique({
            where: { id: userId },
            include: {
                userRoles: {
                    include: { role: true }
                },
                student: true,
                teacher: true,
            }
        });
    }
    async getUserBySupabaseId(supabaseId) {
        return await client_1.default.user.findUnique({
            where: { supabaseUserId: supabaseId },
            include: {
                userRoles: {
                    include: { role: true }
                },
                student: true,
                teacher: true,
            }
        });
    }
    async syncSupabaseUser(supabaseUser, defaultRole = 'Student', specialization) {
        // This is called after a successful Supabase signup webhook or first login
        let user = await this.getUserBySupabaseId(supabaseUser.id);
        if (!user) {
            // Create user in Prisma
            try {
                user = await client_1.default.user.create({
                    data: {
                        supabaseUserId: supabaseUser.id,
                        email: supabaseUser.email,
                        firstName: supabaseUser.user_metadata?.first_name || '',
                        lastName: supabaseUser.user_metadata?.last_name || '',
                        passwordHash: '', // Not used since Supabase handles passwords
                    },
                    include: {
                        userRoles: { include: { role: true } },
                        student: true,
                        teacher: true,
                    }
                });
            }
            catch (err) {
                // Handle potential unique constraint conflicts (email already exists)
                if (err?.code === 'P2002' || err?.message?.includes('Unique')) {
                    user = await client_1.default.user.findUnique({
                        where: { email: supabaseUser.email },
                        include: {
                            userRoles: { include: { role: true } },
                            student: true,
                            teacher: true,
                        }
                    });
                }
                else {
                    throw err;
                }
            }
            if (!user) {
                user = await client_1.default.user.findUnique({
                    where: { supabaseUserId: supabaseUser.id },
                    include: {
                        userRoles: { include: { role: true } },
                        student: true,
                        teacher: true,
                    }
                });
            }
            if (!user) {
                throw new Error(`Unable to locate synced user after Supabase signup for ${supabaseUser.email ?? supabaseUser.id}`);
            }
            // Assign default role
            let role = await client_1.default.role.findUnique({ where: { name: defaultRole } });
            if (!role) {
                role = await client_1.default.role.create({ data: { name: defaultRole, description: `${defaultRole} role` } });
            }
            if (role) {
                const existingUserRole = await client_1.default.userRole.findUnique({ where: { userId_roleId: { userId: user.id, roleId: role.id } } }).catch(() => null);
                if (!existingUserRole) {
                    await client_1.default.userRole.create({
                        data: {
                            userId: user.id,
                            roleId: role.id
                        }
                    });
                }
            }
            // Auto-create Teacher profile if registering as a Teacher
            if (defaultRole === 'Teacher') {
                const existingTeacher = await client_1.default.teacher.findUnique({ where: { userId: user.id } }).catch(() => null);
                if (!existingTeacher) {
                    const employeeId = `TCH${String(Math.floor(100000 + Math.random() * 900000))}`;
                    const uniqueId = `TCH-${String(Math.floor(100000 + Math.random() * 900000))}`;
                    await client_1.default.teacher.create({
                        data: {
                            userId: user.id,
                            employeeId,
                            uniqueId,
                            specialization: specialization || null,
                            isActive: true,
                            dateOfJoining: new Date(),
                        }
                    }).catch((err) => console.warn('Auto-create Teacher record warning:', err));
                }
            }
            // Auto-create Student profile if registering as a Student
            if (defaultRole === 'Student') {
                const existingStudent = await client_1.default.student.findUnique({ where: { userId: user.id } }).catch(() => null);
                if (!existingStudent) {
                    // Get default department & batch
                    let dept = await client_1.default.department.findFirst();
                    if (!dept) {
                        dept = await client_1.default.department.create({
                            data: { name: 'General Studies', code: 'GEN', description: 'General Department' }
                        });
                    }
                    let batch = await client_1.default.batch.findFirst();
                    if (!batch) {
                        batch = await client_1.default.batch.create({
                            data: {
                                name: '2026 Regular Batch',
                                code: 'BATCH-2026',
                                departmentId: dept.id,
                                startDate: new Date('2026-01-01'),
                                endDate: new Date('2026-12-31'),
                            }
                        });
                    }
                    const studentId = `STU${String(Math.floor(100000 + Math.random() * 900000))}`;
                    const uniqueId = `STU-${String(Math.floor(100000 + Math.random() * 900000))}`;
                    await client_1.default.student.create({
                        data: {
                            userId: user.id,
                            studentId,
                            uniqueId,
                            batchId: batch.id,
                            departmentId: dept.id,
                            isActive: true,
                            dateOfAdmission: new Date(),
                        }
                    }).catch((err) => console.warn('Auto-create Student record warning:', err));
                }
            }
        }
        return await this.getUserBySupabaseId(supabaseUser.id) || user;
    }
    async deleteAccount(userId) {
        const user = await client_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        // 1. Soft-delete user in Postgres
        await client_1.default.user.update({
            where: { id: userId },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });
        // 2. Remove Supabase Auth user to permanently revoke credentials
        if (user.supabaseUserId) {
            try {
                await supabase_1.supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);
            }
            catch (err) {
                console.warn('Failed to delete Supabase Auth user during account deletion:', err.message);
            }
        }
        return true;
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
exports.default = exports.authService;
