import { NextFunction, Request, Response } from 'express';
import { prisma } from '@/db/prisma/client';
import { sendError, sendSuccess } from '@/utils/api-response';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';

/**
 * Generate a short unique ID like "TCH-A1B2C3"
 */
function generateUniqueId(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${code}`;
}

export class TeacherIdCardController {
  /**
   * GET /teachers/:id/id-card — Fetch all data needed for a printable teacher ID card.
   * If no uniqueId exists yet, one is generated and persisted.
   */
  static async getTeacherIdCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const teacher = await prisma.teacher.findUnique({
        where: { id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      });

      if (!teacher) return sendError(res, 'Teacher not found', 404);

      // Ensure uniqueId exists
      let uniqueId = teacher.uniqueId;
      if (!uniqueId) {
        uniqueId = generateUniqueId('TCH');
        let collision = await prisma.teacher.findUnique({ where: { uniqueId } });
        while (collision) {
          uniqueId = generateUniqueId('TCH');
          collision = await prisma.teacher.findUnique({ where: { uniqueId } });
        }
        await prisma.teacher.update({ where: { id }, data: { uniqueId } });
      }

      const qrPayload = JSON.stringify({
        type: 'teacher',
        id: uniqueId,
        v: teacher.qrCodeVersion,
      });

      const idCardData = {
        type: 'teacher',
        uniqueId,
        employeeId: teacher.employeeId,
        firstName: teacher.user.firstName,
        lastName: teacher.user.lastName,
        email: teacher.user.email,
        dateOfBirth: teacher.dateOfBirth,
        nicOrPassport: teacher.nicOrPassport,
        photoUrl: teacher.photoUrl || teacher.user.avatarUrl || null,
        specialization: teacher.specialization,
        dateOfJoining: teacher.dateOfJoining,
        qrPayload,
        qrCodeVersion: teacher.qrCodeVersion,
        idCardIssuedAt: teacher.idCardIssuedAt,
      };

      return sendSuccess(res, idCardData, 'Teacher ID card data retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /teachers/:id/id-info — Update DOB, NIC, and optionally photo for a teacher's ID card.
   */
  static async updateTeacherIdInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { dateOfBirth, nicOrPassport, fileName, mimeType, fileData } = req.body;

      const teacher = await prisma.teacher.findUnique({ where: { id }, select: { id: true, userId: true } });
      if (!teacher) return sendError(res, 'Teacher not found', 404);

      const updateData: any = {};

      if (dateOfBirth !== undefined) {
        updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      }
      if (nicOrPassport !== undefined) {
        updateData.nicOrPassport = nicOrPassport || null;
      }

      // Handle photo upload if provided
      if (fileName && mimeType && fileData) {
        const bucket = 'avatars';
        const cleanFileName = fileName.replace(/\s+/g, '-').toLowerCase();
        const path = `teachers/${id}/id-photo-${Date.now()}-${cleanFileName}`;
        const fileBuffer = Buffer.from(fileData, 'base64');

        const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false,
        });

        if (error || !data) return sendError(res, error?.message || 'Failed to upload photo', 400);

        const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
        updateData.photoUrl = publicUrlData.publicUrl;

        // Also update the user's avatarUrl
        await prisma.user.update({ where: { id: teacher.userId }, data: { avatarUrl: publicUrlData.publicUrl } });
      }

      if (Object.keys(updateData).length === 0) {
        return sendError(res, 'No fields to update', 400);
      }

      const updated = await prisma.teacher.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      });

      return sendSuccess(res, updated, 'Teacher ID information updated successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /teachers/:id/issue-id-card — Mark the ID card as officially issued.
   */
  static async issueTeacherIdCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const teacher = await prisma.teacher.findUnique({ where: { id } });
      if (!teacher) return sendError(res, 'Teacher not found', 404);

      const updated = await prisma.teacher.update({
        where: { id },
        data: { idCardIssuedAt: new Date() },
      });

      return sendSuccess(res, { idCardIssuedAt: updated.idCardIssuedAt }, 'ID card issued successfully', 200);
    } catch (error) {
      return next(error);
    }
  }
}
