"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionController = void 0;
const api_response_1 = require("../../../utils/api-response");
const discussion_service_1 = __importDefault(require("../services/discussion.service"));
class DiscussionController {
    static async list(req, res, next) {
        try {
            const { courseId, lessonId, page, limit } = req.query;
            const topics = await discussion_service_1.default.listTopics({ courseId, lessonId, page: Number(page || 1), limit: Number(limit || 20) });
            return (0, api_response_1.sendSuccess)(res, topics);
        }
        catch (err) {
            return next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const payload = req.body;
            const topic = await discussion_service_1.default.createTopic(payload, userId);
            return (0, api_response_1.sendSuccess)(res, topic, 'Topic created', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async reply(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const topicId = req.params.topicId;
            const { content } = req.body;
            const reply = await discussion_service_1.default.replyToTopic(topicId, content, userId);
            return (0, api_response_1.sendSuccess)(res, reply, 'Reply created', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async react(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const replyId = req.params.replyId;
            const { type } = req.body;
            const reaction = await discussion_service_1.default.reactToReply(replyId, type, userId);
            return (0, api_response_1.sendSuccess)(res, reaction, 'Reaction created', 201);
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.DiscussionController = DiscussionController;
exports.default = DiscussionController;
