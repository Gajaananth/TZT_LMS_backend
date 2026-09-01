import { Request, Response } from 'express';
import ExamService from '../services/exam.service';
import { sendSuccess, sendError } from '@/utils/api-response';

// List all exams with optional filtering
export const listExams = async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query;
    const exams = await ExamService.listExams({
      status: status as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });
    sendSuccess(res, { exams }, 'Exams retrieved successfully');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to retrieve exams', 500);
  }
};

// Get single exam with questions
export const getExam = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const exam = await ExamService.getExamWithQuestions(examId);
    sendSuccess(res, { exam }, 'Exam retrieved successfully');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to retrieve exam', 500);
  }
};

export const getExamQuestions = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const questions = await ExamService.getExamQuestions(examId);
    sendSuccess(res, questions, 'Exam questions retrieved successfully');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to retrieve exam questions', 500);
  }
};

// Start a new exam attempt
export const startExam = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { examId } = req.body;
    if (!examId) {
      return sendError(res, 'examId required', 400);
    }
    const attempt = await ExamService.startAttempt(examId, userId);
    sendSuccess(res, { attempt }, 'Exam started', 201);
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to start exam', 500);
  }
};

// Autosave exam responses
export const autosave = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { responses, questionId, response } = req.body;
    const normalizedResponses = Array.isArray(responses)
      ? responses
      : response
        ? [{ questionId: questionId || response.questionId, ...response }]
        : [];

    if (!normalizedResponses.length) {
      return sendError(res, 'responses array required', 400);
    }
    const updated = await ExamService.autosaveAttempt(attemptId, normalizedResponses);
    sendSuccess(res, { attempt: updated }, 'Responses saved');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to save responses', 500);
  }
};

// Resume an existing exam attempt
export const resume = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const attempt = await ExamService.resumeAttempt(attemptId);
    if (!attempt) {
      return sendError(res, 'Attempt not found', 404);
    }
    sendSuccess(res, { attempt }, 'Attempt resumed');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to resume attempt', 500);
  }
};

// Submit exam attempt (triggers auto-grading)
export const submit = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { responses } = req.body || {};
    const updated = await ExamService.submitAttempt(attemptId, Array.isArray(responses) ? responses : []);
    sendSuccess(res, { attempt: updated }, 'Exam submitted successfully');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to submit exam', 500);
  }
};

// Get exam results
export const getResults = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const results = await ExamService.getAttemptResults(attemptId);
    sendSuccess(res, { results }, 'Results retrieved');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to retrieve results', 500);
  }
};

// Get detailed exam results with question breakdown
export const getDetails = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const details = await ExamService.getAttemptDetails(attemptId);
    sendSuccess(res, { details }, 'Details retrieved');
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to retrieve details', 500);
  }
};

// Create a new exam
export const createExam = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { title, description, courseId, startDate, endDate, durationMinutes, passingScore, randomizeQuestions, sections } = req.body;

    if (!title || !courseId) {
      return sendError(res, 'Missing required fields: title, courseId', 400);
    }

    const exam = await ExamService.createExam(
      {
        title,
        description,
        courseId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        durationMinutes,
        passingScore,
        randomizeQuestions,
        sections,
      },
      userId,
    );

    sendSuccess(res, { exam }, 'Exam created successfully', 201);
  } catch (err: any) {
    sendError(res, err?.message || 'Failed to create exam', 500);
  }
};

export default {
  listExams,
  getExam,
  getExamQuestions,
  startExam,
  autosave,
  resume,
  submit,
  getResults,
  getDetails,
  createExam,
};
