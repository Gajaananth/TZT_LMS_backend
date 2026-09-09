"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateService = void 0;
const client_1 = require("../../../db/prisma/client");
const crypto_1 = require("crypto");
const deriveType = (cert) => {
    const t = [cert?.exam?.examType, cert?.exam?.title, cert?.templateId, ''].join(' ').toLowerCase();
    if (/honor|merit|distinction|award/.test(t))
        return 'Honors';
    if (/achievement|award|excellence/.test(t))
        return 'Achievement';
    if (/certif|profession|tech/.test(t))
        return 'Certification';
    if (/enroll|admiss|joining/.test(t))
        return 'Enrollment';
    return 'Completion';
};
const deriveTitle = (cert) => {
    if (cert?.exam?.title) {
        const examTitle = cert.exam.title;
        if (/exam|quiz|mid|final|test/i.test(examTitle)) {
            return cert?.course?.title ? `Course Completion: ${cert.course.title}` : 'Course Completion Certificate';
        }
        return examTitle;
    }
    if (cert?.course?.title)
        return `Certificate — ${cert.course.title}`;
    if (cert?.templateId)
        return `Award Certificate`;
    return 'Certificate of Achievement';
};
const getUserRoles = async (userId) => {
    const u = await client_1.prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
    });
    return u?.userRoles.map((ur) => ur.role.name) || [];
};
class CertificateService {
    static async createTemplate(data, userId) {
        const tpl = await client_1.prisma.certificateTemplate.create({ data: { ...data, createdBy: userId } });
        return tpl;
    }
    static async listTemplates() {
        return client_1.prisma.certificateTemplate.findMany({ where: { deletedAt: null } });
    }
    static async listCertificates(userId, options = {}) {
        const page = Math.max(1, Number(options.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
        const skip = (page - 1) * limit;
        const roles = await getUserRoles(userId);
        const isAdmin = roles.some((r) => r === 'SuperAdmin' || r === 'Admin');
        const isTeacher = roles.includes('Teacher');
        const isStudent = roles.includes('Student');
        const where = { deletedAt: null };
        if (isStudent) {
            where.student = { userId };
        }
        else if (isTeacher && !isAdmin) {
            where.OR = [
                { issuedBy: userId },
                { exam: { createdBy: userId } },
                { course: { teacherCourses: { some: { teacher: { userId } } } } },
            ];
        }
        const [total, rows] = await Promise.all([
            client_1.prisma.certificate.count({ where }),
            client_1.prisma.certificate.findMany({
                where,
                take: limit,
                skip,
                orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
                include: {
                    student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
                    course: { select: { id: true, title: true, code: true } },
                    exam: { select: { id: true, title: true } },
                },
            }),
        ]);
        const certificates = rows.map((c) => ({
            id: c.id,
            certificateNumber: c.certificateNumber,
            title: deriveTitle(c),
            type: deriveType(c),
            status: c.revokedAt ? 'Draft' : c.issuedAt ? 'Issued' : 'Pending',
            issuedAt: c.issuedAt,
            verificationCode: c.verificationCode,
            href: `/certificates/verify/${c.verificationCode || c.id}`,
            student: c.student
                ? {
                    id: c.student.id,
                    user: c.student.user || null,
                }
                : null,
            course: c.course
                ? {
                    id: c.course.id,
                    title: c.course.title,
                    code: c.course.code,
                }
                : null,
            exam: c.exam
                ? {
                    id: c.exam.id,
                    title: c.exam.title,
                }
                : null,
        }));
        return { certificates, total, page, limit };
    }
    static async generateCertificate(attemptId, userId) {
        const attempt = await client_1.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true, student: true } });
        if (!attempt)
            throw new Error('Attempt not found');
        const defaultTemplate = await client_1.prisma.certificateTemplate.upsert({
            where: { name: 'Default Certificate' },
            create: {
                name: 'Default Certificate',
                description: 'Default system certificate template',
                templateUrl: 'default',
                isActive: true,
                createdBy: userId,
            },
            update: {},
            select: { id: true },
        });
        const defaultReportTemplate = await client_1.prisma.reportTemplate.upsert({
            where: { id: 'default-cert-report' },
            create: {
                id: 'default-cert-report',
                name: 'Default Certificate Report',
                reportType: 'CUSTOM',
                configuration: {},
                createdBy: userId,
            },
            update: {},
            select: { id: true },
        });
        const verificationCode = (0, crypto_1.randomUUID)();
        const cert = await client_1.prisma.certificate.create({
            data: {
                certificateNumber: `CERT-${Date.now()}`,
                studentId: attempt.studentId,
                courseId: attempt.exam.courseId,
                examId: attempt.examId,
                issuedAt: new Date(),
                issuedBy: userId,
                templateId: defaultTemplate.id,
                verificationCode,
            },
        });
        const fileUrl = `https://storage.example.com/certificates/${cert.id}.pdf`;
        await client_1.prisma.generatedReport.create({
            data: { templateId: defaultReportTemplate.id, parameters: {}, fileUrl, generatedAt: new Date() },
        }).catch(() => null);
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
