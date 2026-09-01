"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualGrade = exports.getManualQueue = exports.runAutoGrader = void 0;
const grading_service_1 = __importDefault(require("../services/grading.service"));
const runAutoGrader = async (req, res, next) => {
    try {
        const updated = await grading_service_1.default.autoGradeAttempt(req.params.attemptId);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
};
exports.runAutoGrader = runAutoGrader;
const getManualQueue = async (req, res) => {
    const items = await grading_service_1.default.listManualQueue();
    res.json(items);
};
exports.getManualQueue = getManualQueue;
const manualGrade = async (req, res) => {
    const graderId = req.user?.id || 'system';
    const score = Number(req.body.score || 0);
    const updated = await grading_service_1.default.manualGradeAttempt(req.params.attemptId, score, graderId);
    res.json(updated);
};
exports.manualGrade = manualGrade;
exports.default = { runAutoGrader: exports.runAutoGrader, getManualQueue: exports.getManualQueue, manualGrade: exports.manualGrade };
