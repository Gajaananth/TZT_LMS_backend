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
const resolveAuthor = async (userId) => {
    const student = await client_1.prisma.student.findUnique({
        where: { userId },
        select: { id: true },
    });
    if (student)
        return { studentId: student.id, teacherId: null };
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { userId },
        select: { id: true },
    });
    if (teacher)
        return { studentId: null, teacherId: teacher.id };
    throw new Error('User profile not found. Please complete onboarding before participating.');
};
const authorInclude = {
    student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
    teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
};
class DiscussionService {
    static async createTopic(data, userId) {
        const author = await resolveAuthor(userId);
        const topic = await client_1.prisma.discussionTopic.create({
            data: { ...data, ...author, createdBy: userId },
            include: authorInclude,
        });
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
        const topics = await client_1.prisma.discussionTopic.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                ...authorInclude,
                replies: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        ...authorInclude,
                        reactions: true,
                    },
                },
            },
        });
        return topics;
    }
    static async replyToTopic(topicId, content, userId) {
        const author = await resolveAuthor(userId);
        const reply = await client_1.prisma.discussionReply.create({
            data: { topicId, content, ...author, createdBy: userId },
            include: { ...authorInclude, reactions: true },
        });
        return reply;
    }
    static async reactToReply(replyId, type, userId) {
        const author = await resolveAuthor(userId);
        const reaction = await client_1.prisma.discussionReaction.create({
            data: { replyId, type: normalizeReactionType(type), ...author },
        });
        return reaction;
    }
}
exports.DiscussionService = DiscussionService;
exports.default = DiscussionService;
