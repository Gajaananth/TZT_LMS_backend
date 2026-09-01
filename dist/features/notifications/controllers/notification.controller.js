"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const api_response_1 = require("../../../utils/api-response");
const notification_service_1 = __importDefault(require("../services/notification.service"));
class NotificationController {
    static async create(req, res, next) {
        try {
            const { userId, type, title, body, relatedId, relatedType } = req.body;
            const note = await notification_service_1.default.createNotification(userId, type, title, body, relatedId, relatedType);
            return (0, api_response_1.sendSuccess)(res, note, 'Notification created', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async list(req, res, next) {
        try {
            const userId = req.user?.id || req.query.userId;
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 20);
            const unreadOnly = req.query.unreadOnly === 'true';
            const result = await notification_service_1.default.listNotifications(userId, page, limit, unreadOnly);
            return (0, api_response_1.sendSuccess)(res, result);
        }
        catch (err) {
            return next(err);
        }
    }
    static async getUnreadCount(req, res, next) {
        try {
            const userId = req.user?.id;
            const result = await notification_service_1.default.getUnreadCount(userId);
            return (0, api_response_1.sendSuccess)(res, result);
        }
        catch (err) {
            return next(err);
        }
    }
    static async markAsRead(req, res, next) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            await notification_service_1.default.markAsRead(userId, id);
            return (0, api_response_1.sendSuccess)(res, null, 'Notification marked as read');
        }
        catch (err) {
            return next(err);
        }
    }
    static async markAllAsRead(req, res, next) {
        try {
            const userId = req.user?.id;
            await notification_service_1.default.markAllAsRead(userId);
            return (0, api_response_1.sendSuccess)(res, null, 'All notifications marked as read');
        }
        catch (err) {
            return next(err);
        }
    }
    static async delete(req, res, next) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            await notification_service_1.default.deleteNotification(userId, id);
            return (0, api_response_1.sendSuccess)(res, null, 'Notification deleted');
        }
        catch (err) {
            return next(err);
        }
    }
    static async deleteAll(req, res, next) {
        try {
            const userId = req.user?.id;
            await notification_service_1.default.deleteAllNotifications(userId);
            return (0, api_response_1.sendSuccess)(res, null, 'All notifications cleared');
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.NotificationController = NotificationController;
exports.default = NotificationController;
