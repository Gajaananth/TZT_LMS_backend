import { z } from 'zod';

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  batchId: z.string().uuid('Invalid batch ID'),
  departmentId: z.string().uuid('Invalid department ID'),
  dateOfAdmission: z.string().datetime().optional(),
  guardianFirstName: z.string().optional(),
  guardianLastName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional(),
  emergencyContactFirstName: z.string().optional(),
  emergencyContactLastName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactEmail: z.string().email().optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  batchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  guardianFirstName: z.string().optional(),
  guardianLastName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional(),
  emergencyContactFirstName: z.string().optional(),
  emergencyContactLastName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactEmail: z.string().email().optional(),
});

export const listStudentsSchema = z.object({
  page: z.string().transform(Number).default('1').optional(),
  limit: z.string().transform(Number).default('10').optional(),
  search: z.string().optional(), // Search by name, email, or student ID
  batchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'studentId']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const importStudentsSchema = z.object({
  csv: z.string().min(1, 'CSV content is required'),
});

export const uploadStudentPhotoSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileData: z.string().min(1),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsSchema>;
