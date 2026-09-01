"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_controller_1 = require("../controllers/teacher.controller");
const idcard_controller_1 = require("../controllers/idcard.controller");
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const validate_middleware_1 = require("../../../middleware/validate.middleware");
const rate_limit_1 = require("../../../middleware/rate-limit");
const teacher_validator_1 = require("../validators/teacher.validator");
const router = (0, express_1.Router)({ mergeParams: true });
// All routes require authentication
router.use(auth_middleware_1.requireAuth);
/**
 * POST /api/v1/teachers - Create a new teacher
 * Body: { firstName, lastName, email, password, specialization?, dateOfJoining?, salary? }
 */
router.post('/', (0, validate_middleware_1.validate)(teacher_validator_1.createTeacherSchema), teacher_controller_1.TeacherController.createTeacher);
/**
 * GET /api/v1/teachers - List teachers with pagination and filtering
 * Query: { page, limit, search, specialization, isActive, sortBy, sortOrder }
 */
router.get('/', (0, validate_middleware_1.validate)(teacher_validator_1.listTeachersSchema, 'query'), teacher_controller_1.TeacherController.listTeachers);
/**
 * POST /api/v1/teachers/import - Bulk import teachers from CSV
 */
router.post('/import', rate_limit_1.bulkLimiter, (0, validate_middleware_1.validate)(teacher_validator_1.importTeachersSchema), teacher_controller_1.TeacherController.importTeachers);
/**
 * GET /api/v1/teachers/export - Export teachers as CSV
 */
router.get('/export', rate_limit_1.bulkLimiter, (0, validate_middleware_1.validate)(teacher_validator_1.listTeachersSchema, 'query'), teacher_controller_1.TeacherController.exportTeachers);
/**
 * POST /api/v1/teachers/:id/photo - Upload teacher photo
 */
router.post('/:id/photo', (0, validate_middleware_1.validate)(teacher_validator_1.uploadTeacherPhotoSchema), teacher_controller_1.TeacherController.uploadTeacherPhoto);
/**
 * GET /api/v1/teachers/:id/id-card - Get teacher ID card data (with QR payload)
 */
router.get('/:id/id-card', idcard_controller_1.TeacherIdCardController.getTeacherIdCard);
/**
 * PATCH /api/v1/teachers/:id/id-info - Update DOB, NIC, photo for ID card
 */
router.patch('/:id/id-info', idcard_controller_1.TeacherIdCardController.updateTeacherIdInfo);
/**
 * POST /api/v1/teachers/:id/issue-id-card - Mark ID card as issued
 */
router.post('/:id/issue-id-card', idcard_controller_1.TeacherIdCardController.issueTeacherIdCard);
/**
 * GET /api/v1/teachers/:id - Get single teacher with full details
 */
router.get('/:id', teacher_controller_1.TeacherController.getTeacher);
/**
 * PATCH /api/v1/teachers/:id - Update teacher information
 * Body: { firstName, lastName, specialization, salary, isActive }
 */
router.patch('/:id', (0, validate_middleware_1.validate)(teacher_validator_1.updateTeacherSchema), teacher_controller_1.TeacherController.updateTeacher);
/**
 * DELETE /api/v1/teachers/:id - Soft delete a teacher
 */
router.delete('/:id', teacher_controller_1.TeacherController.deleteTeacher);
/**
 * POST /api/v1/teachers/:id/assign - Assign teacher to a course/batch
 * Body: { courseId, batchId, moduleId?, assignmentType }
 */
router.post('/:id/assign', (0, validate_middleware_1.validate)(teacher_validator_1.assignTeacherSchema), teacher_controller_1.TeacherController.assignTeacher);
/**
 * GET /api/v1/teachers/:id/assignments - Get teacher's course assignments
 */
router.get('/:id/assignments', teacher_controller_1.TeacherController.getAssignments);
/**
 * GET /api/v1/teachers/:id/performance - Get teacher's performance reports
 */
router.get('/:id/performance', teacher_controller_1.TeacherController.getPerformance);
/**
 * POST /api/v1/teachers/:id/enroll-student-by-id - Enroll a student by their unique ID
 * Body: { uniqueId, courseId, batchId }
 */
router.post('/:id/enroll-student-by-id', teacher_controller_1.TeacherController.enrollStudentByUniqueId);
exports.default = router;
