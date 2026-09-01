import { prisma } from '@/db/prisma/client';
import { $Enums } from '@prisma/client';

const normalizeReactionType = (type: string): $Enums.ReactionType => {
  const normalized = (type || 'LIKE').toUpperCase();
  if (Object.values($Enums.ReactionType).includes(normalized as $Enums.ReactionType)) {
    return normalized as $Enums.ReactionType;
  }
  return $Enums.ReactionType.LIKE;
};

export class DiscussionService {
  static async createTopic(data: any, userId: string) {
    const topic = await prisma.discussionTopic.create({ data: { ...data, studentId: userId, createdBy: userId } });
    return topic;
  }

  static async listTopics(query: any = {}) {
    const { courseId, lessonId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (courseId) where.courseId = courseId;
    if (lessonId) where.lessonId = lessonId;

    const topics = await prisma.discussionTopic.findMany({ where, skip, take: limit, include: { replies: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    return topics;
  }

  static async replyToTopic(topicId: string, content: string, userId: string) {
    const reply = await prisma.discussionReply.create({ data: { topicId, content, studentId: userId, createdBy: userId } });
    return reply;
  }

  static async reactToReply(replyId: string, type: string, userId: string) {
    const reaction = await prisma.discussionReaction.create({ data: { replyId, type: normalizeReactionType(type), studentId: userId } });
    return reaction;
  }
}

export default DiscussionService;
