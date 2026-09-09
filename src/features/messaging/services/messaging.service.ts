import { prisma } from '@/db/prisma/client';
import { filterContent, isPreEnrollmentTopicAllowed } from '@/lib/content-filter';
import { NotificationService } from '@/features/notifications/services/notification.service';

export class MessagingService {
  /**
   * Check if a student is actively enrolled in any course/batch taught by the teacher
   */
  static async checkEnrollment(userAId: string, userBId: string): Promise<boolean> {
    const student = await prisma.student.findFirst({
      where: {
        userId: { in: [userAId, userBId] },
        deletedAt: null,
      },
    });

    const teacher = await prisma.teacher.findFirst({
      where: {
        userId: { in: [userAId, userBId] },
        deletedAt: null,
      },
    });

    if (!student || !teacher) {
      return false;
    }

    const teacherAssignments = await prisma.teacherAssignment.findMany({
      where: {
        teacherId: teacher.id,
        deletedAt: null,
      },
      select: {
        courseId: true,
        batchId: true,
      },
    });

    if (!teacherAssignments.length) {
      return false;
    }

    const courseIds = teacherAssignments.map((a) => a.courseId).filter(Boolean);
    const batchIds = teacherAssignments.map((a) => a.batchId).filter(Boolean);

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        deletedAt: null,
        OR: [
          { courseId: { in: courseIds } },
          { batchId: { in: batchIds } },
        ],
      },
    });

    return !!enrollment;
  }

  /**
   * Send a direct message with strict content moderation and contextual restriction
   */
  static async sendMessage(senderId: string, recipientId: string, content: string) {
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    if (senderId === recipientId) {
      throw new Error('Cannot send a message to yourself');
    }

    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, firstName: true, lastName: true, userRoles: { include: { role: true } } },
      }),
      prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, firstName: true, lastName: true, userRoles: { include: { role: true } } },
      }),
    ]);

    if (!sender || !recipient) {
      throw new Error('Sender or recipient user not found');
    }

    const senderRoles = sender.userRoles.map((ur) => ur.role.name.toLowerCase());
    const isSenderStudent = senderRoles.includes('student');

    const isEnrolled = await this.checkEnrollment(senderId, recipientId);
    const messageContext = isEnrolled ? 'enrolled' : 'pre_enrollment';

    // 1. If pre-enrollment and sender is student, validate inquiry topic
    if (messageContext === 'pre_enrollment' && isSenderStudent) {
      const topicCheck = isPreEnrollmentTopicAllowed(content);
      if (!topicCheck.isAllowed) {
        throw new Error(topicCheck.reason || 'Message not allowed before enrolling');
      }
    }

    // 2. Strict Content Filter (Profanity, Tamil/Sinhala slurs, Hug/Kiss/Romantic emojis)
    const filterResult = filterContent(content);

    if (!filterResult.isClean) {
      const detectedIssues = [
        ...filterResult.abusiveWordsFound.map((w) => `word: "${w}"`),
        ...filterResult.blockedEmojisFound.map((e) => `emoji: "${e}"`),
      ].join(', ');

      await prisma.abuseFlagLog.create({
        data: {
          userId: senderId,
          detectedWords: detectedIssues,
          createdAt: new Date(),
        },
      });

      const admins = await prisma.user.findMany({
        where: {
          userRoles: {
            some: {
              role: {
                name: { in: ['SuperAdmin', 'Admin', 'superadmin', 'admin'] },
              },
            },
          },
          deletedAt: null,
        },
        select: { id: true },
      });

      const senderFullName = `${sender.firstName} ${sender.lastName}`.trim();
      const warningTitle = '⚠️ Inappropriate Message Blocked';
      const warningBody = `User ${senderFullName} (${senderId}) attempted to send prohibited content (${detectedIssues}) to recipient ${recipient.firstName} ${recipient.lastName}.`;

      for (const admin of admins) {
        try {
          await NotificationService.createNotification(
            admin.id,
            'SYSTEM',
            warningTitle,
            warningBody,
            senderId,
            'abuse_flag'
          );
        } catch (err) {
          console.error('Failed to notify admin of abuse flag:', err);
        }
      }

      throw new Error(
        'Message blocked by safety filters: Contains prohibited language or romantic/hug/kiss emojis. Strictly polite and respectful communication is required.'
      );
    }

    // 3. Save clean message
    const message = await prisma.directMessage.create({
      data: {
        senderId,
        recipientId,
        content: content.trim(),
        isFiltered: false,
        messageContext,
        isRead: false,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        recipient: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    // 4. Notify recipient
    try {
      const senderFullName = `${sender.firstName} ${sender.lastName}`.trim();
      await NotificationService.createNotification(
        recipientId,
        'MESSAGE',
        `New Message from ${senderFullName}`,
        content.length > 80 ? content.slice(0, 77) + '...' : content,
        message.id,
        'direct_message'
      );
    } catch (err) {
      console.warn('Failed to send notification to recipient:', err);
    }

    return message;
  }

  /**
   * Get conversation thread between two users
   */
  static async getConversation(userId: string, partnerId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total, partnerUser, isEnrolled] = await Promise.all([
      prisma.directMessage.findMany({
        where: {
          OR: [
            { senderId: userId, recipientId: partnerId },
            { senderId: partnerId, recipientId: userId },
          ],
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),
      prisma.directMessage.count({
        where: {
          OR: [
            { senderId: userId, recipientId: partnerId },
            { senderId: partnerId, recipientId: userId },
          ],
          deletedAt: null,
        },
      }),
      (prisma.user.findUnique as any)({
        where: { id: partnerId },
        include: {
          userRoles: { include: { role: true } },
          teacher: {
            include: {
              teacherAssignments: {
                where: { deletedAt: null },
                include: { course: true },
              },
            },
          },
        },
      }),
      this.checkEnrollment(userId, partnerId),
    ]);

    const partner: any = partnerUser;
    if (!partner) {
      throw new Error('User not found');
    }

    const lastSeen = partner.teacher?.lastSeenAt;
    const isOnline = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000 : false;

    // Mark unread messages as read
    await prisma.directMessage.updateMany({
      where: {
        senderId: partnerId,
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      messages,
      pagination: { total, page, limit },
      isEnrolled,
      partner: {
        id: partner.id,
        firstName: partner.firstName,
        lastName: partner.lastName,
        avatarUrl: partner.avatarUrl,
        role: partner.userRoles?.[0]?.role?.name || 'User',
        teacher: partner.teacher
          ? {
              id: partner.teacher.id,
              specialization: partner.teacher.specialization,
              isOnline,
              lastSeenAt: partner.teacher.lastSeenAt,
              courses: (partner.teacher.teacherAssignments || []).map((a: any) => a.course).filter(Boolean),
            }
          : null,
      },
    };
  }

  /**
   * Get user's inbox list of conversations
   */
  static async getInbox(userId: string) {
    const sent = await prisma.directMessage.findMany({
      where: { senderId: userId, deletedAt: null },
      select: { recipientId: true },
      distinct: ['recipientId'],
    });

    const received = await prisma.directMessage.findMany({
      where: { recipientId: userId, deletedAt: null },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const partnerIds = Array.from(new Set([
      ...sent.map((s) => s.recipientId),
      ...received.map((r) => r.senderId),
    ]));

    const conversations = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const [lastMsg, unreadCount, partnerUser] = await Promise.all([
          prisma.directMessage.findFirst({
            where: {
              OR: [
                { senderId: userId, recipientId: partnerId },
                { senderId: partnerId, recipientId: userId },
              ],
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.directMessage.count({
            where: {
              senderId: partnerId,
              recipientId: userId,
              isRead: false,
              deletedAt: null,
            },
          }),
          (prisma.user.findUnique as any)({
            where: { id: partnerId },
            include: {
              userRoles: { include: { role: true } },
              teacher: true,
            },
          }),
        ]);

        const partner: any = partnerUser;
        if (!partner || !lastMsg) return null;

        const lastSeen = partner.teacher?.lastSeenAt;
        const isOnline = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000 : false;

        return {
          partnerId,
          partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
          partnerAvatar: partner.avatarUrl,
          partnerRole: partner.userRoles?.[0]?.role?.name || 'User',
          specialization: partner.teacher?.specialization || null,
          isOnline,
          lastMessage: lastMsg.content,
          lastMessageAt: lastMsg.createdAt,
          lastMessageSenderId: lastMsg.senderId,
          unreadCount,
        };
      })
    );

    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  /**
   * Mark messages as read
   */
  static async markRead(userId: string, partnerId: string) {
    const updated = await prisma.directMessage.updateMany({
      where: {
        senderId: partnerId,
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return { count: updated.count };
  }
}
