"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionImportController = void 0;
const api_response_1 = require("../../../utils/api-response");
const question_import_service_1 = __importDefault(require("../services/question.import.service"));
class QuestionImportController {
    static async import(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const contentType = req.headers['content-type'] || '';
            let created;
            if (contentType.includes('application/json')) {
                created = await question_import_service_1.default.importFromJson(req.body, userId);
            }
            else if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
                const raw = (req.body && typeof req.body === 'string') ? req.body : '';
                created = await question_import_service_1.default.importFromCsv(raw, userId);
            }
            else {
                return (0, api_response_1.sendError)(res, 'Unsupported content type', 415);
            }
            return (0, api_response_1.sendSuccess)(res, { total: created.length, created }, 'Imported');
        }
        catch (err) {
            return next(err);
        }
    }
    static async export(req, res, next) {
        try {
            const format = req.query.format || 'json';
            if (format === 'json') {
                const data = await question_import_service_1.default.exportAsJson({});
                return res.json(data);
            }
            if (format === 'csv') {
                const data = await question_import_service_1.default.exportAsCsv({});
                res.setHeader('Content-Type', 'text/csv');
                return res.send(data);
            }
            return (0, api_response_1.sendError)(res, 'Unsupported format', 400);
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.QuestionImportController = QuestionImportController;
exports.default = QuestionImportController;
