import { NextFunction, Request, Response } from 'express';
import { prisma } from '@/db/prisma/client';
import { StudentService } from '../services/student.service';
import { sendError, sendSuccess } from '@/utils/api-response';
import { supabaseAdmin } from '@/lib/supabase';

export class StudentController {
  /**
   * POST /students - Register a new student
   * Only SuperAdmin, Admin can create students
   */
  static async createStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, email, password, batchId, departmentId, ...otherData } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !password || !batchId || !departmentId) {
        return sendError(res, 'Missing required fields: firstName, lastName, email, password, batchId, departmentId', 400);
      }

      // Create Supabase user via admin API
      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          firstName,
          lastName,
        },
      });

      if (supabaseError || !supabaseUser) {
        return sendError(res, supabaseError?.message || 'Failed to create user', 400);
      }

      // Get student role ID
      const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });
      if (!studentRole) {
        return sendError(res, 'Student role not found', 500);
      }

      // Create local user record
      const user = await prisma.user.create({
        data: {
          supabaseUserId: supabaseUser.user.id,
          email,
          firstName,
          lastName,
          passwordHash: '', // Not used with Supabase
          userRoles: {
            create: {
              roleId: studentRole.id,
            },
          },
        },
      });

      // Create student record with guardian and emergency contact
      const student = await StudentService.createStudent(
        { firstName, lastName, email, password, batchId, departmentId, ...otherData },
        user.id,
      );

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATE',
          tableName: 'Student',
          recordId: student.id,
          changes: { created: student },
          createdBy: req.user!.id,
        },
      });

      return sendSuccess(res, student, 'Student registered successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /students - List all students with pagination, search, and filtering
   */
  static async listStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10', search, batchId, departmentId, isActive, sortBy, sortOrder } = req.query;

      const result = await StudentService.listStudents({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string | undefined,
        batchId: batchId as string | undefined,
        departmentId: departmentId as string | undefined,
        isActive: isActive ? (isActive as string) === 'true' : undefined,
        sortBy: (sortBy as any) || 'createdAt',
        sortOrder: (sortOrder as any) || 'desc',
      });

      return sendSuccess(res, result, 'Students retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  static async importStudents(req: Request, res: Response, next: NextFunction) {
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
          const student = await StudentService.createStudent({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            password: row.password || 'TempPassword123!',
            batchId: row.batchId,
            departmentId: row.departmentId,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender as any,
          } as any, req.user!.id);
          created.push(student);
        } catch (error: any) {
          errors.push({ row: index + 2, message: error.message || 'Failed to create student' });
        }
      }

      return sendSuccess(res, { created, errors }, 'Students import completed', 201);
    } catch (error) {
      return next(error);
    }
  }

  static async exportStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '1000', search, batchId, departmentId, isActive, sortBy, sortOrder } = req.query;
      const result = await StudentService.listStudents({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string | undefined,
        batchId: batchId as string | undefined,
        departmentId: departmentId as string | undefined,
        isActive: isActive ? (isActive as string) === 'true' : undefined,
        sortBy: (sortBy as any) || 'createdAt',
        sortOrder: (sortOrder as any) || 'desc',
      });

      const header = ['firstName', 'lastName', 'email', 'studentId', 'batchId', 'departmentId'];
      const rows = result.students.map((student: any) => [student.user?.firstName || '', student.user?.lastName || '', student.user?.email || '', student.studentId, student.batchId || '', student.departmentId || '']);
      const csv = [header.join(','), ...rows.map((row: string[]) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
      return res.send(csv);
    } catch (error) {
      return next(error);
    }
  }

  static async uploadStudentPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { fileName, mimeType, fileData } = req.body;

      if (!fileName || !mimeType || !fileData) return sendError(res, 'fileName, mimeType, and fileData are required', 400);

      const bucket = 'avatars';
      const cleanFileName = fileName.replace(/\s+/g, '-').toLowerCase();
      const path = `students/${id}/${Date.now()}-${cleanFileName}`;
      const fileBuffer = Buffer.from(fileData, 'base64');

      const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

      if (error || !data) return sendError(res, error?.message || 'Failed to upload photo', 400);

      const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
      await prisma.user.update({ where: { id: (await prisma.student.findUnique({ where: { id }, select: { userId: true } }))?.userId }, data: { avatarUrl: publicUrlData.publicUrl } });

      return sendSuccess(res, { avatarUrl: publicUrlData.publicUrl }, 'Student photo uploaded successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /students/:id - Get single student details
   */
  static async getStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const student = await StudentService.getStudentById(id);
      if (!student) {
        return sendError(res, 'Student not found', 404);
      }

      return sendSuccess(res, student, 'Student retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /students/:id - Update student information
   * Only SuperAdmin, Admin, or the student themselves can update
   */
  static async updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      const student = await StudentService.updateStudent(id, data, req.user!.id);
      if (!student) {
        return sendError(res, 'Student not found', 404);
      }

      return sendSuccess(res, student, 'Student updated successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /students/:id - Delete (soft) a student
   * Only SuperAdmin or Admin can delete
   */
  static async deleteStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return sendError(res, 'Administrator password is required to remove a student.', 400);
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

      const student = await StudentService.deleteStudent(id, req.user!.id);
      if (!student) {
        return sendError(res, 'Student not found', 404);
      }

      return sendSuccess(res, null, 'Student removed successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /students/:id/enroll - Enroll student in a course
   */
  static async enrollStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { courseId, batchId } = req.body;

      if (!courseId || !batchId) {
        return sendError(res, 'courseId and batchId are required', 400);
      }

      const enrollment = await StudentService.enrollInCourse(id, courseId, batchId, req.user!.id);
      return sendSuccess(res, enrollment, 'Student enrolled successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /students/:id/enrollments - Get student's course enrollments
   */
  static async getEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const enrollments = await StudentService.getStudentEnrollments(id);
      return sendSuccess(res, enrollments, 'Enrollments retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /students/:id/attendance - Get student's attendance records
   */
  static async getAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { courseId } = req.query;

      const attendance = await StudentService.getStudentAttendance(id, courseId as string | undefined);
      return sendSuccess(res, attendance, 'Attendance records retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /students/:id/enrollments/:enrollmentId/withdraw - Withdraw from a course
   * Requires password confirmation
   */
  static async withdrawFromCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, enrollmentId } = req.params;

      if (!enrollmentId) {
        return sendError(res, 'enrollmentId is required', 400);
      }

      const enrollment = await StudentService.withdrawFromCourse(enrollmentId, id, req.user!.id);
      return sendSuccess(res, enrollment, 'Successfully withdrawn from course', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /teachers/:teacherId/enroll-by-id - Enroll a student by their unique ID
   */
  static async enrollByUniqueId(req: Request, res: Response, next: NextFunction) {
    try {
      const { teacherId } = req.params;
      const { uniqueId, courseId, batchId } = req.body;

      if (!uniqueId || !courseId || !batchId) {
        return sendError(res, 'uniqueId, courseId, and batchId are required', 400);
      }

      const enrollment = await StudentService.enrollByUniqueId(teacherId, uniqueId, courseId, batchId, req.user!.id);
      return sendSuccess(res, enrollment, 'Student enrolled successfully by unique ID', 201);
    } catch (error) {
      return next(error);
    }
  }
}
