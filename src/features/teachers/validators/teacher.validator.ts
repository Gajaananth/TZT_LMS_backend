import { z } from 'zod';

export const createTeacherSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  specialization: z.string().optional(),
  dateOfJoining: z.string().datetime().optional(),
  salary: z.number().nonnegative().optional(),
  // Photo validation is done in the controller, not here
  photoFileName: z.string().optional(),
  photoMimeType: z.string().optional(),
  photoFileData: z.string().optional(),
});

export const updateTeacherSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  photoFileName: z.string().optional(),
  photoMimeType: z.string().optional(),
  photoFileData: z.string().optional(),
  specialization: z.string().optional(),
  salary: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const assignTeacherSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  batchId: z.string().uuid('Invalid batch ID'),
  moduleId: z.string().uuid().optional(),
  assignmentType: z.enum(['teaching', 'grading', 'attendance']).default('teaching'),
});

export const listTeachersSchema = z.object({
  page: z.string().transform(Number).default('1').optional(),
  limit: z.string().transform(Number).default('10').optional(),
  search: z.string().optional(),
  specialization: z.string().optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'employeeId']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const importTeachersSchema = z.object({
  csv: z.string().min(1, 'CSV content is required'),
});

export const uploadTeacherPhotoSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileData: z.string().min(1),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
export type ListTeachersQuery = z.infer<typeof listTeachersSchema>;
