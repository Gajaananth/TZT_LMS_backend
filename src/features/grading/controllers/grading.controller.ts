import { NextFunction, Request, Response } from 'express';
import GradingService from '../services/grading.service';

export const runAutoGrader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await GradingService.autoGradeAttempt(req.params.attemptId);
    res.json(updated);
  } catch (err: any) {
    next(err);
  }
};

export const getManualQueue = async (req: Request, res: Response) => {
  const items = await GradingService.listManualQueue();
  res.json(items);
};

export const manualGrade = async (req: Request, res: Response) => {
  const graderId = (req as any).user?.id || 'system';
  const score = Number(req.body.score || 0);
  const updated = await GradingService.manualGradeAttempt(req.params.attemptId, score, graderId);
  res.json(updated);
};

export default { runAutoGrader, getManualQueue, manualGrade };
