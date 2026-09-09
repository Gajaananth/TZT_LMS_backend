import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import SettingsService from '../services/settings.service';

export class SettingsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const group = (req.query.group as string) || undefined;
      const data = await SettingsService.listSettings(group, userId);
      return sendSuccess(res, data);
    } catch (err: any) {
      return next(err);
    }
  }

  static async bulkUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const records = req.body?.records || req.body;
      const data = await SettingsService.bulkUpdateSettings(records, userId);
      return sendSuccess(res, data, 'Settings updated');
    } catch (err: any) {
      return next(err);
    }
  }

  static async listRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await SettingsService.listRolesWithPermissions();
      return sendSuccess(res, { roles });
    } catch (err: any) {
      return next(err);
    }
  }

  static async listUsersRBAC(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 100);
      const data = await SettingsService.listUsersWithRoles(page, limit);
      return sendSuccess(res, data);
    } catch (err: any) {
      return next(err);
    }
  }

  static async assignUserRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const assignedBy = (req as any).user?.id || '';
      const targetUserId = req.params.userId;
      const roleIds = req.body?.roleIds || req.body?.roles || [];
      if (!targetUserId) return sendError(res, 'userId is required', 400);
      const result = await SettingsService.assignUserRoles(targetUserId, roleIds, assignedBy);
      return sendSuccess(res, result, 'User roles updated');
    } catch (err: any) {
      if (/SuperAdmin/.test(err.message || '')) {
        return sendError(res, err.message, 403);
      }
      return next(err);
    }
  }
}

export default SettingsController;
