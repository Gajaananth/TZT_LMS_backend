import { prisma } from '@/db/prisma/client';
import { supabaseAdmin } from '@/lib/supabase';
import { FeeService } from '@/features/fees/services/fee.service';

describe('Fees integration', () => {
  let adminUserId: string;
  let studentUserId: string;
  let studentId: string;
  let batchId: string;
  let courseId: string;
  let feeStructureId: string;

  beforeAll(async () => {
    const { data: user, error: adminError } = await supabaseAdmin.auth.admin.createUser({ email: `fee-admin-${Date.now()}@test.com`, password: 'AdminPass1!', email_confirm: true });
    if (adminError || !user?.user?.id || !user.user.email) throw new Error('Failed to create admin user for fees tests');
    const admin = await prisma.user.create({ data: { supabaseUserId: user.user.id, email: user.user.email, firstName: 'Fee', lastName: 'Admin', passwordHash: '', userRoles: { create: { roleId: (await prisma.role.findUnique({ where: { name: 'SuperAdmin' } }))?.id || '' } } } });
    adminUserId = admin.id;

    const batch = await prisma.batch.findFirst() || await prisma.batch.create({ data: { name: 'FeeBatch', code: 'FB', departmentId: (await prisma.department.findFirst())?.id || '', startDate: new Date(), endDate: new Date(Date.now() + 1000 * 60 * 60 * 24) } });
    batchId = batch.id;

    const course = await prisma.course.findFirst() || await prisma.course.create({ data: { title: 'FeeCourse', code: `FC-${Date.now()}`, categoryId: (await prisma.courseCategory.findFirst())?.id || '', departmentId: (await prisma.department.findFirst())?.id || '', durationWeeks: 2, difficultyLevel: 'Beginner' } });
    courseId = course.id;

    const { data: supaStudent, error: studentError } = await supabaseAdmin.auth.admin.createUser({ email: `fee-stu-${Date.now()}@test.com`, password: 'Student1!', email_confirm: true });
    if (studentError || !supaStudent?.user?.id || !supaStudent.user.email) throw new Error('Failed to create student user for fees tests');
    const userRec = await prisma.user.create({ data: { supabaseUserId: supaStudent.user.id, email: supaStudent.user.email, firstName: 'FeeStu', lastName: 'Dent', passwordHash: '', userRoles: { create: { roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '' } } } });
    studentUserId = userRec.id;
    const studentRec = await prisma.student.create({ data: { userId: studentUserId, studentId: `FSTU-${Date.now()}`, batchId, departmentId: (await prisma.department.findFirst())?.id || '' } });
    studentId = studentRec.id;

    // create a fee structure with ruleValue: classesRequired = 1 so one attended class triggers invoice creation
    const fee = await prisma.feeStructure.create({ data: { batchId, courseId, name: 'AutoFee', description: 'Auto fee after attendance', amountPerClass: 500, classesRequired: 1, isActive: true, effectiveFrom: new Date(Date.now() - 1000 * 60 * 60), effectiveTo: new Date(Date.now() + 1000 * 60 * 60 * 24), createdBy: adminUserId } });
    feeStructureId = fee.id;
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
    await prisma.invoice.deleteMany({ where: { studentId } }).catch(() => undefined);
    await prisma.payment.deleteMany({ where: { studentId } }).catch(() => undefined);
    await prisma.attendanceAudit.deleteMany({}).catch(() => undefined);
    await prisma.attendanceRecord.deleteMany({}).catch(() => undefined);
    await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: [adminUserId, studentUserId] } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, studentUserId] } } }).catch(() => undefined);
  });

  it('creates an invoice when attendance threshold crossed', async () => {
    // create one attendance record marked present
    const classDate = new Date().toISOString();
    const rec = await prisma.attendanceRecord.create({ data: { studentId, courseId, batchId, classDate: new Date(classDate), status: 'PRESENT', createdBy: adminUserId } });

    // call the check directly
    const invoice = await FeeService.checkAndCreatePaymentDue(studentId, courseId, batchId, adminUserId);
    expect(invoice).not.toBeNull();

    const found = await prisma.invoice.findFirst({ where: { studentId, feeStructureId } });
    expect(found).toBeDefined();
    expect(found?.status).toBe('PENDING');
  });
});
