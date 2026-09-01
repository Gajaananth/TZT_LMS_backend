"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const question_controller_1 = __importDefault(require("../controllers/question.controller"));
const router = (0, express_1.Router)();
router.get('/', question_controller_1.default.listQuestions);
router.get('/:id', question_controller_1.default.getQuestion);
router.post('/', question_controller_1.default.createQuestion);
router.put('/:id', question_controller_1.default.updateQuestion);
router.delete('/:id', question_controller_1.default.deleteQuestion);
exports.default = router;
