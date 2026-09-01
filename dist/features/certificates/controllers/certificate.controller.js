"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateController = void 0;
const api_response_1 = require("../../../utils/api-response");
const certificate_service_1 = __importDefault(require("../services/certificate.service"));
class CertificateController {
    static async createTemplate(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const tpl = await certificate_service_1.default.createTemplate(req.body, userId);
            return (0, api_response_1.sendSuccess)(res, tpl, 'Template created', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async listTemplates(req, res, next) {
        try {
            const templates = await certificate_service_1.default.listTemplates();
            return (0, api_response_1.sendSuccess)(res, templates);
        }
        catch (err) {
            return next(err);
        }
    }
    static async generate(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const { attemptId } = req.body;
            const result = await certificate_service_1.default.generateCertificate(attemptId, userId);
            return (0, api_response_1.sendSuccess)(res, result, 'Certificate generated', 201);
        }
        catch (err) {
            return next(err);
        }
    }
    static async verify(req, res, next) {
        try {
            const { code } = req.params;
            const cert = await certificate_service_1.default.verifyCertificate(code);
            if (!cert)
                return (0, api_response_1.sendError)(res, 'Certificate not found', 404);
            return (0, api_response_1.sendSuccess)(res, cert);
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.CertificateController = CertificateController;
exports.default = CertificateController;
