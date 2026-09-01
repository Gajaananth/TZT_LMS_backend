import { NextFunction, Request, Response } from 'express';
import { prisma } from '@/db/prisma/client';
import { TeacherService } from '../services/teacher.service';
import { sendError, sendSuccess } from '@/utils/api-response';
import { supabaseAdmin } from '@/lib/supabase';

export class TeacherController {
  /**
   * POST /teachers - Create a new teacher
   * Only SuperAdmin, Admin can create teachers
   */
  static async createTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, email, password, specialization, dateOfJoining, salary } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return sendError(res, 'Missing required fields: firstName, lastName, email, password', 400);
      }

      // Create Supabase user
      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { firstName, lastName },
      });

      if (supabaseError || !supabaseUser) {
        return sendError(res, supabaseError?.message || 'Failed to create user', 400);
      }

      // Get teacher role ID
      const teacherRole = await prisma.role.findUnique({ where: { name: 'Teacher' } });
      if (!teacherRole) {
        return sendError(res, 'Teacher role not found', 500);
      }

      // Create local user record
      const user = await prisma.user.create({
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
      const teacher = await TeacherService.createTeacher(
        { firstName, lastName, email, password, specialization, dateOfJoining, salary },
        user.id,
      );

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'Teacher',
          recordId: teacher.id,
          changes: { created: teacher },
          createdBy: req.user!.id,
        },
      });

      return sendSuccess(res, teacher, 'Teacher created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /teachers - List all teachers with pagination and filtering
   */
  static async listTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10', search, specialization, isActive, sortBy, sortOrder } = req.query;

      const result = await TeacherService.listTeachers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string | undefined,
        specialization: specialization as string | undefined,
        isActive: isActive ? (isActive as string) === 'true' : undefined,
        sortBy: (sortBy as any) || 'createdAt',
        sortOrder: (sortOrder as any) || 'desc',
      });

      return sendSuccess(res, result, 'Teachers retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  static async importTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      const { csv } = req.body;
      if (!csv) return sendError(res, 'CSV content is required', 400);

      const lines = csv.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return sendError(res, 'CSV must include a header row and at least one record', 400);

      const header = lines[0].split(',').map((h: string) => h.trim());
      const created: any[] = [];
      const errors: any[] = [];

      for (const [index, line] of lines.slice(1).entries()) {
        const values = line.split(',').map((v: string) => v.trim());
        const row = Object.fromEntries(header.map((h: string, i: number) => [h, values[i] || '']));

        if (!row.firstName || !row.lastName || !row.email) {
          errors.push({ row: index + 2, message: 'firstName, lastName, and email are required' });
          continue;
        }

        try {
          const teacher = await TeacherService.createTeacher({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            password: row.password || 'TempPassword123!',
            specialization: row.specialization,
            salary: row.salary ? parseFloat(row.salary) : undefined,
          } as any, req.user!.id);
          created.push(teacher);
        } catch (error: any) {
          errors.push({ row: index + 2, message: error.message || 'Failed to create teacher' });
        }
      }

      return sendSuccess(res, { created, errors }, 'Teachers import completed', 201);
    } catch (error) {
      return next(error);
    }
  }

  static async exportTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '1000', search, specialization, isActive, sortBy, sortOrder } = req.query;
      const result = await TeacherService.listTeachers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string | undefined,
        specialization: specialization as string | undefined,
        isActive: isActive ? (isActive as string) === 'true' : undefined,
        sortBy: (sortBy as any) || 'createdAt',
        sortOrder: (sortOrder as any) || 'desc',
      });

      const header = ['firstName', 'lastName', 'email', 'employeeId', 'specialization'];
      const rows = result.teachers.map((teacher: any) => [teacher.user?.firstName || '', teacher.user?.lastName || '', teacher.user?.email || '', teacher.employeeId, teacher.specialization || '']);
      const csv = [header.join(','), ...rows.map((row: string[]) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=teachers.csv');
      return res.send(csv);
    } catch (error) {
      return next(error);
    }
  }

  static async uploadTeacherPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { fileName, mimeType, fileData } = req.body;

      if (!fileName || !mimeType || !fileData) return sendError(res, 'fileName, mimeType, and fileData are required', 400);

      const bucket = 'avatars';
      const cleanFileName = fileName.replace(/\s+/g, '-').toLowerCase();
      const path = `teachers/${id}/${Date.now()}-${cleanFileName}`;
      const fileBuffer = Buffer.from(fileData, 'base64');

      const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

      if (error || !data) return sendError(res, error?.message || 'Failed to upload photo', 400);

      const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
      const teacher = await prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
      await prisma.user.update({ where: { id: teacher?.userId }, data: { avatarUrl: publicUrlData.publicUrl } });

      return sendSuccess(res, { avatarUrl: publicUrlData.publicUrl }, 'Teacher photo uploaded successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /teachers/:id - Get single teacher with full details
   */
  static async getTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const teacher = await TeacherService.getTeacherById(id);
      if (!teacher) {
        return sendError(res, 'Teacher not found', 404);
      }

      return sendSuccess(res, teacher, 'Teacher retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /teachers/:id - Update teacher information
   * Only SuperAdmin, Admin, or the teacher themselves can update
   */
  static async updateTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      const teacher = await TeacherService.updateTeacher(id, data, req.user!.id);
      if (!teacher) {
        return sendError(res, 'Teacher not found', 404);
      }

      return sendSuccess(res, teacher, 'Teacher updated successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /teachers/:id - Delete (soft) a teacher
   * Only SuperAdmin or Admin can delete
   */
  static async deleteTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return sendError(res, 'Administrator password is required to remove a teacher.', 400);
      }

      // Verify requesting admin's credentials
      const adminEmail = req.user?.email;
      if (!adminEmail) {
        return sendError(res, 'Unauthorized administrator.', 401);
      }

      const { error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: adminEmail,
        password,
      });

      if (authError) {
        return sendError(res, 'Incorrect administrator password. Deletion cancelled.', 401);
      }

      const teacher = await TeacherService.deleteTeacher(id, req.user!.id);
      if (!teacher) {
        return sendError(res, 'Teacher not found', 404);
      }

      return sendSuccess(res, null, 'Teacher removed successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /teachers/:id/assign - Assign teacher to a course/batch
   */
  static async assignTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { courseId, batchId, moduleId, assignmentType } = req.body;

      if (!courseId || !batchId) {
        return sendError(res, 'courseId and batchId are required', 400);
      }

      const assignment = await TeacherService.assignTeacherToCourse(
        id,
        { courseId, batchId, moduleId, assignmentType: assignmentType || 'teaching' },
        req.user!.id,
      );

      return sendSuccess(res, assignment, 'Teacher assigned successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /teachers/:id/assignments - Get teacher's course assignments
   */
  static async getAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const assignments = await TeacherService.getTeacherAssignments(id);
      return sendSuccess(res, assignments, 'Assignments retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /teachers/:id/performance - Get teacher's performance reports
   */
  static async getPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const performance = await TeacherService.getTeacherPerformance(id);
      return sendSuccess(res, performance, 'Performance reports retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /courses/:courseId/teachers - Get all teachers for a course
   */
  static async getTeachersByCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;

      const teachers = await TeacherService.getTeachersByCourse(courseId);
      return sendSuccess(res, teachers, 'Teachers retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /teachers/:id/enroll-student-by-id - Enroll a student by their unique ID
   */
  static async enrollStudentByUniqueId(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: teacherId } = req.params;
      const { uniqueId, courseId, batchId } = req.body;

      if (!uniqueId || !courseId || !batchId) {
        return sendError(res, 'uniqueId, courseId, and batchId are required', 400);
      }

      // Import StudentService here to avoid circular dependency
      const { StudentService } = await import('../../students/services/student.service');
      const enrollment = await StudentService.enrollByUniqueId(teacherId, uniqueId, courseId, batchId, req.user!.id);
      return sendSuccess(res, enrollment, 'Student enrolled successfully by unique ID', 201);
    } catch (error) {
      return next(error);
    }
  }
}

