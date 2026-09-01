"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const certificate_controller_1 = __importDefault(require("../controllers/certificate.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/templates', auth_middleware_1.requireAuth, certificate_controller_1.default.listTemplates);
router.post('/templates', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin']), certificate_controller_1.default.createTemplate);
router.post('/generate', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin', 'Teacher']), certificate_controller_1.default.generate);
// public verification endpoint (no auth)
router.get('/verify/:code', certificate_controller_1.default.verify);
exports.default = router;
