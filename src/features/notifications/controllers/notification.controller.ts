import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@/utils/api-response';
import NotificationService from '../services/notification.service';

export class NotificationController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, type, title, body, relatedId, relatedType } = req.body;
      const note = await NotificationService.createNotification(userId, type, title, body, relatedId, relatedType);
      return sendSuccess(res, note, 'Notification created', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || req.query.userId;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const unreadOnly = req.query.unreadOnly === 'true';
      const result = await NotificationService.listNotifications(userId, page, limit, unreadOnly);
      return sendSuccess(res, result);
    } catch (err: any) {
      return next(err);
    }
  }

  static async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const result = await NotificationService.getUnreadCount(userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return next(err);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      await NotificationService.markAsRead(userId, id);
      return sendSuccess(res, null, 'Notification marked as read');
    } catch (err: any) {
      return next(err);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      await NotificationService.markAllAsRead(userId);
      return sendSuccess(res, null, 'All notifications marked as read');
    } catch (err: any) {
      return next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      await NotificationService.deleteNotification(userId, id);
      return sendSuccess(res, null, 'Notification deleted');
    } catch (err: any) {
      return next(err);
    }
  }

  static async deleteAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      await NotificationService.deleteAllNotifications(userId);
      return sendSuccess(res, null, 'All notifications cleared');
    } catch (err: any) {
      return next(err);
    }
  }
}

export default NotificationController;
