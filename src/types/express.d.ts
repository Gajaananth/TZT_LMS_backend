import { User, UserRole, Role, RolePermission, Permission } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User & {
        userRoles: (UserRole & {
          role: Role & {
            rolePermissions: (RolePermission & {
              permission: Permission;
            })[];
          };
        })[];
      };
    }
  }
}
