import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { sendError } from '../utils/api-response';
import prisma from '../db/prisma/client';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Unauthorized - No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return sendError(res, 'Unauthorized - Invalid token', 401);
    }

    const supabaseUser = user;

    // Fetch the user from our Prisma DB using the Supabase user ID
    const userFromDb = await prisma.user.findUnique({
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
      return sendError(res, 'Unauthorized - User not found in database', 401);
    }

    if (!userFromDb.isActive) {
      return sendError(res, 'Unauthorized - Account is inactive', 403);
    }

    // Attach user to request
    req.user = userFromDb;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return sendError(res, 'Internal server error during authentication', 500);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized - No user attached', 401);
    }

    const userRoles = req.user.userRoles.map(ur => ur.role.name);
    
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    if (!hasRole) {
      return sendError(res, 'Forbidden - Insufficient permissions', 403);
    }

    next();
  };
};

export const requirePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized - No user attached', 401);
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
      return sendError(res, `Forbidden - Missing permission ${action}:${resource}`, 403);
    }

    next();
  };
};
