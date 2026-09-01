import { prisma } from '@/db/prisma/client';
import { supabaseAdmin } from '@/lib/supabase';

export class NotificationService {
  static async createNotification(userId: string, type: string, title: string, body: string, relatedId?: string, relatedType?: string) {
    const note = await prisma.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        body,
        relatedId,
        relatedType,
      },
    });

    // Broadcast via Supabase Realtime if available
    try {
      if (typeof (supabaseAdmin as any)?.channel === 'function') {
        const channel = (supabaseAdmin as any).channel(`notifications:${userId}`);
        await channel.send({ type: 'broadcast', event: 'new_notification', payload: note });
      }
    } catch (e) {
      console.warn('Realtime publish failed', e);
    }

    return note;
  }

  static async listNotifications(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit;
    const where: any = {
      userId,
      deletedAt: null,
    };
    if (unreadOnly) {
      where.isRead = false;
    }

    const items = await prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.notification.count({ where });
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });

    return { items, pagination: { total, page, limit }, unreadCount };
  }

  static async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
    return { unreadCount: count };
  }

  static async markAsRead(userId: string, notificationId: string) {
    const note = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return note;
  }

  static async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false, deletedAt: null },
      data: { isRead: true, readAt: new Date() },
    });
    return result;
  }

  static async deleteNotification(userId: string, notificationId: string) {
    const note = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { deletedAt: new Date() },
    });
    return note;
  }

  static async deleteAllNotifications(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result;
  }
}

export default NotificationService;
