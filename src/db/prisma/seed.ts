import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { supabaseAdmin } from '../../lib/supabase';

const prisma = new PrismaClient();

async function getOrCreateSupabaseUser(email: string, password: string, firstName: string, lastName: string): Promise<string> {
  // 1. Try to create the user directly
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (!createError && createData?.user?.id) {
    console.log(`Created Supabase Auth user for ${email} (ID: ${createData.user.id})`);
    return createData.user.id;
  }

  // 2. If user already exists in Supabase, find them and sync password
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase users: ${listError.message}`);
  }

  const existingUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (updateError) {
      console.warn(`Warning updating Supabase user for ${email}:`, updateError.message);
    } else {
      console.log(`Updated existing Supabase Auth user for ${email} (ID: ${existingUser.id})`);
    }
    return existingUser.id;
  }

  throw new Error(`Could not create or find Supabase Auth user for ${email}: ${createError?.message}`);
}

async function main() {
  console.log('Start seeding...');

  // 1. Seed Roles
  const roles = ['SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent', 'Staff'];
  const roleMap: { [key: string]: string } = {};
  
  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName} role`,
      },
    });
    roleMap[roleName] = role.id;
  }
  console.log('Roles seeded.');

  // 2. Seed Permissions
  const resources = ['users', 'courses', 'batches', 'invoices', 'attendance', 'students', 'teachers'];
  const actions = ['create', 'read', 'update', 'delete'];
  const permissionMap: { [key: string]: string } = {};
  
  for (const resource of resources) {
    for (const action of actions) {
      const permissionName = `${action}_${resource}`;
      const permission = await prisma.permission.upsert({
        where: { name: permissionName },
        update: {},
        create: {
          name: permissionName,
          resource,
          action,
          description: `Can ${action} ${resource}`
        }
      });
      permissionMap[permissionName] = permission.id;
    }
  }
  console.log('Permissions seeded.');

  // 3. Assign all permissions to SuperAdmin and Admin
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SuperAdmin' } });
  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  const allPermissions = await prisma.permission.findMany();

  if (superAdminRole) {
    for (const permission of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id
        }
      });
    }
    console.log('SuperAdmin permissions assigned.');
  }

  if (adminRole) {
    for (const permission of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      });
    }
    console.log('Admin permissions assigned.');
  }

  // 4. Seed Departments (needed before student/batch linking)
  const departments = [
    { name: 'Computer Science', code: 'CS' },
    { name: 'Electronics & Communication', code: 'ECE' },
    { name: 'Mechanical Engineering', code: 'ME' },
    { name: 'Civil Engineering', code: 'CE' }
  ];

  const departmentMap: { [key: string]: string } = {};

  for (const dept of departments) {
    const department = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: {
        name: dept.name,
        code: dept.code,
        description: `${dept.name} Department`
      }
    });
    departmentMap[dept.code] = department.id;
  }
  console.log('Departments seeded.');

  // 5. Seed Batches
  const batches = [
    { name: 'CS-2024', code: 'CS24', departmentCode: 'CS', startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31') },
    { name: 'CS-2023', code: 'CS23', departmentCode: 'CS', startDate: new Date('2023-01-01'), endDate: new Date('2023-12-31') },
    { name: 'ECE-2024', code: 'ECE24', departmentCode: 'ECE', startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31') }
  ];

  const batchMap: { [key: string]: string } = {};

  for (const batch of batches) {
    const batchRecord = await prisma.batch.upsert({
      where: { code: batch.code },
      update: {},
      create: {
        name: batch.name,
        code: batch.code,
        departmentId: departmentMap[batch.departmentCode],
        startDate: batch.startDate,
        endDate: batch.endDate,
        isActive: true
      }
    });
    batchMap[batch.code] = batchRecord.id;
  }
  console.log('Batches seeded.');

  // 6. Seed real users in Supabase Auth and Prisma DB
  const sampleUsers = [
    {
      email: 'owner@tzit.edu',
      password: 'SuperAdmin@TZIT2026!',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SuperAdmin'
    },
    {
      email: 'admin@tzit.edu',
      password: 'Admin@TZIT2026!',
      firstName: 'Academic',
      lastName: 'Admin',
      role: 'Admin'
    },
    {
      email: 'teacher@tzit.edu',
      password: 'Teacher@TZIT2026!',
      firstName: 'Sarah',
      lastName: 'Professor',
      role: 'Teacher',
      specialization: 'Computer Science'
    },
    {
      email: 'student1@tzit.edu',
      password: 'Student@TZIT2026!',
      firstName: 'Alice',
      lastName: 'Johnson',
      role: 'Student',
      studentId: 'STU000001'
    },
    {
      email: 'student2@tzit.edu',
      password: 'Student@TZIT2026!',
      firstName: 'Bob',
      lastName: 'Smith',
      role: 'Student',
      studentId: 'STU000002'
    }
  ];

  for (const userData of sampleUsers) {
    // Ensure real user in Supabase Auth
    const supabaseUserId = await getOrCreateSupabaseUser(
      userData.email,
      userData.password,
      userData.firstName,
      userData.lastName
    );

    // Upsert Prisma User record
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        supabaseUserId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isActive: true,
      },
      create: {
        email: userData.email,
        supabaseUserId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: '',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    // Assign Role
    const role = await prisma.role.findUnique({ where: { name: userData.role } });
    if (role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id
        }
      });
    }

    // Link Teacher Profile
    if (userData.role === 'Teacher') {
      const existingTeacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!existingTeacher) {
        await prisma.teacher.create({
          data: {
            userId: user.id,
            employeeId: 'TCH000001',
            specialization: userData.specialization || 'General',
            isActive: true,
            dateOfJoining: new Date('2024-01-15'),
          }
        });
      }
    }

    // Link Student Profile
    if (userData.role === 'Student') {
      const existingStudent = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!existingStudent) {
        await prisma.student.create({
          data: {
            userId: user.id,
            studentId: userData.studentId || `STU${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
            departmentId: departmentMap['CS'],
            batchId: batchMap['CS24'],
            isActive: true,
            dateOfAdmission: new Date('2024-02-01'),
          }
        });
      }
    }
  }
  console.log('Sample users seeded with real Supabase Auth accounts.');

  // 7. Seed a default course category (Course.categoryId is required)
  const defaultCategory = await prisma.courseCategory.upsert({
    where: { id: 'seed-default-category' },
    update: {},
    create: {
      id: 'seed-default-category',
      name: 'General',
      description: 'Default category for seeded courses',
    },
  });

  // 8. Seed Courses
  const courses = [
    { title: 'Introduction to Programming', code: 'CS101', departmentCode: 'CS', credits: 3, durationWeeks: 12, difficultyLevel: 'BEGINNER', description: 'Learn the basics of programming' },
    { title: 'Data Structures', code: 'CS102', departmentCode: 'CS', credits: 3, durationWeeks: 14, difficultyLevel: 'INTERMEDIATE', description: 'Master fundamental data structures' },
    { title: 'Digital Logic', code: 'ECE101', departmentCode: 'ECE', credits: 3, durationWeeks: 10, difficultyLevel: 'BEGINNER', description: 'Introduction to digital systems' }
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: {},
      create: {
        title: course.title,
        code: course.code,
        categoryId: defaultCategory.id,
        departmentId: departmentMap[course.departmentCode],
        credits: course.credits,
        durationWeeks: course.durationWeeks,
        difficultyLevel: course.difficultyLevel,
        description: course.description,
      }
    });
  }
  console.log('Courses seeded.');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
