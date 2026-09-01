import { prisma } from '@/db/prisma/client';
import { parse as csvParse } from 'csv-parse/sync';

export class QuestionImportService {
  static async importFromJson(data: any[], userId: string) {
    const created: any[] = [];
    for (const q of data) {
      let category = null;
      if (q.categoryName) {
        category = await prisma.questionCategory.findFirst({ where: { name: q.categoryName } });
        if (!category) category = await prisma.questionCategory.create({ data: { name: q.categoryName } });
      }

      const normalizedOptions = q.options && typeof q.options === 'string' ? (() => { try { return JSON.parse(q.options); } catch { return null; } })() : q.options ?? null;

      const record = await prisma.question.create({
        data: {
          questionText: q.questionText,
          type: q.type,
          points: Number(q.points || 1),
          explanation: q.explanation || null,
          categoryId: category?.id || (q.categoryId || ''),
          difficulty: q.difficulty || 'medium',
          tags: q.tags ? (Array.isArray(q.tags) ? JSON.stringify(q.tags) : String(q.tags)) : null,
          correctAnswer: q.correctAnswer || null,
          options: normalizedOptions as any,
          createdBy: userId,
        },
      });

      created.push(record);
    }
    return created;
  }

  static async importFromCsv(content: string, userId: string) {
    const records = csvParse(content, { columns: true, skip_empty_lines: true });
    return this.importFromJson(records, userId);
  }

  static async exportAsJson(filter: any = {}) {
    const questions = await prisma.question.findMany({ where: filter });
    return questions;
  }

  static async exportAsCsv(filter: any = {}) {
    const questions = await prisma.question.findMany({ where: filter });
    const lines = [] as string[];
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

export default QuestionImportService;
