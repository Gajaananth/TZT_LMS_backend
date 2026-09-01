import { prisma } from '@/db/prisma/client';
import { randomUUID } from 'crypto';

export class CertificateService {
  static async createTemplate(data: any, userId: string) {
    const tpl = await prisma.certificateTemplate.create({ data: { ...data, createdBy: userId } });
    return tpl;
  }

  static async listTemplates() {
    return prisma.certificateTemplate.findMany({ where: { deletedAt: null } });
  }

  static async generateCertificate(attemptId: string, userId: string) {
    // ensure attempt exists
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true, student: true } });
    if (!attempt) throw new Error('Attempt not found');

    const verificationCode = randomUUID();

    // minimal certificate generation: create DB record and fake fileUrl (PDF generation to be integrated)
    const cert = await prisma.certificate.create({
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

    await prisma.generatedReport.create({ data: { templateId: '', parameters: {}, fileUrl, generatedAt: new Date() } }).catch(() => null);

    await prisma.verificationLog.create({ data: { certificateId: cert.id, verifiedBy: userId, isValid: true, verifiedAt: new Date() } }).catch(() => null);

    return { cert, fileUrl };
  }

  static async verifyCertificate(code: string) {
    const cert = await prisma.certificate.findFirst({ where: { verificationCode: code, deletedAt: null }, include: { student: true, exam: true } });
    return cert;
  }
}

export default CertificateService;
