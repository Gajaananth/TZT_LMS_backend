import { NextFunction, Request, Response } from 'express';
import { prisma } from '@/db/prisma/client';
import { sendError, sendSuccess } from '@/utils/api-response';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';

/**
 * Generate a short unique ID like "TZTSTU-XXXXXX" (6 hex chars)
 */
function generateUniqueId(): string {
  const randomChars = randomBytes(3).toString('hex').toUpperCase();
  return `TZTSTU-${randomChars}`;
}

export class StudentIdCardController {
  /**
   * GET /students/:id/id-card — Fetch all data needed for a printable student ID card.
   * If no uniqueId exists yet, one is generated and persisted.
   */
  static async getStudentIdCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const student = await prisma.student.findUnique({
        where: { id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          batch: { select: { name: true } },
          department: { select: { name: true } },
        },
      });

      if (!student) return sendError(res, 'Student not found', 404);

      // Ensure uniqueId exists
      let uniqueId = student.uniqueId;
      if (!uniqueId) {
        // Generate and persist
        uniqueId = generateUniqueId();
        // Check for collision (extremely unlikely)
        let collision = await prisma.student.findUnique({ where: { uniqueId } });
        while (collision) {
          uniqueId = generateUniqueId();
          collision = await prisma.student.findUnique({ where: { uniqueId } });
        }
        await prisma.student.update({ where: { id }, data: { uniqueId, idCardIssuedAt: new Date() } });
      }

      const qrPayload = JSON.stringify({
        type: 'student',
        id: uniqueId,
        v: student.qrCodeVersion,
      });

      const idCardData = {
        type: 'student',
        uniqueId,
        studentId: student.studentId,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        dateOfBirth: student.dateOfBirth,
        nicOrPassport: student.nicOrPassport,
        photoUrl: student.photoUrl || student.user.avatarUrl || null,
        batchName: student.batch?.name || null,
        departmentName: student.department?.name || null,
        gender: student.gender,
        qrPayload,
        qrCodeVersion: student.qrCodeVersion,
        idCardIssuedAt: student.idCardIssuedAt,
      };

      return sendSuccess(res, idCardData, 'Student ID card data retrieved successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /students/:id/id-info — Update DOB, NIC, and optionally photo for a student's ID card.
   */
  static async updateStudentIdInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { dateOfBirth, nicOrPassport, fileName, mimeType, fileData } = req.body;

      const student = await prisma.student.findUnique({ where: { id }, select: { id: true, userId: true } });
      if (!student) return sendError(res, 'Student not found', 404);

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
        const path = `students/${id}/id-photo-${Date.now()}-${cleanFileName}`;
        const fileBuffer = Buffer.from(fileData, 'base64');

        const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false,
        });

        if (error || !data) return sendError(res, error?.message || 'Failed to upload photo', 400);

        const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
        updateData.photoUrl = publicUrlData.publicUrl;

        // Also update the user's avatarUrl as a fallback
        await prisma.user.update({ where: { id: student.userId }, data: { avatarUrl: publicUrlData.publicUrl } });
      }

      if (Object.keys(updateData).length === 0) {
        return sendError(res, 'No fields to update', 400);
      }

      const updated = await prisma.student.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      });

      return sendSuccess(res, updated, 'Student ID information updated successfully', 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /students/:id/issue-id-card — Mark the ID card as officially issued (stamps idCardIssuedAt).
   */
  static async issueStudentIdCard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const student = await prisma.student.findUnique({ where: { id } });
      if (!student) return sendError(res, 'Student not found', 404);

      const updated = await prisma.student.update({
        where: { id },
        data: { idCardIssuedAt: new Date() },
      });

      return sendSuccess(res, { idCardIssuedAt: updated.idCardIssuedAt }, 'ID card issued successfully', 200);
    } catch (error) {
      return next(error);
    }
  }
}
