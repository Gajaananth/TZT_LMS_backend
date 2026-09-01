"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const api_response_1 = require("../../../utils/api-response");
const report_service_1 = __importDefault(require("../services/report.service"));
class ReportController {
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
