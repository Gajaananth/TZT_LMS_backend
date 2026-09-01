import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { StudentIdCardController } from '../controllers/idcard.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { bulkLimiter } from '@/middleware/rate-limit';
import { createStudentSchema, updateStudentSchema, listStudentsSchema, importStudentsSchema, uploadStudentPhotoSchema } from '../validators/student.validator';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/students - Create a new student
 * Body: { firstName, lastName, email, password, batchId, departmentId, ... }
 */
router.post('/', validate(createStudentSchema), StudentController.createStudent);

/**
 * GET /api/v1/students - List students with pagination and filtering
 * Query: { page, limit, search, batchId, departmentId, isActive, sortBy, sortOrder }
 */
router.get('/', validate(listStudentsSchema, 'query'), StudentController.listStudents);

/**
 * POST /api/v1/students/import - Bulk import students from CSV
 */
router.post('/import', bulkLimiter, validate(importStudentsSchema), StudentController.importStudents);

/**
 * GET /api/v1/students/export - Export students as CSV
 */
router.get('/export', bulkLimiter, validate(listStudentsSchema, 'query'), StudentController.exportStudents);

/**
 * POST /api/v1/students/:id/photo - Upload student photo
 */
router.post('/:id/photo', validate(uploadStudentPhotoSchema), StudentController.uploadStudentPhoto);

/**
 * GET /api/v1/students/:id/id-card - Get student ID card data (with QR payload)
 */
router.get('/:id/id-card', StudentIdCardController.getStudentIdCard);

/**
 * PATCH /api/v1/students/:id/id-info - Update DOB, NIC, photo for ID card
 */
router.patch('/:id/id-info', StudentIdCardController.updateStudentIdInfo);

/**
 * POST /api/v1/students/:id/issue-id-card - Mark ID card as issued
 */
router.post('/:id/issue-id-card', StudentIdCardController.issueStudentIdCard);

/**
 * GET /api/v1/students/:id - Get single student with full details
 */
router.get('/:id', StudentController.getStudent);

/**
 * PATCH /api/v1/students/:id - Update student information
 * Body: { firstName, lastName, addressLine1, ... }
 */
router.patch('/:id', validate(updateStudentSchema), StudentController.updateStudent);

/**
 * DELETE /api/v1/students/:id - Soft delete a student
 */
router.delete('/:id', StudentController.deleteStudent);

/**
 * POST /api/v1/students/:id/enroll - Enroll student in a course
 * Only Teachers, Admins, and SuperAdmins can enroll students
 * Body: { courseId, batchId }
 */
router.post('/:id/enroll', requireRole(['Teacher', 'Admin', 'SuperAdmin']), StudentController.enrollStudent);

/**
 * GET /api/v1/students/:id/enrollments - Get student's course enrollments
 */
router.get('/:id/enrollments', StudentController.getEnrollments);

/**
 * GET /api/v1/students/:id/attendance - Get student's attendance records
 * Query: { courseId? }
 */
router.get('/:id/attendance', StudentController.getAttendance);

/**
 * POST /api/v1/students/:id/enrollments/:enrollmentId/withdraw - Withdraw from a course
 * Only the student themselves can withdraw
 */
router.post('/:id/enrollments/:enrollmentId/withdraw', StudentController.withdrawFromCourse);

export default router;
