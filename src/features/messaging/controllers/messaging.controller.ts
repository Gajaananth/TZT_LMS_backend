import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@/utils/api-response';
import { MessagingService } from '../services/messaging.service';
import { PRE_ENROLLMENT_TEMPLATES } from '@/lib/content-filter';

export class MessagingController {
  static async send(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = (req as any).user?.id;
      if (!senderId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { recipientId, content } = req.body;
      if (!recipientId || !content) {
        return res.status(400).json({
          success: false,
          message: 'recipientId and content are required'
        });
      }

      const message = await MessagingService.sendMessage(senderId, recipientId, content);
      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { partnerId } = req.params;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);

      const conversation = await MessagingService.getConversation(userId, partnerId, page, limit);
      return sendSuccess(res, conversation);
    } catch (err: any) {
      return next(err);
    }
  }

  static async getInbox(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const inbox = await MessagingService.getInbox(userId);
      return sendSuccess(res, inbox);
    } catch (err: any) {
      return next(err);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { partnerId } = req.params;
      const result = await MessagingService.markRead(userId, partnerId);
      return sendSuccess(res, result, 'Messages marked as read');
    } catch (err: any) {
      return next(err);
    }
  }

  static async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, PRE_ENROLLMENT_TEMPLATES);
    } catch (err: any) {
      return next(err);
    }
  }
}

export default MessagingController;
