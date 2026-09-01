import { prisma } from '@/db/prisma/client';

export class SearchService {
  static async globalSearch(q: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = q.trim();

    // Simple search across a few models - expand as needed
    const [students, teachers, courses, lessons] = await Promise.all([
      prisma.student.findMany({ where: { studentId: { contains: query } }, take: limit, skip }),
      prisma.teacher.findMany({ where: { employeeId: { contains: query } }, take: limit, skip }),
      prisma.course.findMany({ where: { title: { contains: query } }, take: limit, skip }),
      prisma.lesson.findMany({ where: { title: { contains: query } }, take: limit, skip }),
    ]);

    return { students, teachers, courses, lessons };
  }
}

export default SearchService;
