"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const grading_controller_1 = __importDefault(require("../controllers/grading.controller"));
const router = (0, express_1.Router)();
router.post('/auto/:attemptId', grading_controller_1.default.runAutoGrader);
router.get('/queue', grading_controller_1.default.getManualQueue);
router.post('/manual/:attemptId', grading_controller_1.default.manualGrade);
exports.default = router;
