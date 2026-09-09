import { NextFunction, Request, Response } from 'express';
import QuestionService from '../services/question.service';
import { AppError } from '@/utils/app-error';

const toValidationError = (err: unknown) => {
  if (err instanceof AppError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new AppError(msg, 400, 'QUESTION_VALIDATION_ERROR');
};

export const listQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const result = await QuestionService.listQuestions(page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await QuestionService.getQuestion(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json(q);
  } catch (err) {
    next(err);
  }
};

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const created = await QuestionService.createQuestion(req.body, userId);
    res.status(201).json(created);
  } catch (err) {
    next(toValidationError(err));
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const updated = await QuestionService.updateQuestion(req.params.id, req.body, userId);
    res.json(updated);
  } catch (err) {
    next(toValidationError(err));
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const deleted = await QuestionService.deleteQuestion(req.params.id, userId);
    res.json(deleted);
  } catch (err) {
    next(err instanceof Error && /not found/i.test(err.message) ? toValidationError(err) : err);
  }
};

export default {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
