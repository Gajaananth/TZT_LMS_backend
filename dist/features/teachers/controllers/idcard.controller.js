"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherIdCardController = void 0;
const client_1 = require("../../../db/prisma/client");
const api_response_1 = require("../../../utils/api-response");
const supabase_1 = require("../../../lib/supabase");
const crypto_1 = require("crypto");
/**
 * Generate a short unique ID like "TCH-A1B2C3"
 */
function generateUniqueId(prefix) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = (0, crypto_1.randomBytes)(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return `${prefix}-${code}`;
}
class TeacherIdCardController {
    /**
     * GET /teachers/:id/id-card — Fetch all data needed for a printable teacher ID card.
     * If no uniqueId exists yet, one is generated and persisted.
     */
    static async getTeacherIdCard(req, res, next) {
        try {
            const { id } = req.params;
            const teacher = await client_1.prisma.teacher.findUnique({
                where: { id },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                },
            });
            if (!teacher)
                return (0, api_response_1.sendError)(res, 'Teacher not found', 404);
            // Ensure uniqueId exists
            let uniqueId = teacher.uniqueId;
            if (!uniqueId) {
                uniqueId = generateUniqueId('TCH');
                let collision = await client_1.prisma.teacher.findUnique({ where: { uniqueId } });
                while (collision) {
                    uniqueId = generateUniqueId('TCH');
                    collision = await client_1.prisma.teacher.findUnique({ where: { uniqueId } });
                }
                await client_1.prisma.teacher.update({ where: { id }, data: { uniqueId } });
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
            return (0, api_response_1.sendSuccess)(res, idCardData, 'Teacher ID card data retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * PATCH /teachers/:id/id-info — Update DOB, NIC, and optionally photo for a teacher's ID card.
     */
    static async updateTeacherIdInfo(req, res, next) {
        try {
            const { id } = req.params;
            const { dateOfBirth, nicOrPassport, fileName, mimeType, fileData } = req.body;
            const teacher = await client_1.prisma.teacher.findUnique({ where: { id }, select: { id: true, userId: true } });
            if (!teacher)
                return (0, api_response_1.sendError)(res, 'Teacher not found', 404);
            const updateData = {};
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
                const { data, error } = await supabase_1.supabaseAdmin.storage.from(bucket).upload(path, fileBuffer, {
                    contentType: mimeType,
                    cacheControl: '3600',
                    upsert: false,
                });
                if (error || !data)
                    return (0, api_response_1.sendError)(res, error?.message || 'Failed to upload photo', 400);
                const { data: publicUrlData } = supabase_1.supabaseAdmin.storage.from(bucket).getPublicUrl(path);
                updateData.photoUrl = publicUrlData.publicUrl;
                // Also update the user's avatarUrl
                await client_1.prisma.user.update({ where: { id: teacher.userId }, data: { avatarUrl: publicUrlData.publicUrl } });
            }
            if (Object.keys(updateData).length === 0) {
                return (0, api_response_1.sendError)(res, 'No fields to update', 400);
            }
            const updated = await client_1.prisma.teacher.update({
                where: { id },
                data: updateData,
                include: {
                    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                },
            });
            return (0, api_response_1.sendSuccess)(res, updated, 'Teacher ID information updated successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /teachers/:id/issue-id-card — Mark the ID card as officially issued.
     */
    static async issueTeacherIdCard(req, res, next) {
        try {
            const { id } = req.params;
            const teacher = await client_1.prisma.teacher.findUnique({ where: { id } });
            if (!teacher)
                return (0, api_response_1.sendError)(res, 'Teacher not found', 404);
            const updated = await client_1.prisma.teacher.update({
                where: { id },
                data: { idCardIssuedAt: new Date() },
            });
            return (0, api_response_1.sendSuccess)(res, { idCardIssuedAt: updated.idCardIssuedAt }, 'ID card issued successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.TeacherIdCardController = TeacherIdCardController;
