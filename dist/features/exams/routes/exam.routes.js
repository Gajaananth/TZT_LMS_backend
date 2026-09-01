"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exam_controller_1 = __importDefault(require("../controllers/exam.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// List all exams
router.get('/', auth_middleware_1.requireAuth, exam_controller_1.default.listExams);
// Get single exam with questions
router.get('/:examId', auth_middleware_1.requireAuth, exam_controller_1.default.getExam);
// Get exam question set
router.get('/:examId/questions', auth_middleware_1.requireAuth, exam_controller_1.default.getExamQuestions);
// Start exam attempt
router.post('/start', auth_middleware_1.requireAuth, exam_controller_1.default.startExam);
// Autosave responses
router.post('/:attemptId/autosave', auth_middleware_1.requireAuth, exam_controller_1.default.autosave);
// Resume attempt
router.get('/:attemptId/resume', auth_middleware_1.requireAuth, exam_controller_1.default.resume);
// Submit attempt (triggers grading)
router.post('/:attemptId/submit', auth_middleware_1.requireAuth, exam_controller_1.default.submit);
// Get results
router.get('/:attemptId/results', auth_middleware_1.requireAuth, exam_controller_1.default.getResults);
// Get detailed results
router.get('/:attemptId/details', auth_middleware_1.requireAuth, exam_controller_1.default.getDetails);
exports.default = router;
