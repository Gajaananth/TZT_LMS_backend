"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingController = void 0;
const api_response_1 = require("../../../utils/api-response");
const messaging_service_1 = require("../services/messaging.service");
const content_filter_1 = require("../../../lib/content-filter");
class MessagingController {
    static async send(req, res, next) {
        try {
            const senderId = req.user?.id;
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
            const message = await messaging_service_1.MessagingService.sendMessage(senderId, recipientId, content);
            return (0, api_response_1.sendSuccess)(res, message, 'Message sent successfully', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async getConversation(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            const { partnerId } = req.params;
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 50);
            const conversation = await messaging_service_1.MessagingService.getConversation(userId, partnerId, page, limit);
            return (0, api_response_1.sendSuccess)(res, conversation);
        }
        catch (err) {
            return next(err);
        }
    }
    static async getInbox(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            const inbox = await messaging_service_1.MessagingService.getInbox(userId);
            return (0, api_response_1.sendSuccess)(res, inbox);
        }
        catch (err) {
            return next(err);
        }
    }
    static async markRead(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            const { partnerId } = req.params;
            const result = await messaging_service_1.MessagingService.markRead(userId, partnerId);
            return (0, api_response_1.sendSuccess)(res, result, 'Messages marked as read');
        }
        catch (err) {
            return next(err);
        }
    }
    static async getTemplates(req, res, next) {
        try {
            return (0, api_response_1.sendSuccess)(res, content_filter_1.PRE_ENROLLMENT_TEMPLATES);
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.MessagingController = MessagingController;
exports.default = MessagingController;
