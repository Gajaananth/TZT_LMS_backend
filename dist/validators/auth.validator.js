"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetConfirmSchema = exports.passwordResetRequestSchema = exports.refreshSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    role: zod_1.z.string().optional(),
    specialization: zod_1.z.string().optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
exports.refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1)
});
exports.passwordResetRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email()
});
exports.passwordResetConfirmSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(8)
});
