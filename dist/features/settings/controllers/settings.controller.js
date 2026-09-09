"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const api_response_1 = require("../../../utils/api-response");
const settings_service_1 = __importDefault(require("../services/settings.service"));
class SettingsController {
    static async list(req, res, next) {
        try {
            const userId = req.user?.id;
            const group = req.query.group || undefined;
            const data = await settings_service_1.default.listSettings(group, userId);
            return (0, api_response_1.sendSuccess)(res, data);
        }
        catch (err) {
            return next(err);
        }
    }
    static async bulkUpdate(req, res, next) {
        try {
            const userId = req.user?.id || '';
            const records = req.body?.records || req.body;
            const data = await settings_service_1.default.bulkUpdateSettings(records, userId);
            return (0, api_response_1.sendSuccess)(res, data, 'Settings updated');
        }
        catch (err) {
            return next(err);
        }
    }
    static async listRoles(req, res, next) {
        try {
            const roles = await settings_service_1.default.listRolesWithPermissions();
            return (0, api_response_1.sendSuccess)(res, { roles });
        }
        catch (err) {
            return next(err);
        }
    }
    static async listUsersRBAC(req, res, next) {
        try {
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 100);
            const data = await settings_service_1.default.listUsersWithRoles(page, limit);
            return (0, api_response_1.sendSuccess)(res, data);
        }
        catch (err) {
            return next(err);
        }
    }
    static async assignUserRoles(req, res, next) {
        try {
            const assignedBy = req.user?.id || '';
            const targetUserId = req.params.userId;
            const roleIds = req.body?.roleIds || req.body?.roles || [];
            if (!targetUserId)
                return (0, api_response_1.sendError)(res, 'userId is required', 400);
            const result = await settings_service_1.default.assignUserRoles(targetUserId, roleIds, assignedBy);
            return (0, api_response_1.sendSuccess)(res, result, 'User roles updated');
        }
        catch (err) {
            if (/SuperAdmin/.test(err.message || '')) {
                return (0, api_response_1.sendError)(res, err.message, 403);
            }
            return next(err);
        }
    }
}
exports.SettingsController = SettingsController;
exports.default = SettingsController;
