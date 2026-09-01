"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireRole = exports.requireAuth = void 0;
const supabase_1 = require("../lib/supabase");
const api_response_1 = require("../utils/api-response");
const client_1 = __importDefault(require("../db/prisma/client"));
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return (0, api_response_1.sendError)(res, 'Unauthorized - No token provided', 401);
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            return (0, api_response_1.sendError)(res, 'Unauthorized - Invalid token', 401);
        }
        const supabaseUser = user;
        // Fetch the user from our Prisma DB using the Supabase user ID
        const userFromDb = await client_1.default.user.findUnique({
            where: { supabaseUserId: supabaseUser.id },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!userFromDb) {
            return (0, api_response_1.sendError)(res, 'Unauthorized - User not found in database', 401);
        }
        if (!userFromDb.isActive) {
            return (0, api_response_1.sendError)(res, 'Unauthorized - Account is inactive', 403);
        }
        // Attach user to request
        req.user = userFromDb;
        next();
    }
    catch (error) {
        console.error('Auth Middleware Error:', error);
        return (0, api_response_1.sendError)(res, 'Internal server error during authentication', 500);
    }
};
exports.requireAuth = requireAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, api_response_1.sendError)(res, 'Unauthorized - No user attached', 401);
        }
        const userRoles = req.user.userRoles.map(ur => ur.role.name);
        const hasRole = allowedRoles.some(role => userRoles.includes(role));
        if (!hasRole) {
            return (0, api_response_1.sendError)(res, 'Forbidden - Insufficient permissions', 403);
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, api_response_1.sendError)(res, 'Unauthorized - No user attached', 401);
        }
        let hasPermission = false;
        for (const ur of req.user.userRoles) {
            // Allow superadmin to bypass permission checks
            if (ur.role.name === 'SuperAdmin') {
                hasPermission = true;
                break;
            }
            for (const rp of ur.role.rolePermissions) {
                if (rp.permission.resource === resource && rp.permission.action === action) {
                    hasPermission = true;
                    break;
                }
            }
        }
        if (!hasPermission) {
            return (0, api_response_1.sendError)(res, `Forbidden - Missing permission ${action}:${resource}`, 403);
        }
        next();
    };
};
exports.requirePermission = requirePermission;
