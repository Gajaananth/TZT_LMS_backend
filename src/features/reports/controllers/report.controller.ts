import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import ReportService, { ReportFormat, ReportType } from '../services/report.service';

const VALID_TYPES: readonly ReportType[] = ['student', 'attendance', 'finance', 'academic', 'exam'];
const VALID_FORMATS: readonly ReportFormat[] = ['pdf', 'csv', 'excel'];

export class ReportController {
  static async downloadByType(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return sendError(res, 'Authentication required', 401);

      const type = (req.params.type || '').toLowerCase() as ReportType;
      const format = ((req.query.format as string) || 'csv').toLowerCase() as ReportFormat;

      if (!VALID_TYPES.includes(type)) {
        return sendError(res, `Invalid report type. Expected one of: ${VALID_TYPES.join(', ')}`, 400);
      }
      if (!VALID_FORMATS.includes(format)) {
        return sendError(res, `Invalid format. Expected one of: ${VALID_FORMATS.join(', ')}`, 400);
      }

      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;

      const artifact = await ReportService.exportReportByType(type, format, userId, { startDate, endDate });

      const encodedFilename = encodeURIComponent(artifact.filename);
      res.setHeader('Content-Type', artifact.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${artifact.filename}"; filename*=UTF-8''${encodedFilename}`,
      );
      res.setHeader('Content-Length', artifact.buffer.length.toString());
      return res.status(200).end(artifact.buffer);
    } catch (err: any) {
      return next(err);
    }
  }

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

