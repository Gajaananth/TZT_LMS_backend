"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const question_controller_1 = __importDefault(require("../controllers/question.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// List/get questions are read-only and used by teachers/authors + exam creator UI;
// we still require authentication because question bank should not be public.
router.get('/', auth_middleware_1.requireAuth, question_controller_1.default.listQuestions);
router.get('/:id', auth_middleware_1.requireAuth, question_controller_1.default.getQuestion);
// Create / update / delete are teacher/admin only
router.post('/', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['Teacher', 'Admin', 'SuperAdmin']), question_controller_1.default.createQuestion);
router.put('/:id', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['Teacher', 'Admin', 'SuperAdmin']), question_controller_1.default.updateQuestion);
router.delete('/:id', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['Teacher', 'Admin', 'SuperAdmin']), question_controller_1.default.deleteQuestion);
exports.default = router;
