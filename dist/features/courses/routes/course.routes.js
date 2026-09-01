"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const course_controller_1 = __importDefault(require("../controllers/course.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_middleware_1.requireAuth);
router.get('/', course_controller_1.default.list);
router.post('/', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin', 'Teacher']), course_controller_1.default.create);
router.get('/:id', course_controller_1.default.get);
router.put('/:id', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin', 'Teacher']), course_controller_1.default.update);
router.delete('/:id', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin']), course_controller_1.default.remove);
exports.default = router;
