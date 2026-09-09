"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const api_response_1 = require("../../../utils/api-response");
const report_service_1 = __importDefault(require("../services/report.service"));
const VALID_TYPES = ['student', 'attendance', 'finance', 'academic', 'exam'];
const VALID_FORMATS = ['pdf', 'csv', 'excel'];
class ReportController {
    static async downloadByType(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId)
                return (0, api_response_1.sendError)(res, 'Authentication required', 401);
            const type = (req.params.type || '').toLowerCase();
            const format = (req.query.format || 'csv').toLowerCase();
            if (!VALID_TYPES.includes(type)) {
                return (0, api_response_1.sendError)(res, `Invalid report type. Expected one of: ${VALID_TYPES.join(', ')}`, 400);
            }
            if (!VALID_FORMATS.includes(format)) {
                return (0, api_response_1.sendError)(res, `Invalid format. Expected one of: ${VALID_FORMATS.join(', ')}`, 400);
            }
            const startDate = req.query.startDate || undefined;
            const endDate = req.query.endDate || undefined;
            const artifact = await report_service_1.default.exportReportByType(type, format, userId, { startDate, endDate });
            const encodedFilename = encodeURIComponent(artifact.filename);
            res.setHeader('Content-Type', artifact.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"; filename*=UTF-8''${encodedFilename}`);
            res.setHeader('Content-Length', artifact.buffer.length.toString());
            return res.status(200).end(artifact.buffer);
        }
        catch (err) {
            return next(err);
        }
    }
    static async generate(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const { templateId, parameters } = req.body;
            const result = await report_service_1.default.generateReport(templateId, parameters, userId);
            return (0, api_response_1.sendSuccess)(res, result, 'Report generated', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async list(req, res, next) {
        try {
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 20);
            const result = await report_service_1.default.listGeneratedReports(page, limit);
            return (0, api_response_1.sendSuccess)(res, result);
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.ReportController = ReportController;
exports.default = ReportController;
