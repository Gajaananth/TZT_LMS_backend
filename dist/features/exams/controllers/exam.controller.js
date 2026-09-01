"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetails = exports.getResults = exports.submit = exports.resume = exports.autosave = exports.startExam = exports.getExamQuestions = exports.getExam = exports.listExams = void 0;
const exam_service_1 = __importDefault(require("../services/exam.service"));
const api_response_1 = require("../../../utils/api-response");
// List all exams with optional filtering
const listExams = async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const exams = await exam_service_1.default.listExams({
            status: status,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 50,
        });
        (0, api_response_1.sendSuccess)(res, { exams }, 'Exams retrieved successfully');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to retrieve exams', 500);
    }
};
exports.listExams = listExams;
// Get single exam with questions
const getExam = async (req, res) => {
    try {
        const { examId } = req.params;
        const exam = await exam_service_1.default.getExamWithQuestions(examId);
        (0, api_response_1.sendSuccess)(res, { exam }, 'Exam retrieved successfully');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to retrieve exam', 500);
    }
};
exports.getExam = getExam;
const getExamQuestions = async (req, res) => {
    try {
        const { examId } = req.params;
        const questions = await exam_service_1.default.getExamQuestions(examId);
        (0, api_response_1.sendSuccess)(res, questions, 'Exam questions retrieved successfully');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to retrieve exam questions', 500);
    }
};
exports.getExamQuestions = getExamQuestions;
// Start a new exam attempt
const startExam = async (req, res) => {
    try {
        const userId = req.user?.id || 'system';
        const { examId } = req.body;
        if (!examId) {
            return (0, api_response_1.sendError)(res, 'examId required', 400);
        }
        const attempt = await exam_service_1.default.startAttempt(examId, userId);
        (0, api_response_1.sendSuccess)(res, { attempt }, 'Exam started', 201);
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to start exam', 500);
    }
};
exports.startExam = startExam;
// Autosave exam responses
const autosave = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { responses, questionId, response } = req.body;
        const normalizedResponses = Array.isArray(responses)
            ? responses
            : response
                ? [{ questionId: questionId || response.questionId, ...response }]
                : [];
        if (!normalizedResponses.length) {
            return (0, api_response_1.sendError)(res, 'responses array required', 400);
        }
        const updated = await exam_service_1.default.autosaveAttempt(attemptId, normalizedResponses);
        (0, api_response_1.sendSuccess)(res, { attempt: updated }, 'Responses saved');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to save responses', 500);
    }
};
exports.autosave = autosave;
// Resume an existing exam attempt
const resume = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const attempt = await exam_service_1.default.resumeAttempt(attemptId);
        if (!attempt) {
            return (0, api_response_1.sendError)(res, 'Attempt not found', 404);
        }
        (0, api_response_1.sendSuccess)(res, { attempt }, 'Attempt resumed');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to resume attempt', 500);
    }
};
exports.resume = resume;
// Submit exam attempt (triggers auto-grading)
const submit = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { responses } = req.body || {};
        const updated = await exam_service_1.default.submitAttempt(attemptId, Array.isArray(responses) ? responses : []);
        (0, api_response_1.sendSuccess)(res, { attempt: updated }, 'Exam submitted successfully');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to submit exam', 500);
    }
};
exports.submit = submit;
// Get exam results
const getResults = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const results = await exam_service_1.default.getAttemptResults(attemptId);
        (0, api_response_1.sendSuccess)(res, { results }, 'Results retrieved');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to retrieve results', 500);
    }
};
exports.getResults = getResults;
// Get detailed exam results with question breakdown
const getDetails = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const details = await exam_service_1.default.getAttemptDetails(attemptId);
        (0, api_response_1.sendSuccess)(res, { details }, 'Details retrieved');
    }
    catch (err) {
        (0, api_response_1.sendError)(res, err?.message || 'Failed to retrieve details', 500);
    }
};
exports.getDetails = getDetails;
exports.default = {
    listExams: exports.listExams,
    getExam: exports.getExam,
    getExamQuestions: exports.getExamQuestions,
    startExam: exports.startExam,
    autosave: exports.autosave,
    resume: exports.resume,
    submit: exports.submit,
    getResults: exports.getResults,
    getDetails: exports.getDetails,
};
