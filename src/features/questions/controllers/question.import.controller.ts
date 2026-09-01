import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import QuestionImportService from '../services/question.import.service';

export class QuestionImportController {
  static async import(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const contentType = req.headers['content-type'] || '';
      let created;
      if (contentType.includes('application/json')) {
        created = await QuestionImportService.importFromJson(req.body, userId);
      } else if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
        const raw = (req.body && typeof req.body === 'string') ? req.body : '';
        created = await QuestionImportService.importFromCsv(raw, userId);
      } else {
        return sendError(res, 'Unsupported content type', 415);
      }
      return sendSuccess(res, { total: created.length, created }, 'Imported');
    } catch (err: any) {
      return next(err);
    }
  }

  static async export(req: Request, res: Response, next: NextFunction) {
    try {
      const format = (req.query.format as string) || 'json';
      if (format === 'json') {
        const data = await QuestionImportService.exportAsJson({});
        return res.json(data);
      }
      if (format === 'csv') {
        const data = await QuestionImportService.exportAsCsv({});
        res.setHeader('Content-Type', 'text/csv');
        return res.send(data);
      }
      return sendError(res, 'Unsupported format', 400);
    } catch (err: any) {
      return next(err);
    }
  }
}

export default QuestionImportController;
