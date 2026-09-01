import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';

export const recordAttendanceSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  courseId: z.string().uuid('Invalid course ID'),
  batchId: z.string().uuid('Invalid batch ID'),
  moduleId: z.string().uuid('Invalid module ID').optional(),
  classDate: z.string().datetime('Invalid class date').or(z.coerce.date()), // Allows backdating
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  remarks: z.string().optional(),
});

export const bulkRecordAttendanceSchema = z.array(recordAttendanceSchema).min(1, 'At least one record required');

export const getAttendanceViewSchema = z.object({
  page: z.string().transform(Number).default('1').optional(),
  limit: z.string().transform(Number).default('50').optional(),
  batchId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  moduleId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  viewBy: z.enum(['batch', 'course', 'student', 'date']).default('date'),
});

export const correctAttendanceSchema = z.object({
  originalAttendanceId: z.string().uuid('Invalid attendance ID'),
  newStatus: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  reason: z.string().min(5, 'Correction reason must be at least 5 characters'),
});

export const attendanceReportSchema = z.object({
  batchId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  reportType: z.enum(['summary', 'detailed', 'exception']).default('summary'),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type BulkRecordAttendanceInput = z.infer<typeof bulkRecordAttendanceSchema>;
export type GetAttendanceViewQuery = z.infer<typeof getAttendanceViewSchema>;
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;
export type AttendanceReportQuery = z.infer<typeof attendanceReportSchema>;
