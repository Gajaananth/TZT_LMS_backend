"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = __importDefault(require("../controllers/report.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_middleware_1.requireAuth);
router.post('/generate', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin']), report_controller_1.default.generate);
router.get('/generated', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin']), report_controller_1.default.list);
exports.default = router;
