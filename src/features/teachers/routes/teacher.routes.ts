import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller';
import { TeacherIdCardController } from '../controllers/idcard.controller';
import { requireAuth } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { bulkLimiter } from '@/middleware/rate-limit';
import { createTeacherSchema, updateTeacherSchema, assignTeacherSchema, listTeachersSchema, importTeachersSchema, uploadTeacherPhotoSchema } from '../validators/teacher.validator';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/teachers - Create a new teacher
 * Body: { firstName, lastName, email, password, specialization?, dateOfJoining?, salary? }
 */
router.post('/', validate(createTeacherSchema), TeacherController.createTeacher);

/**
 * GET /api/v1/teachers - List teachers with pagination and filtering
 * Query: { page, limit, search, specialization, isActive, sortBy, sortOrder }
 */
router.get('/', validate(listTeachersSchema, 'query'), TeacherController.listTeachers);

/**
 * POST /api/v1/teachers/import - Bulk import teachers from CSV
 */
router.post('/import', bulkLimiter, validate(importTeachersSchema), TeacherController.importTeachers);

/**
 * GET /api/v1/teachers/export - Export teachers as CSV
 */
router.get('/export', bulkLimiter, validate(listTeachersSchema, 'query'), TeacherController.exportTeachers);

/**
 * POST /api/v1/teachers/:id/photo - Upload teacher photo
 */
router.post('/:id/photo', validate(uploadTeacherPhotoSchema), TeacherController.uploadTeacherPhoto);

/**
 * GET /api/v1/teachers/:id/id-card - Get teacher ID card data (with QR payload)
 */
router.get('/:id/id-card', TeacherIdCardController.getTeacherIdCard);

/**
 * PATCH /api/v1/teachers/:id/id-info - Update DOB, NIC, photo for ID card
 */
router.patch('/:id/id-info', TeacherIdCardController.updateTeacherIdInfo);

/**
 * POST /api/v1/teachers/:id/issue-id-card - Mark ID card as issued
 */
router.post('/:id/issue-id-card', TeacherIdCardController.issueTeacherIdCard);

/**
 * GET /api/v1/teachers/:id - Get single teacher with full details
 */
router.get('/:id', TeacherController.getTeacher);

/**
 * PATCH /api/v1/teachers/:id - Update teacher information
 * Body: { firstName, lastName, specialization, salary, isActive }
 */
router.patch('/:id', validate(updateTeacherSchema), TeacherController.updateTeacher);

/**
 * DELETE /api/v1/teachers/:id - Soft delete a teacher
 */
router.delete('/:id', TeacherController.deleteTeacher);

/**
 * POST /api/v1/teachers/:id/assign - Assign teacher to a course/batch
 * Body: { courseId, batchId, moduleId?, assignmentType }
 */
router.post('/:id/assign', validate(assignTeacherSchema), TeacherController.assignTeacher);

/**
 * GET /api/v1/teachers/:id/assignments - Get teacher's course assignments
 */
router.get('/:id/assignments', TeacherController.getAssignments);

/**
 * GET /api/v1/teachers/:id/performance - Get teacher's performance reports
 */
router.get('/:id/performance', TeacherController.getPerformance);

/**
 * POST /api/v1/teachers/:id/enroll-student-by-id - Enroll a student by their unique ID
 * Body: { uniqueId, courseId, batchId }
 */
router.post('/:id/enroll-student-by-id', TeacherController.enrollStudentByUniqueId);

export default router;
