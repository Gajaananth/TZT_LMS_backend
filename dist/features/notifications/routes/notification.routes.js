"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = __importDefault(require("../controllers/notification.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_middleware_1.requireAuth);
router.post('/', (0, auth_middleware_1.requireRole)(['SuperAdmin', 'Admin']), notification_controller_1.default.create);
router.get('/', notification_controller_1.default.list);
router.get('/unread-count', notification_controller_1.default.getUnreadCount);
router.patch('/read-all', notification_controller_1.default.markAllAsRead);
router.patch('/:id/read', notification_controller_1.default.markAsRead);
router.delete('/delete-all', notification_controller_1.default.deleteAll);
router.delete('/:id', notification_controller_1.default.delete);
exports.default = router;
