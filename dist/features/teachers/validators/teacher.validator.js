"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTeacherPhotoSchema = exports.importTeachersSchema = exports.listTeachersSchema = exports.assignTeacherSchema = exports.updateTeacherSchema = exports.createTeacherSchema = void 0;
const zod_1 = require("zod");
exports.createTeacherSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    specialization: zod_1.z.string().optional(),
    dateOfJoining: zod_1.z.string().datetime().optional(),
    salary: zod_1.z.number().nonnegative().optional(),
});
exports.updateTeacherSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    specialization: zod_1.z.string().optional(),
    salary: zod_1.z.number().nonnegative().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.assignTeacherSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid('Invalid course ID'),
    batchId: zod_1.z.string().uuid('Invalid batch ID'),
    moduleId: zod_1.z.string().uuid().optional(),
    assignmentType: zod_1.z.enum(['teaching', 'grading', 'attendance']).default('teaching'),
});
exports.listTeachersSchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).default('1').optional(),
    limit: zod_1.z.string().transform(Number).default('10').optional(),
    search: zod_1.z.string().optional(),
    specialization: zod_1.z.string().optional(),
    isActive: zod_1.z.string().transform(v => v === 'true').optional(),
    sortBy: zod_1.z.enum(['createdAt', 'firstName', 'employeeId']).default('createdAt').optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc').optional(),
});
exports.importTeachersSchema = zod_1.z.object({
    csv: zod_1.z.string().min(1, 'CSV content is required'),
});
exports.uploadTeacherPhotoSchema = zod_1.z.object({
    fileName: zod_1.z.string().min(1),
    mimeType: zod_1.z.string().min(1),
    fileData: zod_1.z.string().min(1),
});
