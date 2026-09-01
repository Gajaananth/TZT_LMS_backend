import { prisma } from '@/db/prisma/client';

export class CourseService {
  static async listCourses(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [courses, total] = await Promise.all([
      prisma.course.findMany({ skip, take: limit, include: { modules: { orderBy: { sequenceNumber: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
      prisma.course.count({ where: { deletedAt: null } }),
    ]);

    return { courses, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getCourse(id: string) {
    const course = await prisma.course.findUnique({ where: { id }, include: { modules: { include: { lessons: true }, orderBy: { sequenceNumber: 'asc' } }, category: true } });
    return course;
  }

  static async createCourse(data: any, userId: string) {
    const course = await prisma.course.create({ data: { ...data, createdBy: userId }, include: { modules: true } });
    await prisma.auditLog.create({ data: { userId, action: 'CREATE', tableName: 'Course', recordId: course.id, changes: { created: course }, createdBy: userId } });
    return course;
  }

  static async updateCourse(id: string, data: any, userId: string) {
    const updated = await prisma.course.update({ where: { id }, data: { ...data, updatedBy: userId } });
    await prisma.auditLog.create({ data: { userId, action: 'UPDATE', tableName: 'Course', recordId: id, changes: data, createdBy: userId } });
    return updated;
  }

  static async deleteCourse(id: string, userId: string) {
    const deleted = await prisma.course.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: userId } });
    await prisma.auditLog.create({ data: { userId, action: 'DELETE', tableName: 'Course', recordId: id, changes: { deleted: true }, createdBy: userId } });
    return deleted;
  }
}

export default CourseService;
