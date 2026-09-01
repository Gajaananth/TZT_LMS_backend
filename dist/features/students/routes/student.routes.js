"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_controller_1 = require("../controllers/student.controller");
const idcard_controller_1 = require("../controllers/idcard.controller");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const validate_middleware_1 = require("../../../middleware/validate.middleware");
const rate_limit_1 = require("../../../middleware/rate-limit");
const student_validator_1 = require("../validators/student.validator");
const router = (0, express_1.Router)({ mergeParams: true });
// All routes require authentication
router.use(auth_middleware_1.requireAuth);
/**
 * POST /api/v1/students - Create a new student
 * Body: { firstName, lastName, email, password, batchId, departmentId, ... }
 */
router.post('/', (0, validate_middleware_1.validate)(student_validator_1.createStudentSchema), student_controller_1.StudentController.createStudent);
/**
 * GET /api/v1/students - List students with pagination and filtering
 * Query: { page, limit, search, batchId, departmentId, isActive, sortBy, sortOrder }
 */
router.get('/', (0, validate_middleware_1.validate)(student_validator_1.listStudentsSchema, 'query'), student_controller_1.StudentController.listStudents);
/**
 * POST /api/v1/students/import - Bulk import students from CSV
 */
router.post('/import', rate_limit_1.bulkLimiter, (0, validate_middleware_1.validate)(student_validator_1.importStudentsSchema), student_controller_1.StudentController.importStudents);
/**
 * GET /api/v1/students/export - Export students as CSV
 */
router.get('/export', rate_limit_1.bulkLimiter, (0, validate_middleware_1.validate)(student_validator_1.listStudentsSchema, 'query'), student_controller_1.StudentController.exportStudents);
/**
 * POST /api/v1/students/:id/photo - Upload student photo
 */
router.post('/:id/photo', (0, validate_middleware_1.validate)(student_validator_1.uploadStudentPhotoSchema), student_controller_1.StudentController.uploadStudentPhoto);
/**
 * GET /api/v1/students/:id/id-card - Get student ID card data (with QR payload)
 */
router.get('/:id/id-card', idcard_controller_1.StudentIdCardController.getStudentIdCard);
/**
 * PATCH /api/v1/students/:id/id-info - Update DOB, NIC, photo for ID card
 */
router.patch('/:id/id-info', idcard_controller_1.StudentIdCardController.updateStudentIdInfo);
/**
 * POST /api/v1/students/:id/issue-id-card - Mark ID card as issued
 */
router.post('/:id/issue-id-card', idcard_controller_1.StudentIdCardController.issueStudentIdCard);
/**
 * GET /api/v1/students/:id - Get single student with full details
 */
router.get('/:id', student_controller_1.StudentController.getStudent);
/**
 * PATCH /api/v1/students/:id - Update student information
 * Body: { firstName, lastName, addressLine1, ... }
 */
router.patch('/:id', (0, validate_middleware_1.validate)(student_validator_1.updateStudentSchema), student_controller_1.StudentController.updateStudent);
/**
 * DELETE /api/v1/students/:id - Soft delete a student
 */
router.delete('/:id', student_controller_1.StudentController.deleteStudent);
/**
 * POST /api/v1/students/:id/enroll - Enroll student in a course
 * Only Teachers, Admins, and SuperAdmins can enroll students
 * Body: { courseId, batchId }
 */
router.post('/:id/enroll', (0, auth_middleware_1.requireRole)(['Teacher', 'Admin', 'SuperAdmin']), student_controller_1.StudentController.enrollStudent);
/**
 * GET /api/v1/students/:id/enrollments - Get student's course enrollments
 */
router.get('/:id/enrollments', student_controller_1.StudentController.getEnrollments);
/**
 * GET /api/v1/students/:id/attendance - Get student's attendance records
 * Query: { courseId? }
 */
router.get('/:id/attendance', student_controller_1.StudentController.getAttendance);
/**
 * POST /api/v1/students/:id/enrollments/:enrollmentId/withdraw - Withdraw from a course
 * Only the student themselves can withdraw
 */
router.post('/:id/enrollments/:enrollmentId/withdraw', student_controller_1.StudentController.withdrawFromCourse);
exports.default = router;
