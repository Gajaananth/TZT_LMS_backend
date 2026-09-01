import request from 'supertest';
import app from '../server';
import prisma from '../db/prisma/client';
import { supabaseAdmin } from '../lib/supabase';

const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

describe('Auth Routes', () => {

  // Clean up test data after each test
  afterEach(async () => {
    const emails = [
      'test@example.com',
      'testlogin@example.com',
      'newuser@example.com',
      'testme@example.com',
      'middleware@example.com',
    ];

    await prisma.userRole.deleteMany({
      where: {
        user: {
          email: {
            in: emails
          }
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: emails
        }
      }
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('register-user'),
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(response.body.data.user.email);
      expect(response.body.data.user.firstName).toBe('John');
      expect(response.body.data.user.lastName).toBe('Doe');
      expect(response.body.data.user.userRoles).toBeDefined();
      expect(response.body.data.user.userRoles.length).toBeGreaterThan(0);
    });

    it('should assign default Student role to new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('new-user'),
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith'
        });

      expect(response.status).toBe(201);
      const userRoles = response.body.data.user.userRoles;
      const hasStudentRole = userRoles.some((ur: any) => ur.role.name === 'Student');
      expect(hasStudentRole).toBe(true);
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for password too short', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('short-password-user'),
          password: 'short',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail('missing-name-user'),
          password: 'password123'
          // Missing firstName and lastName
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let loginEmail: string;

    beforeEach(async () => {
      loginEmail = uniqueEmail('login-user');
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: loginEmail,
          password: 'password123',
          firstName: 'Login',
          lastName: 'Test'
        });
    });

    it('should successfully login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: loginEmail,
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.accessToken).toBeDefined();
      expect(response.body.data.session.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: loginEmail,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully logout', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/password-reset-request', () => {
    it('should successfully request password reset', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password-reset-request')
        .send({
          email: uniqueEmail('reset-user')
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password-reset-request')
        .send({
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let validToken: string;
    let testUser: any;

    beforeEach(async () => {
      const email = uniqueEmail('me-user');
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'password123',
          firstName: 'Me',
          lastName: 'Test'
        });

      testUser = registerResponse.body.data?.user;

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'password123'
        });

      validToken = loginResponse.body.data.session.accessToken;
    });

    afterEach(async () => {
      if (testUser) {
        await prisma.userRole.deleteMany({
          where: { user: { email: testUser.email } }
        });
        await prisma.user.deleteMany({
          where: { email: testUser.email }
        });
      }
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBeTruthy();
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', validToken);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/sync', () => {
    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sync');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/sync')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('Auth Middleware', () => {
  let validToken: string;
  let testUser: any;

  beforeEach(async () => {
    const email = uniqueEmail('middleware-user');
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        firstName: 'Middleware',
        lastName: 'Test'
      });

    testUser = registerResponse.body.data?.user;

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'password123'
      });

    validToken = loginResponse.body.data.session.accessToken;
  });

  afterEach(async () => {
    if (testUser) {
      await prisma.userRole.deleteMany({
        where: { user: { email: testUser.email } }
      });
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
    }
  });

  describe('requireAuth middleware', () => {
    it('should allow requests with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('No token provided');
    });

    it('should reject requests with expired/invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer expired.invalid.token');

      expect(response.status).toBe(401);
    });

    it('should reject requests with wrong Bearer format', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('No token provided');
    });
  });
});
