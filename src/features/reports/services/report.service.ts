import { prisma } from '@/db/prisma/client';

export class ReportService {
  static async generateReport(templateId: string, parameters: any, userId: string) {
    // Find template
    const template = await prisma.reportTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');

    // Placeholder: generate report and store file URL (integration with Supabase/pdf lib needed)
    const fileUrl = `https://storage.example.com/reports/${templateId}-${Date.now()}.pdf`;

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
}

export default ReportService;
