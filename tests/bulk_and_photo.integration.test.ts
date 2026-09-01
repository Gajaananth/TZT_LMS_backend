import request from 'supertest';
import app from '@/server';
import { prisma } from '@/db/prisma/client';
import { supabaseAdmin } from '@/lib/supabase';

describe('Bulk import/export and photo upload', () => {
  let authToken: string;
  let batchId: string;
  let departmentId: string;
  let studentId: string;
  let teacherId: string;

  beforeAll(async () => {
    const email = `admin-bulk-${Date.now()}@test.com`;
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'TestPassword123!', firstName: 'Bulk', lastName: 'Admin', role: 'SuperAdmin' });
    expect(registerResponse.status).toBe(201);
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123!' });
    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.session.accessToken;

    const dept = await prisma.department.findFirst();
    if (!dept) {
      const newDept = await prisma.department.create({ data: { name: 'BulkDept', code: 'BULK' } });
      departmentId = newDept.id;
    } else {
      departmentId = dept.id;
    }

    const batch = await prisma.batch.findFirst();
    if (!batch) {
      const newBatch = await prisma.batch.create({ data: { name: 'BulkBatch', code: 'BB', departmentId, startDate: new Date(), endDate: new Date(Date.now() + 1000000000) } });
      batchId = newBatch.id;
    } else {
      batchId = batch.id;
    }

    // Mock Supabase storage used by photo upload endpoints
    (supabaseAdmin as any).storage = {
      from: (_bucket: string) => ({
        upload: async (path: string, _buffer: any, _opts: any) => ({ data: { path }, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    };
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'admin-bulk-' } } });
    await prisma.student.deleteMany({ where: { user: { email: { contains: 'bulk-student-' } } } });
    await prisma.teacher.deleteMany({ where: { user: { email: { contains: 'bulk-teacher-' } } } });
  });

  test('Student CSV import and export', async () => {
    const csv = ['firstName,lastName,email,batchId,departmentId,password',
      `Bulk,Student,bulk-student-${Date.now()}@test.com,${batchId},${departmentId},Password123!`].join('\n');

    const importRes = await request(app)
      .post('/api/v1/students/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ csv });

    expect(importRes.status).toBe(201);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.data.created.length).toBeGreaterThan(0);

    // Export
    const exportRes = await request(app)
      .get('/api/v1/students/export')
      .set('Authorization', `Bearer ${authToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.header['content-type']).toContain('text/csv');
  });

  test('Teacher CSV import and export', async () => {
    const csv = ['firstName,lastName,email,specialization,password',
      `Bulk,Teacher,bulk-teacher-${Date.now()}@test.com,Science,Password123!`].join('\n');

    const importRes = await request(app)
      .post('/api/v1/teachers/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ csv });

    expect(importRes.status).toBe(201);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.data.created.length).toBeGreaterThan(0);

    // Export
    const exportRes = await request(app)
      .get('/api/v1/teachers/export')
      .set('Authorization', `Bearer ${authToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.header['content-type']).toContain('text/csv');
  });

  test('Student and Teacher photo upload', async () => {
    // Create supabase user + prisma user + student
    const { data: supUser, error: supUserError } = await supabaseAdmin.auth.admin.createUser({ email: `bulk-student-${Date.now()}@test.com`, password: 'Pass123!', email_confirm: true });
    if (supUserError || !supUser?.user?.id || !supUser.user.email) throw new Error('Failed to create bulk student auth user');
    const user = await prisma.user.create({ data: { supabaseUserId: supUser.user.id, email: supUser.user.email, firstName: 'Photo', lastName: 'Student', passwordHash: '', userRoles: { create: { roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '' } } } });
    const student = await prisma.student.create({ data: { userId: user.id, studentId: `PS-${Date.now()}`, batchId, departmentId } });
    studentId = student.id;

    const res = await request(app)
      .post(`/api/v1/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ fileName: 'avatar.png', mimeType: 'image/png', fileData: Buffer.from('fake').toString('base64') });

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toMatch(/^https:\/\/cdn.test\//);

    // Teacher
    const { data: supTeacher, error: supTeacherError } = await supabaseAdmin.auth.admin.createUser({ email: `bulk-teacher-${Date.now()}@test.com`, password: 'Pass123!', email_confirm: true });
    if (supTeacherError || !supTeacher?.user?.id || !supTeacher.user.email) throw new Error('Failed to create bulk teacher auth user');
    const tUser = await prisma.user.create({ data: { supabaseUserId: supTeacher.user.id, email: supTeacher.user.email, firstName: 'Photo', lastName: 'Teacher', passwordHash: '', userRoles: { create: { roleId: (await prisma.role.findUnique({ where: { name: 'Teacher' } }))?.id || '' } } } });
    const teacher = await prisma.teacher.create({ data: { userId: tUser.id, employeeId: `T-${Date.now()}`, specialization: 'Art' } });
    teacherId = teacher.id;

    const tres = await request(app)
      .post(`/api/v1/teachers/${teacherId}/photo`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ fileName: 'avatar.png', mimeType: 'image/png', fileData: Buffer.from('fake').toString('base64') });

    expect(tres.status).toBe(200);
    expect(tres.body.data.avatarUrl).toMatch(/^https:\/\/cdn.test\//);
  });
});
