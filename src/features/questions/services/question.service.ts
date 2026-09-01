import { prisma } from '@/db/prisma/client';

export class QuestionService {
  static async listQuestions(page = 1, limit = 20, filter: any = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.question.findMany({ where: filter, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.question.count({ where: filter }),
    ]);
    return { items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getQuestion(id: string) {
    return prisma.question.findUnique({ where: { id } });
  }

  static async createQuestion(data: any, userId: string) {
    const rec = await prisma.question.create({ data: { ...data, createdBy: userId } });
    // TODO: create initial version record when migrations available
    return rec;
  }

  static async updateQuestion(id: string, data: any, userId: string) {
    const updated = await prisma.question.update({ where: { id }, data: { ...data, updatedBy: userId } });
    // TODO: append version record
    return updated;
  }

  static async deleteQuestion(id: string, userId: string) {
    const deleted = await prisma.question.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: userId } });
    return deleted;
  }
}

export default QuestionService;
