"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadStudentPhotoSchema = exports.importStudentsSchema = exports.listStudentsSchema = exports.updateStudentSchema = exports.createStudentSchema = void 0;
const zod_1 = require("zod");
exports.createStudentSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    dateOfBirth: zod_1.z.string().datetime().optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    addressLine1: zod_1.z.string().optional(),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    batchId: zod_1.z.string().uuid('Invalid batch ID'),
    departmentId: zod_1.z.string().uuid('Invalid department ID'),
    dateOfAdmission: zod_1.z.string().datetime().optional(),
    guardianFirstName: zod_1.z.string().optional(),
    guardianLastName: zod_1.z.string().optional(),
    guardianRelationship: zod_1.z.string().optional(),
    guardianPhone: zod_1.z.string().optional(),
    guardianEmail: zod_1.z.string().email().optional(),
    emergencyContactFirstName: zod_1.z.string().optional(),
    emergencyContactLastName: zod_1.z.string().optional(),
    emergencyContactRelationship: zod_1.z.string().optional(),
    emergencyContactPhone: zod_1.z.string().optional(),
    emergencyContactEmail: zod_1.z.string().email().optional(),
});
exports.updateStudentSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    dateOfBirth: zod_1.z.string().datetime().optional(),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    addressLine1: zod_1.z.string().optional(),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    batchId: zod_1.z.string().uuid().optional(),
    departmentId: zod_1.z.string().uuid().optional(),
    guardianFirstName: zod_1.z.string().optional(),
    guardianLastName: zod_1.z.string().optional(),
    guardianRelationship: zod_1.z.string().optional(),
    guardianPhone: zod_1.z.string().optional(),
    guardianEmail: zod_1.z.string().email().optional(),
    emergencyContactFirstName: zod_1.z.string().optional(),
    emergencyContactLastName: zod_1.z.string().optional(),
    emergencyContactRelationship: zod_1.z.string().optional(),
    emergencyContactPhone: zod_1.z.string().optional(),
    emergencyContactEmail: zod_1.z.string().email().optional(),
});
exports.listStudentsSchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).default('1').optional(),
    limit: zod_1.z.string().transform(Number).default('10').optional(),
    search: zod_1.z.string().optional(), // Search by name, email, or student ID
    batchId: zod_1.z.string().uuid().optional(),
    departmentId: zod_1.z.string().uuid().optional(),
    isActive: zod_1.z.string().transform(v => v === 'true').optional(),
    sortBy: zod_1.z.enum(['createdAt', 'firstName', 'studentId']).default('createdAt').optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc').optional(),
});
exports.importStudentsSchema = zod_1.z.object({
    csv: zod_1.z.string().min(1, 'CSV content is required'),
});
exports.uploadStudentPhotoSchema = zod_1.z.object({
    fileName: zod_1.z.string().min(1),
    mimeType: zod_1.z.string().min(1),
    fileData: zod_1.z.string().min(1),
});
