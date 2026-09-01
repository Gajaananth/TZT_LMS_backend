import request from 'supertest';
import app from '@/server';
import { prisma } from '@/db/prisma/client';
import { supabaseAdmin } from '@/lib/supabase';

describe('Attendance backdate and append-only corrections', () => {
  let authToken: string;
  let adminUserId: string;
  let studentUserId: string;
  let studentId: string;
  let batchId: string;
  let courseId: string;

  beforeAll(async () => {
    const email = `att-back-${Date.now()}@test.com`;
    const registerResponse = await request(app).post('/api/v1/auth/register').send({ email, password: 'P@ssword1', firstName: 'Back', lastName: 'Admin', role: 'SuperAdmin' });
    expect(registerResponse.status).toBe(201);
    const loginResponse = await request(app).post('/api/v1/auth/login').send({ email, password: 'P@ssword1' });
    expect(loginResponse.status).toBe(200);
    adminUserId = registerResponse.body.data.user.id;
    authToken = loginResponse.body.data.session.accessToken;

    const batch = await prisma.batch.findFirst() || await prisma.batch.create({ data: { name: 'BackBatch', code: 'BB', departmentId: (await prisma.department.findFirst())?.id || '', startDate: new Date(), endDate: new Date(Date.now() + 1000 * 60 * 60 * 24) } });
    batchId = batch.id;

    const course = await prisma.course.findFirst() || await prisma.course.create({ data: { title: 'BackCourse', code: `BC-${Date.now()}`, categoryId: (await prisma.courseCategory.findFirst())?.id || '', departmentId: (await prisma.department.findFirst())?.id || '', durationWeeks: 2, difficultyLevel: 'Beginner' } });
    courseId = course.id;

    const { data: supaStudent, error: studentError } = await supabaseAdmin.auth.admin.createUser({ email: `student-back-${Date.now()}@test.com`, password: 'Student1!', email_confirm: true });
    if (studentError || !supaStudent?.user?.id || !supaStudent.user.email) throw new Error('Failed to create student user for backdate tests');
    const userRec = await prisma.user.create({ data: { supabaseUserId: supaStudent.user.id, email: supaStudent.user.email, firstName: 'BackStu', lastName: 'Dent', passwordHash: '', userRoles: { create: { roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '' } } } });
    studentUserId = userRec.id;
    const studentRec = await prisma.student.create({ data: { userId: studentUserId, studentId: `STUB-${Date.now()}`, batchId, departmentId: (await prisma.department.findFirst())?.id || '' } });
    studentId = studentRec.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: [adminUserId, studentUserId] } },
          { createdBy: { in: [adminUserId, studentUserId] } },
        ],
      },
    }).catch(() => undefined);
    await prisma.attendanceAudit.deleteMany({}).catch(() => undefined);
    await prisma.attendanceRecord.deleteMany({}).catch(() => undefined);
    await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: [adminUserId, studentUserId] } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, studentUserId] } } }).catch(() => undefined);
  });

  it('allows backdating via classDate and keeps append-only audit trail', async () => {
    const classDate = new Date(); classDate.setDate(classDate.getDate() - 3);
    const recordResp = await request(app).post('/api/v1/attendance').set('Authorization', `Bearer ${authToken}`).send({ studentId, courseId, batchId, classDate: classDate.toISOString(), status: 'ABSENT' });
    expect(recordResp.status).toBe(201);
    const attendanceId = recordResp.body.data.id;

    // Correct backdated record
    const corr = await request(app).post('/api/v1/attendance/correct').set('Authorization', `Bearer ${authToken}`).send({ originalAttendanceId: attendanceId, newStatus: 'PRESENT', reason: 'Teacher updated' });
    expect(corr.status).toBe(200);

    const original = await prisma.attendanceRecord.findUnique({ where: { id: attendanceId } });
    expect(original).toBeDefined();
    expect(original?.status).toBe('ABSENT');

    const audits = await prisma.attendanceAudit.findMany({ where: { attendanceId } });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some((a: any) => a.newValue === 'PRESENT')).toBe(true);

    // Ensure latestStatus resolves to correction
    const historyResp = await request(app).get(`/api/v1/attendance/student/${studentId}`).set('Authorization', `Bearer ${authToken}`);
    expect(historyResp.status).toBe(200);
    const rec = historyResp.body.data.find((r:any) => r.id === attendanceId);
    expect(rec).toBeDefined();
    expect(rec.latestStatus).toBe('PRESENT');
  });
});
