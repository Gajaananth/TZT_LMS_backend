export {};

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://gajaa@127.0.0.1:5432/tzit_education?schema=public&connect_timeout=15';

const prisma = require('../src/db/prisma/client').default;

const ensureSeededReferenceData = async () => {
  const roles = ['SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent', 'Staff'];
  const permissions = ['create_users', 'read_users', 'update_users', 'delete_users', 'create_courses', 'read_courses', 'update_courses', 'delete_courses', 'create_students', 'read_students', 'update_students', 'delete_students', 'create_teachers', 'read_teachers', 'update_teachers', 'delete_teachers', 'create_attendance', 'read_attendance', 'update_attendance', 'delete_attendance'];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role, description: `${role} role` },
    }).catch(() => undefined);
  }

  for (const permissionName of permissions) {
    const [resource, action] = permissionName.split('_');
    await prisma.permission.upsert({
      where: { name: permissionName },
      update: {},
      create: { name: permissionName, resource, action, description: `Can ${action} ${resource}` },
    }).catch(() => undefined);
  }
};

const resetTestDatabase = async () => {
  await prisma.auditLog.deleteMany({}).catch(() => undefined);
  await prisma.session.deleteMany({}).catch(() => undefined);
  await prisma.userRole.deleteMany({}).catch(() => undefined);
  await prisma.user.deleteMany({}).catch(() => undefined);
  await ensureSeededReferenceData();
};

module.exports = async () => {
  await prisma.$connect();
  await resetTestDatabase();
};
