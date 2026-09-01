"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentIdCardController = void 0;
const client_1 = require("../../../db/prisma/client");
const api_response_1 = require("../../../utils/api-response");
const supabase_1 = require("../../../lib/supabase");
const crypto_1 = require("crypto");
/**
 * Generate a short unique ID like "TZTSTU-XXXXXX" (6 hex chars)
 */
function generateUniqueId() {
    const randomChars = (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase();
    return `TZTSTU-${randomChars}`;
}
class StudentIdCardController {
    /**
     * GET /students/:id/id-card — Fetch all data needed for a printable student ID card.
     * If no uniqueId exists yet, one is generated and persisted.
     */
    static async getStudentIdCard(req, res, next) {
        try {
            const { id } = req.params;
            const student = await client_1.prisma.student.findUnique({
                where: { id },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                    batch: { select: { name: true } },
                    department: { select: { name: true } },
                },
            });
            if (!student)
                return (0, api_response_1.sendError)(res, 'Student not found', 404);
            // Ensure uniqueId exists
            let uniqueId = student.uniqueId;
            if (!uniqueId) {
                // Generate and persist
                uniqueId = generateUniqueId();
                // Check for collision (extremely unlikely)
                let collision = await client_1.prisma.student.findUnique({ where: { uniqueId } });
                while (collision) {
                    uniqueId = generateUniqueId();
                    collision = await client_1.prisma.student.findUnique({ where: { uniqueId } });
                }
                await client_1.prisma.student.update({ where: { id }, data: { uniqueId, idCardIssuedAt: new Date() } });
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
            return (0, api_response_1.sendSuccess)(res, idCardData, 'Student ID card data retrieved successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * PATCH /students/:id/id-info — Update DOB, NIC, and optionally photo for a student's ID card.
     */
    static async updateStudentIdInfo(req, res, next) {
        try {
            const { id } = req.params;
            const { dateOfBirth, nicOrPassport, fileName, mimeType, fileData } = req.body;
            const student = await client_1.prisma.student.findUnique({ where: { id }, select: { id: true, userId: true } });
            if (!student)
                return (0, api_response_1.sendError)(res, 'Student not found', 404);
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
                const path = `students/${id}/id-photo-${Date.now()}-${cleanFileName}`;
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
                // Also update the user's avatarUrl as a fallback
                await client_1.prisma.user.update({ where: { id: student.userId }, data: { avatarUrl: publicUrlData.publicUrl } });
            }
            if (Object.keys(updateData).length === 0) {
                return (0, api_response_1.sendError)(res, 'No fields to update', 400);
            }
            const updated = await client_1.prisma.student.update({
                where: { id },
                data: updateData,
                include: {
                    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                },
            });
            return (0, api_response_1.sendSuccess)(res, updated, 'Student ID information updated successfully', 200);
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /students/:id/issue-id-card — Mark the ID card as officially issued (stamps idCardIssuedAt).
     */
    static async issueStudentIdCard(req, res, next) {
        try {
            const { id } = req.params;
            const student = await client_1.prisma.student.findUnique({ where: { id } });
            if (!student)
                return (0, api_response_1.sendError)(res, 'Student not found', 404);
            const updated = await client_1.prisma.student.update({
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
exports.StudentIdCardController = StudentIdCardController;
