import { prisma } from '@/db/prisma/client';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { uploadFile } from '@/lib/storage';

export interface CertificateWithDetails {
  id: string;
  certificateNumber: string | null;
  title: string;
  type: 'Completion' | 'Achievement' | 'Certification' | 'Enrollment' | 'Honors';
  status: 'Issued' | 'Pending' | 'Draft';
  issuedAt: Date | null;
  verificationCode: string | null;
  href: string;
  student?: {
    id: string;
    user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  } | null;
  course?: {
    id: string;
    title?: string | null;
    code?: string | null;
  } | null;
  exam?: {
    id: string;
    title?: string | null;
  } | null;
}

const deriveType = (cert: any): CertificateWithDetails['type'] => {
  const t = [cert?.exam?.examType, cert?.exam?.title, cert?.templateId, ''].join(' ').toLowerCase();
  if (/honor|merit|distinction|award/.test(t)) return 'Honors';
  if (/achievement|award|excellence/.test(t)) return 'Achievement';
  if (/certif|profession|tech/.test(t)) return 'Certification';
  if (/enroll|admiss|joining/.test(t)) return 'Enrollment';
  return 'Completion';
};

const deriveTitle = (cert: any): string => {
  if (cert?.exam?.title) {
    const examTitle = cert.exam.title;
    if (/exam|quiz|mid|final|test/i.test(examTitle)) {
      return cert?.course?.title ? `Course Completion: ${cert.course.title}` : 'Course Completion Certificate';
    }
    return examTitle;
  }
  if (cert?.course?.title) return `Certificate — ${cert.course.title}`;
  if (cert?.templateId) return `Award Certificate`;
  return 'Certificate of Achievement';
};

const getUserRoles = async (userId: string): Promise<string[]> => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });
  return u?.userRoles.map((ur) => ur.role.name) || [];
};

export class CertificateService {
  static async createTemplate(data: any, userId: string) {
    const tpl = await prisma.certificateTemplate.create({ data: { ...data, createdBy: userId } });
    return tpl;
  }

  static async listTemplates() {
    return prisma.certificateTemplate.findMany({ where: { deletedAt: null } });
  }

  static async listCertificates(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ certificates: CertificateWithDetails[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    const roles = await getUserRoles(userId);
    const isAdmin = roles.some((r) => r === 'SuperAdmin' || r === 'Admin');
    const isTeacher = roles.includes('Teacher');
    const isStudent = roles.includes('Student');

    const where: any = { deletedAt: null };
    if (isStudent) {
      where.student = { userId };
    } else if (isTeacher && !isAdmin) {
      where.OR = [
        { issuedBy: userId },
        { exam: { createdBy: userId } },
        { course: { teacherCourses: { some: { teacher: { userId } } } } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
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

    const certificates: CertificateWithDetails[] = rows.map((c: any) => ({
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

  static async generateCertificate(attemptId: string, userId: string) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { course: true } },
        student: { include: { user: true } },
      },
    });
    if (!attempt) throw new Error('Attempt not found');

    const defaultTemplate = await prisma.certificateTemplate.upsert({
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

    const defaultReportTemplate = await prisma.reportTemplate.upsert({
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

    const verificationCode = randomUUID();
    const certificateNumber = `CERT-${Date.now()}`;

    const cert = await prisma.certificate.create({
      data: {
        certificateNumber,
        studentId: attempt.studentId,
        courseId: attempt.exam?.courseId || null,
        examId: attempt.examId,
        issuedAt: new Date(),
        issuedBy: userId,
        templateId: defaultTemplate.id,
        verificationCode,
      },
    });

    // Generate real PDF with PDFKit and upload to Supabase storage
    const studentName = [attempt.student?.user?.firstName, attempt.student?.user?.lastName].filter(Boolean).join(' ') || 'Student';
    const courseTitle = attempt.exam?.course?.title || attempt.exam?.title || 'Academic Course';
    const examTitle = attempt.exam?.title || 'Course Examination';

    let fileUrl = `https://storage.example.com/certificates/${cert.id}.pdf`;
    try {
      const pdfBuffer = await CertificateService.createCertificatePdfBuffer({
        studentName,
        courseTitle,
        examTitle,
        certificateNumber,
        verificationCode,
        issueDate: cert.issuedAt || new Date(),
      });

      const uploadResult = await uploadFile('documents', `certificates/${cert.id}.pdf`, pdfBuffer, 'application/pdf');
      fileUrl = uploadResult.publicUrl;
    } catch (err: any) {
      console.warn('PDF generation/upload failed, falling back to static URL:', err?.message || err);
    }

    await prisma.generatedReport.create({
      data: { templateId: defaultReportTemplate.id, parameters: {}, fileUrl, generatedAt: new Date() },
    }).catch((err) => { console.warn('Failed to create generated report record:', err.message); return null; });

    await prisma.verificationLog.create({ data: { certificateId: cert.id, verifiedBy: userId, isValid: true, verifiedAt: new Date() } }).catch((err) => { console.warn('Failed to create verification log:', err.message); return null; });

    return { cert, fileUrl };
  }

  static createCertificatePdfBuffer(data: {
    studentName: string;
    courseTitle: string;
    examTitle: string;
    certificateNumber: string;
    verificationCode: string;
    issueDate: Date;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margin: 40,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const width = doc.page.width;
      const height = doc.page.height;

      // Outer & Inner Borders
      doc.rect(20, 20, width - 40, height - 40).lineWidth(3).stroke('#1e3a8a');
      doc.rect(26, 26, width - 52, height - 52).lineWidth(1).stroke('#3b82f6');

      // Header
      doc.moveDown(2.5);
      doc.font('Helvetica-Bold').fontSize(30).fillColor('#1e3a8a').text('CERTIFICATE OF COMPLETION', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(14).fillColor('#64748b').text('This is proudly presented to', { align: 'center' });
      doc.moveDown(1);

      // Student Name
      doc.font('Helvetica-Bold').fontSize(26).fillColor('#0f172a').text(data.studentName, { align: 'center' });
      doc.moveDown(0.5);

      // Body text
      doc.font('Helvetica').fontSize(13).fillColor('#475569').text('for successfully completing all requirements for', { align: 'center' });
      doc.moveDown(0.5);

      // Course / Exam
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#2563eb').text(data.courseTitle, { align: 'center' });
      if (data.examTitle && data.examTitle !== data.courseTitle) {
        doc.font('Helvetica').fontSize(11).fillColor('#64748b').text(`Assessment: ${data.examTitle}`, { align: 'center' });
      }

      // Footer
      const formattedDate = data.issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.font('Helvetica').fontSize(10).fillColor('#64748b');
      doc.text(`Issue Date: ${formattedDate}`, 60, height - 90);
      doc.text(`Certificate No: ${data.certificateNumber}`, 60, height - 72);
      doc.text(`Verification Code: ${data.verificationCode}`, width - 340, height - 72, { align: 'right', width: 280 });

      doc.end();
    });
  }

  static async verifyCertificate(code: string) {
    const cert = await prisma.certificate.findFirst({ where: { verificationCode: code, deletedAt: null }, include: { student: true, exam: true } });
    return cert;
  }
}

export default CertificateService;

