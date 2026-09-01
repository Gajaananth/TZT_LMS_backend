"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const discussion_controller_1 = __importDefault(require("../controllers/discussion.controller"));
const auth_middleware_1 = require("../../../middleware/auth.middleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_middleware_1.requireAuth);
router.get('/', discussion_controller_1.default.list);
router.post('/', discussion_controller_1.default.create);
router.post('/:topicId/replies', discussion_controller_1.default.reply);
router.post('/replies/:replyId/react', discussion_controller_1.default.react);
// moderation endpoints (pin/delete) will be added later
exports.default = router;
