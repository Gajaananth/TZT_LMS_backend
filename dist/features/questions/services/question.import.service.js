"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionImportService = void 0;
const client_1 = require("../../../db/prisma/client");
const sync_1 = require("csv-parse/sync");
class QuestionImportService {
    static async importFromJson(data, userId) {
        const created = [];
        for (const q of data) {
            let category = null;
            if (q.categoryName) {
                category = await client_1.prisma.questionCategory.findFirst({ where: { name: q.categoryName } });
                if (!category)
                    category = await client_1.prisma.questionCategory.create({ data: { name: q.categoryName } });
            }
            const normalizedOptions = q.options && typeof q.options === 'string' ? (() => { try {
                return JSON.parse(q.options);
            }
            catch {
                return null;
            } })() : q.options ?? null;
            const record = await client_1.prisma.question.create({
                data: {
                    questionText: q.questionText,
                    type: q.type,
                    points: Number(q.points || 1),
                    explanation: q.explanation || null,
                    categoryId: category?.id || (q.categoryId || ''),
                    difficulty: q.difficulty || 'medium',
                    tags: q.tags ? (Array.isArray(q.tags) ? JSON.stringify(q.tags) : String(q.tags)) : null,
                    correctAnswer: q.correctAnswer || null,
                    options: normalizedOptions,
                    createdBy: userId,
                },
            });
            created.push(record);
        }
        return created;
    }
    static async importFromCsv(content, userId) {
        const records = (0, sync_1.parse)(content, { columns: true, skip_empty_lines: true });
        return this.importFromJson(records, userId);
    }
    static async exportAsJson(filter = {}) {
        const questions = await client_1.prisma.question.findMany({ where: filter });
        return questions;
    }
    static async exportAsCsv(filter = {}) {
        const questions = await client_1.prisma.question.findMany({ where: filter });
        const lines = [];
        const header = ['questionText', 'type', 'points', 'explanation', 'categoryId', 'difficulty', 'tags', 'correctAnswer', 'options'];
        lines.push(header.join(','));
        for (const q of questions) {
            const row = [
                `"${String(q.questionText).replace(/"/g, '""')}"`,
                q.type,
                q.points,
                `"${String(q.explanation || '').replace(/"/g, '""')}"`,
                q.categoryId || '',
                q.difficulty || '',
                `"${String(q.tags || '')}"`,
                `"${String(q.correctAnswer || '')}"`,
                `"${String(q.options ? JSON.stringify(q.options) : '')}"`,
            ];
            lines.push(row.join(','));
        }
        return lines.join('\n');
    }
}
exports.QuestionImportService = QuestionImportService;
exports.default = QuestionImportService;
