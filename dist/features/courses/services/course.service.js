"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseService = void 0;
const client_1 = require("../../../db/prisma/client");
class CourseService {
    static async listCourses(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [courses, total] = await Promise.all([
            client_1.prisma.course.findMany({ skip, take: limit, include: { modules: { orderBy: { sequenceNumber: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
            client_1.prisma.course.count({ where: { deletedAt: null } }),
        ]);
        return { courses, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    static async getCourse(id) {
        const course = await client_1.prisma.course.findUnique({ where: { id }, include: { modules: { include: { lessons: true }, orderBy: { sequenceNumber: 'asc' } }, category: true } });
        return course;
    }
    static async createCourse(data, userId) {
        const course = await client_1.prisma.course.create({ data: { ...data, createdBy: userId }, include: { modules: true } });
        await client_1.prisma.auditLog.create({ data: { userId, action: 'CREATE', tableName: 'Course', recordId: course.id, changes: { created: course }, createdBy: userId } });
        return course;
    }
    static async updateCourse(id, data, userId) {
        const updated = await client_1.prisma.course.update({ where: { id }, data: { ...data, updatedBy: userId } });
        await client_1.prisma.auditLog.create({ data: { userId, action: 'UPDATE', tableName: 'Course', recordId: id, changes: data, createdBy: userId } });
        return updated;
    }
    static async deleteCourse(id, userId) {
        const deleted = await client_1.prisma.course.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: userId } });
        await client_1.prisma.auditLog.create({ data: { userId, action: 'DELETE', tableName: 'Course', recordId: id, changes: { deleted: true }, createdBy: userId } });
        return deleted;
    }
}
exports.CourseService = CourseService;
exports.default = CourseService;
