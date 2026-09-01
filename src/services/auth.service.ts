import { supabaseAdmin } from '../lib/supabase';
import prisma from '../db/prisma/client';

export class AuthService {
  async verifyToken(token: string) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) throw error;
    return data.user;
  }

  async getUserById(userId: string) {
    return await prisma.user.findUnique({
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

  async getUserBySupabaseId(supabaseId: string) {
    return await prisma.user.findUnique({
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

  async syncSupabaseUser(supabaseUser: any, defaultRole: string = 'Student', specialization?: string) {
    // This is called after a successful Supabase signup webhook or first login
    let user = await this.getUserBySupabaseId(supabaseUser.id);
    
    if (!user) {
      // Create user in Prisma
      try {
        user = await prisma.user.create({
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
      } catch (err: any) {
        // Handle potential unique constraint conflicts (email already exists)
        if (err?.code === 'P2002' || err?.message?.includes('Unique')) {
          user = await prisma.user.findUnique({
            where: { email: supabaseUser.email },
            include: {
              userRoles: { include: { role: true } },
              student: true,
              teacher: true,
            }
          });
        } else {
          throw err;
        }
      }

      if (!user) {
        user = await prisma.user.findUnique({
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
      let role = await prisma.role.findUnique({ where: { name: defaultRole } });
      if (!role) {
        role = await prisma.role.create({ data: { name: defaultRole, description: `${defaultRole} role` } });
      }

      if (role) {
          const existingUserRole = await prisma.userRole.findUnique({ where: { userId_roleId: { userId: user.id, roleId: role.id } } }).catch(() => null);
          if (!existingUserRole) {
            await prisma.userRole.create({
              data: {
                userId: user.id,
                roleId: role.id
              }
            });
          }
      }

      // Auto-create Teacher profile if registering as a Teacher
      if (defaultRole === 'Teacher') {
        const existingTeacher = await prisma.teacher.findUnique({ where: { userId: user.id } }).catch(() => null);
        if (!existingTeacher) {
          const employeeId = `TCH${String(Math.floor(100000 + Math.random() * 900000))}`;
          const uniqueId = `TCH-${String(Math.floor(100000 + Math.random() * 900000))}`;
          await prisma.teacher.create({
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
        const existingStudent = await prisma.student.findUnique({ where: { userId: user.id } }).catch(() => null);
        if (!existingStudent) {
          // Get default department & batch
          let dept = await prisma.department.findFirst();
          if (!dept) {
            dept = await prisma.department.create({
              data: { name: 'General Studies', code: 'GEN', description: 'General Department' }
            });
          }

          let batch = await prisma.batch.findFirst();
          if (!batch) {
            batch = await prisma.batch.create({
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
          await prisma.student.create({
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

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // 1. Soft-delete user in Postgres
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // 2. Remove Supabase Auth user to permanently revoke credentials
    if (user.supabaseUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);
      } catch (err: any) {
        console.warn('Failed to delete Supabase Auth user during account deletion:', err.message);
      }
    }

    return true;
  }
}

export const authService = new AuthService();
export default authService;
