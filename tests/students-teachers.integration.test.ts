import request from 'supertest';
import app from '@/server';
import { prisma } from '@/db/prisma/client';
import { supabaseAdmin } from '@/lib/supabase';

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('Student Management API', () => {
  let authToken: string;
  let userId: string;
  let studentId: string;
  let batchId: string;
  let departmentId: string;
  let courseId: string;

  beforeAll(async () => {
    const email = `admin-test-${Date.now()}@test.com`;
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'TestPassword123!', firstName: 'Admin', lastName: 'Test', role: 'SuperAdmin' });
    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123!' });
    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.session.accessToken;
    userId = registerResponse.body.data.user.id;

    // Get or create test batch and department
    const dept = await prisma.department.findFirst();
    if (!dept) {
      const newDept = await prisma.department.create({
        data: { name: 'CS', code: 'CS' },
      });
      departmentId = newDept.id;
    } else {
      departmentId = dept.id;
    }

    const batch = await prisma.batch.findFirst();
    if (!batch) {
      const newBatch = await prisma.batch.create({
        data: {
          name: 'Batch 2024',
          code: 'B2024',
          departmentId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
      batchId = newBatch.id;
    } else {
      batchId = batch.id;
    }

    const course = await prisma.course.findFirst();
    if (!course) {
      const category = await prisma.courseCategory.findFirst();
      let categoryId = category?.id;

      if (!categoryId) {
        const newCategory = await prisma.courseCategory.create({
          data: { name: 'Programming' },
        });
        categoryId = newCategory.id;
      }

      const newCourse = await prisma.course.create({
        data: {
          title: 'Introduction to Programming',
          code: 'CS101',
          categoryId,
          departmentId,
          durationWeeks: 12,
          difficultyLevel: 'Beginner',
        },
      });
      courseId = newCourse.id;
    } else {
      courseId = course.id;
    }
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: 'student-test-' } } },
          { createdBy: { contains: 'student-test-' } },
        ],
      },
    }).catch(() => undefined);

    await prisma.guardian.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.emergencyContact.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.academicHistory.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.studentProgress.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.enrollment.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.attendanceRecord.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.invoice.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.payment.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.certificate.deleteMany({
      where: {
        student: { user: { email: { contains: 'student-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.student.deleteMany({
      where: {
        user: { email: { contains: 'student-test-' } },
      },
    }).catch(() => undefined);

    await prisma.userRole.deleteMany({
      where: {
        user: { email: { contains: 'student-test-' } },
      },
    }).catch(() => undefined);

    await prisma.user.deleteMany({
      where: {
        email: { contains: 'student-test-' },
      },
    }).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { user: { email: { contains: 'test-' } } },
          { createdBy: { contains: 'test-' } },
        ],
      },
    }).catch(() => undefined);

    await prisma.guardian.deleteMany({
      where: {
        student: { user: { email: { contains: 'test-' } } },
      },
    }).catch(() => undefined);

    await prisma.student.deleteMany({
      where: {
        user: { email: { contains: 'test-' } },
      },
    }).catch(() => undefined);

    await prisma.userRole.deleteMany({
      where: {
        user: { email: { contains: 'test-' } },
      },
    }).catch(() => undefined);

    await prisma.user.deleteMany({
      where: {
        email: { contains: 'test-' },
      },
    }).catch(() => undefined);
  });

  describe('POST /api/v1/students', () => {
    it('should create a new student with required fields', async () => {
      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: `student-test-${uniqueSuffix()}@test.com`,
          password: 'SecurePass123!',
          batchId,
          departmentId,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.studentId).toBeDefined();
      studentId = response.body.data.id;
    });

    it('should create student with guardian information', async () => {
      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: `student-test-${uniqueSuffix()}@test.com`,
          password: 'SecurePass123!',
          batchId,
          departmentId,
          guardianFirstName: 'Parent',
          guardianLastName: 'Smith',
          guardianRelationship: 'Parent',
          guardianPhone: '+1234567890',
          guardianEmail: 'parent@test.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.guardian).toBeDefined();
      expect(response.body.data.guardian.firstName).toBe('Parent');
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          // Missing lastName, email, password, batchId, departmentId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          password: 'SecurePass123!',
          batchId,
          departmentId,
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 with short password', async () => {
      const response = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: `student-test-${uniqueSuffix()}@test.com`,
          password: 'short',
          batchId,
          departmentId,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/students', () => {
    beforeEach(async () => {
      // Create test students
      for (let i = 0; i < 3; i++) {
        const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
          email: `student-test-${uniqueSuffix()}-${i}@test.com`,
          password: 'TestPass123!',
          email_confirm: true,
        });

        const authUser = supabaseUser?.user;
        if (authUser?.id && authUser.email) {
          const user = await prisma.user.create({
            data: {
              supabaseUserId: authUser.id,
              email: authUser.email,
              firstName: `Student${i}`,
              lastName: `Test`,
              passwordHash: '',
              userRoles: {
                create: {
                  roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '',
                },
              },
            },
          });

          await prisma.student.create({
            data: {
              userId: user.id,
              studentId: `STU-${uniqueSuffix()}-${i}`,
              batchId,
              departmentId,
            },
          });
        }
      }
    });

    it('should list all students with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.students)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should list students with pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/students?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.students.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should filter students by batch', async () => {
      const response = await request(app)
        .get(`/api/v1/students?batchId=${batchId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.students.every((s: any) => s.batchId === batchId)).toBe(true);
    });

    it('should search students by name', async () => {
      const response = await request(app)
        .get('/api/v1/students?search=Student0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.students.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/students/:id', () => {
    beforeEach(async () => {
      const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
        email: `student-test-${uniqueSuffix()}@test.com`,
        password: 'TestPass123!',
        email_confirm: true,
      });

      const authUser = supabaseUser?.user;
      if (authUser?.id && authUser.email) {
        const user = await prisma.user.create({
          data: {
            supabaseUserId: authUser.id,
            email: authUser.email,
            firstName: 'GetTest',
            lastName: 'Student',
            passwordHash: '',
            userRoles: {
              create: {
                roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '',
              },
            },
          },
        });

        const student = await prisma.student.create({
          data: { userId: user.id, studentId: `STU-GET-${uniqueSuffix()}`, batchId, departmentId },
        });

        studentId = student.id;
      }
    });

    it('should retrieve a student by ID with full details', async () => {
      const response = await request(app)
        .get(`/api/v1/students/${studentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(studentId);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.batch).toBeDefined();
      expect(response.body.data.department).toBeDefined();
    });

    it('should return 404 for non-existent student', async () => {
      const response = await request(app)
        .get('/api/v1/students/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/students/:id', () => {
    beforeEach(async () => {
      const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
        email: `student-test-${uniqueSuffix()}@test.com`,
        password: 'TestPass123!',
        email_confirm: true,
      });

      const authUser = supabaseUser?.user;
      if (authUser?.id && authUser.email) {
        const user = await prisma.user.create({
          data: {
            supabaseUserId: authUser.id,
            email: authUser.email,
            firstName: 'UpdateTest',
            lastName: 'Student',
            passwordHash: '',
            userRoles: {
              create: {
                roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '',
              },
            },
          },
        });

        const student = await prisma.student.create({
          data: { userId: user.id, studentId: `STU-UPDATE-${uniqueSuffix()}`, batchId, departmentId },
        });

        studentId = student.id;
      }
    });

    it('should update student information', async () => {
      const response = await request(app)
        .patch(`/api/v1/students/${studentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'UpdatedFirstName',
          city: 'New City',
          state: 'New State',
          country: 'USA',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.city).toBe('New City');
    });

    it('should return 404 for non-existent student', async () => {
      const response = await request(app)
        .patch('/api/v1/students/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ city: 'New City' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/students/:id', () => {
    beforeEach(async () => {
      const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
        email: `student-test-${uniqueSuffix()}@test.com`,
        password: 'TestPass123!',
        email_confirm: true,
      });

      const authUser = supabaseUser?.user;
      if (authUser?.id && authUser.email) {
        const user = await prisma.user.create({
          data: {
            supabaseUserId: authUser.id,
            email: authUser.email,
            firstName: 'DeleteTest',
            lastName: 'Student',
            passwordHash: '',
            userRoles: {
              create: {
                roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '',
              },
            },
          },
        });

        const student = await prisma.student.create({
          data: { userId: user.id, studentId: `STU-DELETE-${uniqueSuffix()}`, batchId, departmentId },
        });

        studentId = student.id;
      }
    });

    it('should soft delete a student', async () => {
      const response = await request(app)
        .delete(`/api/v1/students/${studentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Verify student is soft deleted
      const student = await prisma.student.findUnique({
        where: { id: studentId },
      });
      expect(student?.deletedAt).not.toBeNull();
    });

    it('should return 404 for non-existent student', async () => {
      const response = await request(app)
        .delete('/api/v1/students/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/students/:id/enroll', () => {
    beforeEach(async () => {
      const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
        email: `student-test-${uniqueSuffix()}@test.com`,
        password: 'TestPass123!',
        email_confirm: true,
      });

      const authUser = supabaseUser?.user;
      if (authUser?.id && authUser.email) {
        const user = await prisma.user.create({
          data: {
            supabaseUserId: authUser.id,
            email: authUser.email,
            firstName: 'EnrollTest',
            lastName: 'Student',
            passwordHash: '',
            userRoles: {
              create: {
                roleId: (await prisma.role.findUnique({ where: { name: 'Student' } }))?.id || '',
              },
            },
          },
        });

        const student = await prisma.student.create({
          data: { userId: user.id, studentId: `STU-ENROLL-${uniqueSuffix()}`, batchId, departmentId },
        });

        studentId = student.id;
      }
    });

    it('should enroll student in a course', async () => {
      const response = await request(app)
        .post(`/api/v1/students/${studentId}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId,
          batchId,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('active');
    });

    it('should return 400 without required fields', async () => {
      const response = await request(app)
        .post(`/api/v1/students/${studentId}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/students/:id/enrollments', () => {
    it('should retrieve student enrollments', async () => {
      const response = await request(app)
        .get(`/api/v1/students/${studentId}/enrollments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/students/:id/attendance', () => {
    it('should retrieve student attendance records', async () => {
      const response = await request(app)
        .get(`/api/v1/students/${studentId}/attendance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});

describe('Teacher Management API', () => {
  let authToken: string;
  let teacherId: string;
  let courseId: string;
  let batchId: string;

  beforeAll(async () => {
    const email = `admin-teacher-${Date.now()}@test.com`;
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'TestPassword123!', firstName: 'Teacher', lastName: 'Admin', role: 'SuperAdmin' });
    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123!' });
    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.data.session.accessToken;

    const dept = await prisma.department.findFirst();
    const batch = await prisma.batch.findFirst();
    const course = await prisma.course.findFirst();

    batchId = batch?.id || '';
    courseId = course?.id || '';
  });

  afterEach(async () => {
    await prisma.teacherAssignment.deleteMany({
      where: {
        teacher: { user: { email: { contains: 'teacher-test-' } } },
      },
    }).catch(() => undefined);

    await prisma.teacher.deleteMany({
      where: {
        user: { email: { contains: 'teacher-test-' } },
      },
    }).catch(() => undefined);

    await prisma.userRole.deleteMany({
      where: {
        user: { email: { contains: 'teacher-test-' } },
      },
    }).catch(() => undefined);

    await prisma.user.deleteMany({
      where: {
        email: { contains: 'teacher-test-' },
      },
    }).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.teacherAssignment.deleteMany({
      where: {
        teacher: { user: { email: { contains: 'teacher-' } } },
      },
    }).catch(() => undefined);

    await prisma.teacher.deleteMany({
      where: {
        user: { email: { contains: 'teacher-' } },
      },
    }).catch(() => undefined);

    await prisma.userRole.deleteMany({
      where: {
        user: { email: { contains: 'teacher-' } },
      },
    }).catch(() => undefined);

    await prisma.user.deleteMany({
      where: {
        email: { contains: 'teacher-' },
      },
    }).catch(() => undefined);
  });

  describe('POST /api/v1/teachers', () => {
    it('should create a new teacher', async () => {
      const response = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Professor',
          email: `teacher-test-${uniqueSuffix()}@test.com`,
          password: 'SecurePass123!',
          specialization: 'Mathematics',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.employeeId).toBeDefined();
      teacherId = response.body.data.id;
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/teachers', () => {
    beforeEach(async () => {
      for (let i = 0; i < 2; i++) {
        const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
          email: `teacher-test-${uniqueSuffix()}-${i}@test.com`,
          password: 'TestPass123!',
          email_confirm: true,
        });

        const authUser = supabaseUser?.user;
        if (authUser?.id && authUser.email) {
          const user = await prisma.user.create({
            data: {
              supabaseUserId: authUser.id,
              email: authUser.email,
              firstName: `Teacher${i}`,
              lastName: `Test`,
              passwordHash: '',
              userRoles: {
                create: {
                  roleId: (await prisma.role.findUnique({ where: { name: 'Teacher' } }))?.id || '',
                },
              },
            },
          });

          await prisma.teacher.create({
            data: {
              userId: user.id,
              employeeId: `TCH-${uniqueSuffix()}-${i}`,
              specialization: 'Math',
            },
          });
        }
      }
    });

    it('should list all teachers', async () => {
      const response = await request(app)
        .get('/api/v1/teachers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.teachers)).toBe(true);
    });

    it('should filter teachers by specialization', async () => {
      const response = await request(app)
        .get('/api/v1/teachers?specialization=Math')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/v1/teachers/:id/assign', () => {
    beforeEach(async () => {
      const { data: supabaseUser } = await supabaseAdmin.auth.admin.createUser({
        email: `teacher-test-${uniqueSuffix()}@test.com`,
        password: 'TestPass123!',
        email_confirm: true,
      });

      const authUser = supabaseUser?.user;
      if (authUser?.id && authUser.email) {
        const user = await prisma.user.create({
          data: {
            supabaseUserId: authUser.id,
            email: authUser.email,
            firstName: 'AssignTest',
            lastName: 'Teacher',
            passwordHash: '',
            userRoles: {
              create: {
                roleId: (await prisma.role.findUnique({ where: { name: 'Teacher' } }))?.id || '',
              },
            },
          },
        });

        const teacher = await prisma.teacher.create({
          data: { userId: user.id, employeeId: `TCH-ASSIGN-${uniqueSuffix()}` },
        });

        teacherId = teacher.id;
      }
    });

    it('should assign teacher to a course', async () => {
      const response = await request(app)
        .post(`/api/v1/teachers/${teacherId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          courseId,
          batchId,
          assignmentType: 'teaching',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.assignmentType).toBe('teaching');
    });
  });
});
