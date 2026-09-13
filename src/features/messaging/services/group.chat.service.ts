import { prisma } from '@/db/prisma/client';
import { Prisma } from '@prisma/client';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService } from '@/features/notifications/services/notification.service';

export const LINK_DETECTION_REGEX =
  /(?:https?:\/\/|ftp:\/\/|www\.)[^\s/$.?#].[^\s]*|(?:\b[a-zA-Z0-9-]+\.(?:com|org|net|io|edu|gov|xyz|app|dev|me|info|biz|site|online|tech|ai|co|tv|cc|ly|link)\b)/i;

export const VIDEO_MIME_OR_EXT_REGEX =
  /^(?:video\/)|(?:\.(?:mp4|mov|avi|mkv|flv|wmv|3gp|m4v|webm)$)/i;

export class GroupChatService {
  /**
   * Broadcast an event to all group members via Supabase Realtime
   */
  static async broadcastGroupEvent(groupId: string, event: string, payload: any) {
    try {
      const channel = supabaseAdmin.channel(`study_group:${groupId}`);
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    } catch (err: any) {
      console.warn(`Realtime broadcast failed for group ${groupId} event ${event}:`, err?.message || err);
    }
  }

  /**
   * Teacher creates a new subject study group (max 20 students)
   */
  static async createGroup(
    teacherId: string,
    data: { name: string; subject: string; studentIds?: string[] },
  ) {
    if (!data.name?.trim()) throw new Error('Group name is required');
    if (!data.subject?.trim()) throw new Error('Subject name is required');

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!teacher) throw new Error('Teacher not found');

    const roles = teacher.userRoles.map((ur) => ur.role.name.toLowerCase());
    const isTeacher = roles.includes('teacher') || roles.includes('admin') || roles.includes('superadmin');
    if (!isTeacher) {
      throw new Error('Only teachers or administrators can create study groups');
    }

    const studentIds = Array.from(new Set(data.studentIds || [])).filter((id) => id !== teacherId);
    if (studentIds.length > 20) {
      throw new Error('A study group can have a maximum of 20 students');
    }

    const group = await prisma.subjectChatGroup.create({
      data: {
        name: data.name.trim(),
        subject: data.subject.trim(),
        teacherId,
        maxStudents: 20,
        members: {
          create: [
            { userId: teacherId, role: 'TEACHER' },
            ...studentIds.map((sId) => ({ userId: sId, role: 'STUDENT' })),
          ],
        },
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
          },
        },
      },
    });

    return group;
  }

  /**
   * List all study groups for a user
   */
  static async listUserGroups(userId: string) {
    const groups = await prisma.subjectChatGroup.findMany({
      where: {
        deletedAt: null,
        OR: [
          { teacherId: userId },
          { members: { some: { userId, leftAt: null } } },
        ],
      },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        leader: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        members: {
          where: { leftAt: null },
          select: {
            id: true,
            userId: true,
            role: true,
            isMuted: true,
            mutedUntil: true,
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return groups.map((g) => ({
      ...g,
      studentCount: g.members.filter((m) => m.role !== 'TEACHER').length,
    }));
  }

  /**
   * Get single group details with verified membership
   */
  static async getGroupDetails(groupId: string, userId: string) {
    const group = await prisma.subjectChatGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        leader: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        members: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
          },
        },
      },
    });

    if (!group) throw new Error('Study group not found');

    const userMembership = group.members.find((m) => m.userId === userId);
    if (!userMembership && group.teacherId !== userId) {
      throw new Error('You are not a member of this study group');
    }

    return {
      group,
      userMembership,
      isTeacher: group.teacherId === userId,
      isLeader: group.leaderId === userId,
    };
  }

  /**
   * Teacher appoints or changes the Group Leader
   */
  static async setLeader(groupId: string, teacherId: string, leaderStudentId: string) {
    const group = await prisma.subjectChatGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group || group.deletedAt) throw new Error('Group not found');
    if (group.teacherId !== teacherId) throw new Error('Only the teacher can appoint a group leader');

    const targetMember = group.members.find((m) => m.userId === leaderStudentId && !m.leftAt);
    if (!targetMember) throw new Error('Selected student is not an active member of this group');
    if (targetMember.role === 'TEACHER' || leaderStudentId === teacherId) {
      throw new Error('Teacher cannot be appointed as student group leader');
    }

    // Demote any existing leader to STUDENT
    await prisma.chatGroupMember.updateMany({
      where: { groupId, role: 'LEADER' },
      data: { role: 'STUDENT' },
    });

    // Promote new leader
    await prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId: leaderStudentId } },
      data: { role: 'LEADER' },
    });

    // Update group record
    await prisma.subjectChatGroup.update({
      where: { id: groupId },
      data: { leaderId: leaderStudentId },
    });

    // Notify student
    await NotificationService.createNotification(
      leaderStudentId,
      'GROUP_LEADER_ASSIGNED',
      '👑 Appointed as Group Leader',
      `You have been appointed as the Group Leader for ${group.name}. You can manage 15-minute mutes and flag sensitive content.`,
      groupId,
      'SubjectChatGroup',
    );

    // Broadcast to realtime channel
    await this.broadcastGroupEvent(groupId, 'leader_updated', {
      leaderId: leaderStudentId,
      groupId,
    });

    return { success: true, leaderId: leaderStudentId };
  }

  /**
   * Teacher adds a student to the group (strictly max 20 students)
   */
  static async addMember(groupId: string, teacherId: string, studentId: string) {
    const group = await prisma.subjectChatGroup.findUnique({
      where: { id: groupId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!group || group.deletedAt) throw new Error('Group not found');
    if (group.teacherId !== teacherId) throw new Error('Only the teacher can add students');

    const currentStudents = group.members.filter((m) => m.role !== 'TEACHER');
    if (currentStudents.length >= 20) {
      throw new Error('Group is full. A study group can have a maximum of 20 students.');
    }

    const existing = group.members.find((m) => m.userId === studentId);
    if (existing) {
      throw new Error('Student is already a member of this group');
    }

    const newMember = await prisma.chatGroupMember.upsert({
      where: { groupId_userId: { groupId, userId: studentId } },
      create: { groupId, userId: studentId, role: 'STUDENT' },
      update: { leftAt: null, role: 'STUDENT', isMuted: false, mutedUntil: null },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await this.broadcastGroupEvent(groupId, 'member_joined', { member: newMember });
    return newMember;
  }

  /**
   * Teacher removes a student from the group
   */
  static async removeMember(groupId: string, teacherId: string, targetUserId: string) {
    const group = await prisma.subjectChatGroup.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) throw new Error('Group not found');
    if (group.teacherId !== teacherId) throw new Error('Only the teacher can remove members');
    if (targetUserId === teacherId) throw new Error('Teacher cannot be removed from the group');

    if (group.leaderId === targetUserId) {
      await prisma.subjectChatGroup.update({
        where: { id: groupId },
        data: { leaderId: null },
      });
    }

    await prisma.chatGroupMember.updateMany({
      where: { groupId, userId: targetUserId },
      data: { leftAt: new Date() },
    });

    await this.broadcastGroupEvent(groupId, 'member_removed', { userId: targetUserId, groupId });
    return { success: true };
  }

  /**
   * Mute a student in the group
   * - Teacher can mute for any duration
   * - Group Leader can ONLY mute for strictly 15 minutes!
   */
  static async muteMember(
    groupId: string,
    actorId: string,
    targetUserId: string,
    minutes = 15,
    reason?: string,
  ) {
    const group = await prisma.subjectChatGroup.findUnique({
      where: { id: groupId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!group || group.deletedAt) throw new Error('Group not found');

    const actor = group.members.find((m) => m.userId === actorId);
    if (!actor) throw new Error('Actor is not a member of this group');

    if (targetUserId === group.teacherId) {
      throw new Error('The teacher cannot be muted');
    }

    const isTeacher = group.teacherId === actorId || actor.role === 'TEACHER';
    const isLeader = group.leaderId === actorId || actor.role === 'LEADER';

    if (!isTeacher && !isLeader) {
      throw new Error('Only the teacher or group leader has permission to mute students');
    }

    // Leader restrictions: strictly 15 minutes
    let muteDuration = minutes;
    if (isLeader && !isTeacher) {
      if (targetUserId === actorId) throw new Error('You cannot mute yourself');
      muteDuration = 15; // Strictly enforced
    }

    const mutedUntil = new Date(Date.now() + muteDuration * 60 * 1000);
    const mutedReason = reason || (isLeader ? 'Muted by Group Leader (15 mins)' : 'Muted by Teacher');

    const updated = await prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: {
        isMuted: true,
        mutedUntil,
        mutedReason,
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    await this.broadcastGroupEvent(groupId, 'member_muted', {
      targetUserId,
      mutedUntil,
      mutedReason,
      mutedBy: actorId,
      actorRole: isTeacher ? 'TEACHER' : 'LEADER',
    });

    return { success: true, mutedUntil, member: updated };
  }

  /**
   * Teacher un-mutes a student
   */
  static async unmuteMember(groupId: string, actorId: string, targetUserId: string) {
    const group = await prisma.subjectChatGroup.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) throw new Error('Group not found');

    if (group.teacherId !== actorId) {
      throw new Error('Only the teacher can unmute members early');
    }

    await prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: {
        isMuted: false,
        mutedUntil: null,
        mutedReason: null,
      },
    });

    await this.broadcastGroupEvent(groupId, 'member_unmuted', { targetUserId, groupId });
    return { success: true };
  }

  /**
   * Group Leader flags a message as irrelevant / sensitive:
   * - Marks message as flagged
   * - Informs teacher via priority notification
   * - Mutes the offending student for strictly 15 minutes
   */
  static async flagMessage(groupId: string, leaderId: string, messageId: string, reason: string) {
    const group = await prisma.subjectChatGroup.findUnique({
      where: { id: groupId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!group || group.deletedAt) throw new Error('Group not found');

    const actor = group.members.find((m) => m.userId === leaderId);
    const isTeacher = group.teacherId === leaderId;
    const isLeader = group.leaderId === leaderId || actor?.role === 'LEADER';

    if (!isTeacher && !isLeader) {
      throw new Error('Only the Group Leader or Teacher can flag inappropriate or irrelevant messages');
    }

    const message = await prisma.groupChatMessage.findUnique({
      where: { id: messageId },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!message || message.groupId !== groupId) throw new Error('Message not found');

    if (message.senderId === group.teacherId) {
      throw new Error('Teacher messages cannot be flagged');
    }

    const flagReason = reason?.trim() || 'Irrelevant or sensitive content';
    const flaggedAt = new Date();

    // 1. Mark message flagged
    const updatedMsg = await prisma.groupChatMessage.update({
      where: { id: messageId },
      data: {
        isFlagged: true,
        flagReason,
        flaggedBy: leaderId,
        flaggedAt,
      },
    });

    // 2. Mute offending student for strictly 15 minutes
    const mutedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId: message.senderId } },
      data: {
        isMuted: true,
        mutedUntil,
        mutedReason: `Flagged by Group Leader: ${flagReason}`,
      },
    });

    // 3. Inform the Teacher immediately
    const offenderName = `${message.sender.firstName} ${message.sender.lastName}`;
    await NotificationService.createNotification(
      group.teacherId,
      'STUDY_GROUP_FLAG_ALERT',
      '⚠️ Group Leader Flagged a Message',
      `Group Leader flagged a message as "${flagReason}" from ${offenderName} in "${group.name}". The student has been automatically muted for 15 minutes.`,
      messageId,
      'GroupChatMessage',
    );

    // 4. Broadcast to group in realtime
    await this.broadcastGroupEvent(groupId, 'message_flagged', {
      messageId,
      reason: flagReason,
      flaggedBy: leaderId,
      offenderId: message.senderId,
      mutedUntil,
    });

    return { success: true, message: updatedMsg, mutedUntil };
  }

  /**
   * Send a message in the group:
   * - Strict validation: NO links allowed!
   * - Strict validation: NO videos allowed!
   * - Allowed media: VOICE_NOTE, IMAGE, ZIP, DOCUMENT
   * - Zero server file storage: only metadata + ephemeral broadcast
   */
  static async sendMessage(
    groupId: string,
    senderId: string,
    data: {
      content?: string;
      mediaType?: 'NONE' | 'VOICE_NOTE' | 'IMAGE' | 'ZIP' | 'DOCUMENT';
      mediaMetadata?: {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        duration?: number;
        localFileId?: string;
      };
      ephemeralData?: string; // Optional client base64 string for realtime relay
    },
  ) {
    const group = await prisma.subjectChatGroup.findUnique({
      where: { id: groupId, deletedAt: null },
      include: { members: { where: { leftAt: null } } },
    });
    if (!group) throw new Error('Study group not found');

    const member = group.members.find((m) => m.userId === senderId);
    if (!member) throw new Error('You are not a member of this study group');

    // Check mute status
    if (member.isMuted) {
      if (member.mutedUntil && member.mutedUntil > new Date()) {
        const remainingMinutes = Math.ceil((member.mutedUntil.getTime() - Date.now()) / (60 * 1000));
        throw new Error(`You are currently muted for ${remainingMinutes} more minute(s). You cannot send messages.`);
      } else {
        // Mute expired, auto-unmute
        await prisma.chatGroupMember.update({
          where: { groupId_userId: { groupId, userId: senderId } },
          data: { isMuted: false, mutedUntil: null, mutedReason: null },
        });
      }
    }

    const content = (data.content || '').trim();
    const mediaType = data.mediaType || 'NONE';

    // 1. STRICT LINK BLOCKING
    if (content && LINK_DETECTION_REGEX.test(content)) {
      throw new Error('Sharing links or URLs is strictly prohibited in subject study groups.');
    }

    // 2. STRICT VIDEO BLOCKING
    if (
      mediaType === ('VIDEO' as any) ||
      (data.mediaMetadata?.mimeType && VIDEO_MIME_OR_EXT_REGEX.test(data.mediaMetadata.mimeType)) ||
      (data.mediaMetadata?.fileName && VIDEO_MIME_OR_EXT_REGEX.test(data.mediaMetadata.fileName))
    ) {
      throw new Error('Videos are not permitted in study groups. Only voice notes, images, zip files, and documents are allowed.');
    }

    if (!content && mediaType === 'NONE') {
      throw new Error('Message cannot be empty');
    }

    // 3. Create message record (server stores ZERO file data, only metadata)
    const msg = await prisma.groupChatMessage.create({
      data: {
        groupId,
        senderId,
        content,
        mediaType,
        mediaMetadata: (data.mediaMetadata as any) || Prisma.JsonNull,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // 4. Broadcast message + ephemeral data in realtime to all online group members
    await this.broadcastGroupEvent(groupId, 'new_group_message', {
      ...msg,
      ephemeralData: data.ephemeralData || null,
    });

    return msg;
  }

  /**
   * Delete message / revoke file:
   * - Teacher can delete any message
   * - Students can delete their own message
   * - Broadcasts immediate purge instruction so all clients wipe the file from device storage
   */
  static async deleteMessage(groupId: string, actorId: string, messageId: string) {
    const group = await prisma.subjectChatGroup.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) throw new Error('Group not found');

    const message = await prisma.groupChatMessage.findUnique({ where: { id: messageId } });
    if (!message || message.groupId !== groupId) throw new Error('Message not found');

    const isTeacher = group.teacherId === actorId;
    const isSender = message.senderId === actorId;

    if (!isTeacher && !isSender) {
      throw new Error('You do not have permission to delete this message');
    }

    // Mark as deleted and purge metadata
    await prisma.groupChatMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedBy: actorId,
        deletedAt: new Date(),
        content: 'This message was deleted by sender. File data purged.',
        mediaMetadata: Prisma.JsonNull,
      },
    });

    // Broadcast file revocation & deletion event to all group members
    await this.broadcastGroupEvent(groupId, 'group_message_deleted', {
      messageId,
      groupId,
      deletedBy: actorId,
    });

    return { success: true, messageId };
  }

  /**
   * Get group messages history with pagination
   */
  static async getGroupMessages(groupId: string, userId: string, page = 1, limit = 50) {
    const group = await prisma.subjectChatGroup.findUnique({
      where: { id: groupId, deletedAt: null },
      include: { members: { where: { leftAt: null } } },
    });
    if (!group) throw new Error('Study group not found');

    const isMember = group.members.some((m) => m.userId === userId) || group.teacherId === userId;
    if (!isMember) throw new Error('You are not a member of this study group');

    const skip = (page - 1) * limit;
    const messages = await prisma.groupChatMessage.findMany({
      where: { groupId },
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const total = await prisma.groupChatMessage.count({ where: { groupId } });

    return {
      messages: messages.map((m) => {
        if (m.isDeleted) {
          return {
            ...m,
            content: 'This message was deleted by sender. File data purged.',
            mediaType: 'NONE',
            mediaMetadata: null,
          };
        }
        return m;
      }),
      pagination: { total, page, limit },
    };
  }
}
export default GroupChatService;
