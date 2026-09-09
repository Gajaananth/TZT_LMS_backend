"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = __importDefault(require("../controllers/settings.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
router.use((0, auth_middleware_1.requireRole)(['SuperAdmin']));
router.get('/', settings_controller_1.default.list);
router.patch('/bulk', settings_controller_1.default.bulkUpdate);
router.get('/rbac/roles', settings_controller_1.default.listRoles);
router.get('/rbac/users', settings_controller_1.default.listUsersRBAC);
router.patch('/rbac/users/:userId/roles', settings_controller_1.default.assignUserRoles);
exports.default = router;
