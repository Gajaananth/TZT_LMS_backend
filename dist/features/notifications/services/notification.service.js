"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const client_1 = require("../../../db/prisma/client");
const supabase_1 = require("../../../lib/supabase");
class NotificationService {
    static async createNotification(userId, type, title, body, relatedId, relatedType) {
        const note = await client_1.prisma.notification.create({
            data: {
                userId,
                type: type,
                title,
                body,
                relatedId,
                relatedType,
            },
        });
        // Broadcast via Supabase Realtime if available
        try {
            if (typeof supabase_1.supabaseAdmin?.channel === 'function') {
                const channel = supabase_1.supabaseAdmin.channel(`notifications:${userId}`);
                await channel.send({ type: 'broadcast', event: 'new_notification', payload: note });
            }
        }
        catch (e) {
            console.warn('Realtime publish failed', e);
        }
        return note;
    }
    static async listNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
        const skip = (page - 1) * limit;
        const where = {
            userId,
            deletedAt: null,
        };
        if (unreadOnly) {
            where.isRead = false;
        }
        const items = await client_1.prisma.notification.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
        const total = await client_1.prisma.notification.count({ where });
        const unreadCount = await client_1.prisma.notification.count({
            where: { userId, isRead: false, deletedAt: null },
        });
        return { items, pagination: { total, page, limit }, unreadCount };
    }
    static async getUnreadCount(userId) {
        const count = await client_1.prisma.notification.count({
            where: { userId, isRead: false, deletedAt: null },
        });
        return { unreadCount: count };
    }
    static async markAsRead(userId, notificationId) {
        const note = await client_1.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true, readAt: new Date() },
        });
        return note;
    }
    static async markAllAsRead(userId) {
        const result = await client_1.prisma.notification.updateMany({
            where: { userId, isRead: false, deletedAt: null },
            data: { isRead: true, readAt: new Date() },
        });
        return result;
    }
    static async deleteNotification(userId, notificationId) {
        const note = await client_1.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { deletedAt: new Date() },
        });
        return note;
    }
    static async deleteAllNotifications(userId) {
        const result = await client_1.prisma.notification.updateMany({
            where: { userId, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        return result;
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
