import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import ReportService from '../services/report.service';

export class ReportController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const { templateId, parameters } = req.body;
      const result = await ReportService.generateReport(templateId, parameters, userId);
      return sendSuccess(res, result, 'Report generated', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await ReportService.listGeneratedReports(page, limit);
      return sendSuccess(res, result);
    } catch (err: any) {
      return next(err);
    }
  }
}

export default ReportController;
