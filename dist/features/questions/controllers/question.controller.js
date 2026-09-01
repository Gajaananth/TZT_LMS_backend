"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestion = exports.updateQuestion = exports.createQuestion = exports.getQuestion = exports.listQuestions = void 0;
const question_service_1 = __importDefault(require("../services/question.service"));
const listQuestions = async (req, res, next) => {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const result = await question_service_1.default.listQuestions(page, limit);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.listQuestions = listQuestions;
const getQuestion = async (req, res, next) => {
    try {
        const q = await question_service_1.default.getQuestion(req.params.id);
        if (!q)
            return res.status(404).json({ error: 'Not found' });
        res.json(q);
    }
    catch (err) {
        next(err);
    }
};
exports.getQuestion = getQuestion;
const createQuestion = async (req, res, next) => {
    try {
        const userId = req.user?.id || 'system';
        const created = await question_service_1.default.createQuestion(req.body, userId);
        res.status(201).json(created);
    }
    catch (err) {
        next(err);
    }
};
exports.createQuestion = createQuestion;
const updateQuestion = async (req, res, next) => {
    try {
        const userId = req.user?.id || 'system';
        const updated = await question_service_1.default.updateQuestion(req.params.id, req.body, userId);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
};
exports.updateQuestion = updateQuestion;
const deleteQuestion = async (req, res, next) => {
    try {
        const userId = req.user?.id || 'system';
        const deleted = await question_service_1.default.deleteQuestion(req.params.id, userId);
        res.json(deleted);
    }
    catch (err) {
        next(err);
    }
};
exports.deleteQuestion = deleteQuestion;
exports.default = {
    listQuestions: exports.listQuestions,
    getQuestion: exports.getQuestion,
    createQuestion: exports.createQuestion,
    updateQuestion: exports.updateQuestion,
    deleteQuestion: exports.deleteQuestion,
};
