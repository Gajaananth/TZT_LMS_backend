"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateService = void 0;
const client_1 = require("../../../db/prisma/client");
const crypto_1 = require("crypto");
class CertificateService {
    static async createTemplate(data, userId) {
        const tpl = await client_1.prisma.certificateTemplate.create({ data: { ...data, createdBy: userId } });
        return tpl;
    }
    static async listTemplates() {
        return client_1.prisma.certificateTemplate.findMany({ where: { deletedAt: null } });
    }
    static async generateCertificate(attemptId, userId) {
        // ensure attempt exists
        const attempt = await client_1.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true, student: true } });
        if (!attempt)
            throw new Error('Attempt not found');
        const verificationCode = (0, crypto_1.randomUUID)();
        // minimal certificate generation: create DB record and fake fileUrl (PDF generation to be integrated)
        const cert = await client_1.prisma.certificate.create({
            data: {
                certificateNumber: `CERT-${Date.now()}`,
                studentId: attempt.studentId,
                courseId: attempt.exam.courseId,
                examId: attempt.examId,
                issuedAt: new Date(),
                issuedBy: userId,
                templateId: '',
                verificationCode,
            },
        });
        // placeholder file URL (to be replaced by real PDF stored in Supabase)
        const fileUrl = `https://storage.example.com/certificates/${cert.id}.pdf`;
        await client_1.prisma.generatedReport.create({ data: { templateId: '', parameters: {}, fileUrl, generatedAt: new Date() } }).catch(() => null);
        await client_1.prisma.verificationLog.create({ data: { certificateId: cert.id, verifiedBy: userId, isValid: true, verifiedAt: new Date() } }).catch(() => null);
        return { cert, fileUrl };
    }
    static async verifyCertificate(code) {
        const cert = await client_1.prisma.certificate.findFirst({ where: { verificationCode: code, deletedAt: null }, include: { student: true, exam: true } });
        return cert;
    }
}
exports.CertificateService = CertificateService;
exports.default = CertificateService;
