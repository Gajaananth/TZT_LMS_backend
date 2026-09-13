import { prisma } from '@/db/prisma/client';
import PDFDocument from 'pdfkit';
import { uploadFile } from '@/lib/storage';

export type ReportType = 'student' | 'attendance' | 'finance' | 'academic' | 'exam';
export type ReportFormat = 'pdf' | 'csv' | 'excel';

export interface GeneratedReportArtifact {
  mimeType: string;
  filename: string;
  buffer: Buffer;
}

const buildCsv = (headers: string[], rows: (string | number | boolean | null | undefined)[][]): Buffer => {
  const escapeCell = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(','));
  rows.forEach((row) => lines.push(row.map(escapeCell).join(',')));
  return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8');
};

const buildPdfReport = (
  title: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const isLandscape = headers.length > 5;
    const doc = new PDFDocument({
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait',
      margin: 36,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 72;
    const colWidth = pageWidth / Math.max(headers.length, 1);

    // Title & Header
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a8a').text(title.replace(/_/g, ' '));
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`Generated on ${new Date().toLocaleString()} | TZIT Education ERP & LMS`);
    doc.moveDown(0.8);

    let y = doc.y;

    const renderHeaders = () => {
      doc.rect(36, y, pageWidth, 20).fill('#1e3a8a');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
      headers.forEach((h, i) => {
        doc.text(h, 40 + i * colWidth, y + 5, {
          width: colWidth - 8,
          ellipsis: true,
        });
      });
      y += 20;
    };

    renderHeaders();

    // Rows
    doc.font('Helvetica').fontSize(8);
    const maxRows = Math.min(rows.length, 500);

    for (let r = 0; r < maxRows; r++) {
      if (y > doc.page.height - 45) {
        doc.addPage();
        y = 36;
        renderHeaders();
        doc.font('Helvetica').fontSize(8);
      }

      const row = rows[r];
      const bg = r % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(36, y, pageWidth, 18).fill(bg);
      doc.fillColor('#1e293b');

      row.forEach((val, i) => {
        const text = val !== null && val !== undefined ? String(val) : '';
        doc.text(text, 40 + i * colWidth, y + 4, {
          width: colWidth - 8,
          ellipsis: true,
        });
      });

      y += 18;
    }

    if (rows.length > maxRows) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b').text(`Note: Showing first ${maxRows} of ${rows.length} records.`);
    }

    doc.end();
  });
};

const getUserRoles = async (userId: string): Promise<string[]> => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });
  return u?.userRoles.map((ur) => ur.role.name) || [];
};

export interface ReportFilterOptions {
  startDate?: string | null;
  endDate?: string | null;
}

const parseDateFilters = (opts?: ReportFilterOptions) => {
  const gte = opts?.startDate ? new Date(opts.startDate) : undefined;
  const lte = opts?.endDate ? new Date(`${opts.endDate}T23:59:59.999`) : undefined;
  if (!gte && !lte) return undefined;
  const out: Record<string, Date> = {};
  if (gte) out.gte = gte;
  if (lte) out.lte = lte;
  return out;
};

const mergeWhere = (base: any, extra: any) => {
  if (!extra) return base;
  if (!base) return extra;
  return { ...base, ...extra };
};

