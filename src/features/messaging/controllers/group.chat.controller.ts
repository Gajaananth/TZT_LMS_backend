import { Request, Response, NextFunction } from 'express';
import GroupChatService from '../services/group.chat.service';

export class GroupChatController {
  static async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = (req as any).user?.id;
      const { name, subject, studentIds } = req.body;
      const group = await GroupChatService.createGroup(teacherId, { name, subject, studentIds });
      return res.status(201).json({ success: true, data: group });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async listGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const groups = await GroupChatService.listUserGroups(userId);
      return res.status(200).json({ success: true, data: groups });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { groupId } = req.params;
      const data = await GroupChatService.getGroupDetails(groupId, userId);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  static async setLeader(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = (req as any).user?.id;
      const { groupId } = req.params;
      const { leaderStudentId } = req.body;
      const result = await GroupChatService.setLeader(groupId, teacherId, leaderStudentId);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = (req as any).user?.id;
      const { groupId } = req.params;
      const { studentId } = req.body;
      const member = await GroupChatService.addMember(groupId, teacherId, studentId);
      return res.status(201).json({ success: true, data: member });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = (req as any).user?.id;
      const { groupId, userId } = req.params;
      const result = await GroupChatService.removeMember(groupId, teacherId, userId);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async muteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user?.id;
      const { groupId } = req.params;
      const { targetUserId, minutes, reason } = req.body;
      const result = await GroupChatService.muteMember(groupId, actorId, targetUserId, minutes, reason);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async unmuteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user?.id;
      const { groupId } = req.params;
      const { targetUserId } = req.body;
      const result = await GroupChatService.unmuteMember(groupId, actorId, targetUserId);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async flagMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const leaderId = (req as any).user?.id;
      const { groupId, messageId } = req.params;
      const { reason } = req.body;
      const result = await GroupChatService.flagMessage(groupId, leaderId, messageId, reason);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = (req as any).user?.id;
      const { groupId } = req.params;
      const { content, mediaType, mediaMetadata, ephemeralData } = req.body;
      const msg = await GroupChatService.sendMessage(groupId, senderId, {
        content,
        mediaType,
        mediaMetadata,
        ephemeralData,
      });
      return res.status(201).json({ success: true, data: msg });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user?.id;
      const { groupId, messageId } = req.params;
      const result = await GroupChatService.deleteMessage(groupId, actorId, messageId);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { groupId } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const data = await GroupChatService.getGroupMessages(groupId, userId, page, limit);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
export default GroupChatController;
