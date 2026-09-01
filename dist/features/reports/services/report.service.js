"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const client_1 = require("../../../db/prisma/client");
class ReportService {
    static async generateReport(templateId, parameters, userId) {
        // Find template
        const template = await client_1.prisma.reportTemplate.findUnique({ where: { id: templateId } });
        if (!template)
            throw new Error('Template not found');
        // Placeholder: generate report and store file URL (integration with Supabase/pdf lib needed)
        const fileUrl = `https://storage.example.com/reports/${templateId}-${Date.now()}.pdf`;
        const generated = await client_1.prisma.generatedReport.create({
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
        const reports = await client_1.prisma.generatedReport.findMany({ skip, take: limit, orderBy: { generatedAt: 'desc' } });
        const total = await client_1.prisma.generatedReport.count({ where: { deletedAt: null } });
        return { reports, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
}
exports.ReportService = ReportService;
exports.default = ReportService;
