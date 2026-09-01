"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionService = void 0;
const client_1 = require("../../../db/prisma/client");
class QuestionService {
    static async listQuestions(page = 1, limit = 20, filter = {}) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            client_1.prisma.question.findMany({ where: filter, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            client_1.prisma.question.count({ where: filter }),
        ]);
        return { items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    static async getQuestion(id) {
        return client_1.prisma.question.findUnique({ where: { id } });
    }
    static async createQuestion(data, userId) {
        const rec = await client_1.prisma.question.create({ data: { ...data, createdBy: userId } });
        // TODO: create initial version record when migrations available
        return rec;
    }
    static async updateQuestion(id, data, userId) {
        const updated = await client_1.prisma.question.update({ where: { id }, data: { ...data, updatedBy: userId } });
        // TODO: append version record
        return updated;
    }
    static async deleteQuestion(id, userId) {
        const deleted = await client_1.prisma.question.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: userId } });
        return deleted;
    }
}
exports.QuestionService = QuestionService;
exports.default = QuestionService;
