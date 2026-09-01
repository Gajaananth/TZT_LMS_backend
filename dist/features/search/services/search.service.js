"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const client_1 = require("../../../db/prisma/client");
class SearchService {
    static async globalSearch(q, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const query = q.trim();
        // Simple search across a few models - expand as needed
        const [students, teachers, courses, lessons] = await Promise.all([
            client_1.prisma.student.findMany({ where: { studentId: { contains: query } }, take: limit, skip }),
            client_1.prisma.teacher.findMany({ where: { employeeId: { contains: query } }, take: limit, skip }),
            client_1.prisma.course.findMany({ where: { title: { contains: query } }, take: limit, skip }),
            client_1.prisma.lesson.findMany({ where: { title: { contains: query } }, take: limit, skip }),
        ]);
        return { students, teachers, courses, lessons };
    }
}
exports.SearchService = SearchService;
exports.default = SearchService;
