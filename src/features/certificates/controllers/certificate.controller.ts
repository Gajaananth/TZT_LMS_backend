import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import CertificateService from '../services/certificate.service';

export class CertificateController {
  static async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const tpl = await CertificateService.createTemplate(req.body, userId);
      return sendSuccess(res, tpl, 'Template created', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await CertificateService.listTemplates();
      return sendSuccess(res, templates);
    } catch (err: any) {
      return next(err);
    }
  }

  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const { attemptId } = req.body;
      const result = await CertificateService.generateCertificate(attemptId, userId);
      return sendSuccess(res, result, 'Certificate generated', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      const cert = await CertificateService.verifyCertificate(code);
      if (!cert) return sendError(res, 'Certificate not found', 404);
      return sendSuccess(res, cert);
    } catch (err: any) {
      return next(err);
    }
  }
}

export default CertificateController;