export class ReportService {
  static async generateReport(templateId: string, parameters: any, userId: string) {
    const template = await prisma.reportTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');

    const reportName = template.name || 'Report';
    let fileUrl = `https://storage.example.com/reports/${templateId}-${Date.now()}.pdf`;

    try {
      const paramRows = Object.entries(parameters || {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
      const pdfBuffer = await buildPdfReport(reportName, ['Setting / Filter', 'Value'], paramRows);
      const uploaded = await uploadFile('documents', `reports/${templateId}-${Date.now()}.pdf`, pdfBuffer, 'application/pdf');
      fileUrl = uploaded.publicUrl;
    } catch (err: any) {
      console.warn('Failed to upload report PDF to storage:', err?.message || err);
    }

    const generated = await prisma.generatedReport.create({
      data: {
        templateId,
        parameters: parameters || {},
        fileUrl,
        generatedAt: new Date(),
      },
    });

    return { generated, fileUrl };
  }

  static async listGeneratedReports(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const reports = await prisma.generatedReport.findMany({ skip, take: limit, orderBy: { generatedAt: 'desc' } });
    const total = await prisma.generatedReport.count({ where: { deletedAt: null } });
    return { reports, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async exportReportByType(
    type: ReportType,
    format: ReportFormat,
    userId: string,
    opts?: ReportFilterOptions,
  ): Promise<GeneratedReportArtifact> {
    const roles = await getUserRoles(userId);
    const isAdmin = roles.some((r) => r === 'SuperAdmin' || r === 'Admin');
    const isTeacher = roles.includes('Teacher');
    const isStudent = roles.includes('Student');

    const csvToArtifact = async (
      safeName: string,
      headers: string[],
      rows: (string | number | boolean | null | undefined)[][],
    ): Promise<GeneratedReportArtifact> => {
      const suffix = opts?.startDate || opts?.endDate
        ? `_${opts.startDate || 'any'}_to_${opts.endDate || 'any'}`.replace(/[^a-zA-Z0-9_-]/g, '')
        : '';
      if (format === 'csv') {
        return {
          mimeType: 'text/csv; charset=utf-8',
          filename: `${safeName}${suffix}.csv`,
          buffer: buildCsv(headers, rows),
        };
      }
      if (format === 'excel') {
        return {
          mimeType: 'application/vnd.ms-excel',
          filename: `${safeName}${suffix}.xls`,
          buffer: buildCsv(headers, rows),
        };
      }
      const pdfBuffer = await buildPdfReport(safeName, headers, rows);
      return {
        mimeType: 'application/pdf',
        filename: `${safeName}${suffix}.pdf`,
        buffer: pdfBuffer,
      };
    };

    switch (type) {
      case 'student': {
        const take = 5000;
        const dateFilter = parseDateFilters(opts);
        const baseWhere: any = isStudent ? { userId } : {};
        const dateWhere: any = dateFilter ? { dateOfAdmission: dateFilter } : {};
        const students = await prisma.student.findMany({
          take,
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
            batch: { select: { name: true } },
            department: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          where: { ...baseWhere, ...dateWhere },
        });
        const headers = ['Student ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Batch', 'Department', 'Status', 'Admission Date'];
        const rows = students.map((s: any) => [
          s.studentId || s.id,
          s.user?.firstName || '',
          s.user?.lastName || '',
          s.user?.email || '',
          s.user?.phone || '',
          s.batch?.name || s.batchId || '',
          s.department?.name || s.departmentId || '',
          s.isActive === false ? 'Inactive' : 'Active',
          s.dateOfAdmission ? new Date(s.dateOfAdmission).toLocaleDateString() : '',
        ]);
        return await csvToArtifact('Student_Records', headers, rows);
      }

      case 'attendance': {
        const take = 5000;
        const dateFilter = parseDateFilters(opts);
        const baseWhere: any = isStudent ? { student: { userId } } : {};
        const dateWhere: any = dateFilter ? { attendanceDate: dateFilter } : {};
        const records = await prisma.attendanceRecord.findMany({
          take,
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            course: { select: { title: true, code: true } },
          },
          orderBy: { attendanceDate: 'desc' },
          where: { ...baseWhere, ...dateWhere },
        });
        const headers = ['Date', 'Student ID', 'Student Name', 'Course', 'Status', 'Remarks'];
        const rows = records.map((r: any) => [
          r.attendanceDate ? new Date(r.attendanceDate).toLocaleDateString() : '',
          r.studentId,
          [r.student?.user?.firstName, r.student?.user?.lastName].filter(Boolean).join(' '),
          r.course?.code ? `${r.course.code} - ${r.course.title}` : r.course?.title || '',
          r.status || '',
          r.remarks || '',
        ]);
        return await csvToArtifact('Attendance_Report', headers, rows);
      }

      case 'finance': {
        if (!isAdmin && !isTeacher && !isStudent) {
          return await csvToArtifact('Finance_Report', ['Access'], [['Restricted to admin roles']]);
        }
        const dateFilter = parseDateFilters(opts);
        const baseWhere: any = isStudent ? { student: { userId } } : {};
        const dateWhere: any = dateFilter ? { dueDate: dateFilter } : {};
        const invoices = await prisma.invoice.findMany({
          take: 5000,
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            payments: { select: { amount: true, method: true, paymentDate: true } },
          },
          where: { ...baseWhere, ...dateWhere },
          orderBy: { dueDate: 'desc' },
        });
        const headers = ['Invoice #', 'Student', 'Description', 'Amount', 'Paid', 'Balance', 'Due Date', 'Status', 'Last Payment'];
        const rows = invoices.map((inv: any) => {
          const paid = inv.payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
          const balance = Math.max(0, Number(inv.totalAmount || 0) - paid);
          return [
            inv.invoiceNumber || inv.id,
            [inv.student?.user?.firstName, inv.student?.user?.lastName].filter(Boolean).join(' ') || '',
            inv.description || '',
            Number(inv.totalAmount || 0),
            paid,
            balance,
            inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '',
            inv.status || '',
            inv.payments?.[0]?.paymentDate ? new Date(inv.payments[0].paymentDate).toLocaleDateString() : '',
          ];
        });
        return await csvToArtifact('Finance_Fees_Report', headers, rows);
      }

      case 'academic': {
        const dateFilter = parseDateFilters(opts);
        const dateWhere: any = dateFilter ? { createdAt: dateFilter } : {};
        const courses = await prisma.course.findMany({
          take: 1000,
          where: dateWhere,
          include: {
            _count: { select: { enrollments: true, exams: true } },
            teacherAssignment_course: {
              include: {
                teacher: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['Course Code', 'Title', 'Teacher', 'Credits', 'Enrolled', 'Exams', 'Difficulty'];
        const rows = courses.map((c: any) => [
          c.code || '',
          c.title || '',
          c.teacherAssignment_course
            .map((tc: any) => [tc.teacher?.user?.firstName, tc.teacher?.user?.lastName].filter(Boolean).join(' '))
            .join('; ') || '',
          c.credits || '',
          c._count.enrollments,
          c._count.exams,
          c.difficultyLevel || '',
        ]);
        return await csvToArtifact('Academic_Course_Performance', headers, rows);
      }

      case 'exam': {
        const dateFilter = parseDateFilters(opts);
        const baseWhere: any = { deletedAt: null };
        const dateWhere: any = dateFilter ? { createdAt: dateFilter } : {};
        const exams = await prisma.exam.findMany({
          take: 5000,
          where: { ...baseWhere, ...dateWhere },
          include: {
            course: { select: { title: true, code: true } },
            _count: { select: { examQuestions: true, attempts: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['Exam Title', 'Course', 'Questions', 'Attempts', 'Duration (min)', 'Passing Score', 'Start Date', 'End Date'];
        const rows = exams.map((e: any) => [
          e.title || '',
          e.course?.code ? `${e.course.code} - ${e.course.title}` : e.course?.title || '',
          e._count.examQuestions,
          e._count.attempts,
          e.durationMinutes || '',
          e.passingScore || '',
          e.startDate ? new Date(e.startDate).toLocaleDateString() : '',
          e.endDate ? new Date(e.endDate).toLocaleDateString() : '',
        ]);
        return await csvToArtifact('Exams_and_Results', headers, rows);
      }

      default:
        return await csvToArtifact('Report', ['Type'], [[type]]);
    }
  }
}

export default ReportService;

