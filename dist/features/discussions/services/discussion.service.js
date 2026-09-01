"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscussionService = void 0;
const client_1 = require("../../../db/prisma/client");
const client_2 = require("@prisma/client");
const normalizeReactionType = (type) => {
    const normalized = (type || 'LIKE').toUpperCase();
    if (Object.values(client_2.$Enums.ReactionType).includes(normalized)) {
        return normalized;
    }
    return client_2.$Enums.ReactionType.LIKE;
};
class DiscussionService {
    static async createTopic(data, userId) {
        const topic = await client_1.prisma.discussionTopic.create({ data: { ...data, studentId: userId, createdBy: userId } });
        return topic;
    }
    static async listTopics(query = {}) {
        const { courseId, lessonId, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;
        const where = { deletedAt: null };
        if (courseId)
            where.courseId = courseId;
        if (lessonId)
            where.lessonId = lessonId;
        const topics = await client_1.prisma.discussionTopic.findMany({ where, skip, take: limit, include: { replies: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
        return topics;
    }
    static async replyToTopic(topicId, content, userId) {
        const reply = await client_1.prisma.discussionReply.create({ data: { topicId, content, studentId: userId, createdBy: userId } });
        return reply;
    }
    static async reactToReply(replyId, type, userId) {
        const reaction = await client_1.prisma.discussionReaction.create({ data: { replyId, type: normalizeReactionType(type), studentId: userId } });
        return reaction;
    }
}
exports.DiscussionService = DiscussionService;
exports.default = DiscussionService;
