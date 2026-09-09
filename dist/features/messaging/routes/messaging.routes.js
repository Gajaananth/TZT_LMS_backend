"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messaging_controller_1 = __importDefault(require("../controllers/messaging.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
router.post('/send', messaging_controller_1.default.send);
router.get('/inbox', messaging_controller_1.default.getInbox);
router.get('/templates', messaging_controller_1.default.getTemplates);
router.get('/conversation/:partnerId', messaging_controller_1.default.getConversation);
router.post('/read/:partnerId', messaging_controller_1.default.markRead);
exports.default = router;
