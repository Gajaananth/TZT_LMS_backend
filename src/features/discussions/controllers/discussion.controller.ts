import { NextFunction, Request, Response } from 'express';
import { sendError, sendSuccess } from '@/utils/api-response';
import DiscussionService from '../services/discussion.service';

export class DiscussionController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId, lessonId, page, limit } = req.query as any;
      const topics = await DiscussionService.listTopics({ courseId, lessonId, page: Number(page || 1), limit: Number(limit || 20) });
      return sendSuccess(res, topics);
    } catch (err: any) {
      return next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const payload = req.body;
      const topic = await DiscussionService.createTopic(payload, userId);
      return sendSuccess(res, topic, 'Topic created', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async reply(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const topicId = req.params.topicId;
      const { content } = req.body;
      const reply = await DiscussionService.replyToTopic(topicId, content, userId);
      return sendSuccess(res, reply, 'Reply created', 201);
    } catch (err: any) {
      return next(err);
    }
  }

  static async react(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || '';
      const replyId = req.params.replyId;
      const { type } = req.body;
      const reaction = await DiscussionService.reactToReply(replyId, type, userId);
      return sendSuccess(res, reaction, 'Reaction created', 201);
    } catch (err: any) {
      return next(err);
    }
  }
}

export default DiscussionController;
