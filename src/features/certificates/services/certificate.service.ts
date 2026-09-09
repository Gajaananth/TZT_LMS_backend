import { prisma } from '@/db/prisma/client';
import { randomUUID } from 'crypto';

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
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true, student: true } });
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

    const cert = await prisma.certificate.create({
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

    await prisma.generatedReport.create({
      data: { templateId: defaultReportTemplate.id, parameters: {}, fileUrl, generatedAt: new Date() },
    }).catch(() => null);

    await prisma.verificationLog.create({ data: { certificateId: cert.id, verifiedBy: userId, isValid: true, verifiedAt: new Date() } }).catch(() => null);

    return { cert, fileUrl };
  }

  static async verifyCertificate(code: string) {
    const cert = await prisma.certificate.findFirst({ where: { verificationCode: code, deletedAt: null }, include: { student: true, exam: true } });
    return cert;
  }
}

export default CertificateService;

