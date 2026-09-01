"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const question_import_controller_1 = __importDefault(require("../controllers/question.import.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_middleware_1.requireAuth);
router.post('/import', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin', 'Teacher']), question_import_controller_1.default.import);
router.get('/export', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin', 'Teacher']), question_import_controller_1.default.export);
exports.default = router;
