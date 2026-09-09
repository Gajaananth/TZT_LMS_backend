import { prisma } from '@/db/prisma/client';
import { $Enums } from '@prisma/client';

const normalizeReactionType = (type: string): $Enums.ReactionType => {
  const normalized = (type || 'LIKE').toUpperCase();
  if (Object.values($Enums.ReactionType).includes(normalized as $Enums.ReactionType)) {
    return normalized as $Enums.ReactionType;
  }
  return $Enums.ReactionType.LIKE;
};

interface AuthorPair {
  studentId: string | null;
  teacherId: string | null;
}

const resolveAuthor = async (userId: string): Promise<AuthorPair> => {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (student) return { studentId: student.id, teacherId: null };

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (teacher) return { studentId: null, teacherId: teacher.id };

  throw new Error('User profile not found. Please complete onboarding before participating.');
};

const authorInclude = {
  student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
  teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
};

export class DiscussionService {
  static async createTopic(data: any, userId: string) {
    const author = await resolveAuthor(userId);
    const topic = await prisma.discussionTopic.create({
      data: { ...data, ...author, createdBy: userId },
      include: authorInclude,
    });
    return topic;
  }

  static async listTopics(query: any = {}) {
    const { courseId, lessonId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (courseId) where.courseId = courseId;
    if (lessonId) where.lessonId = lessonId;

    const topics = await prisma.discussionTopic.findMany({
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

  static async replyToTopic(topicId: string, content: string, userId: string) {
    const author = await resolveAuthor(userId);
    const reply = await prisma.discussionReply.create({
      data: { topicId, content, ...author, createdBy: userId },
      include: { ...authorInclude, reactions: true },
    });
    return reply;
  }

  static async reactToReply(replyId: string, type: string, userId: string) {
    const author = await resolveAuthor(userId);
    const reaction = await prisma.discussionReaction.create({
      data: { replyId, type: normalizeReactionType(type), ...author },
    });
    return reaction;
  }
}

export default DiscussionService;
