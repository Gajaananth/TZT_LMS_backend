import { prisma } from '@/db/prisma/client';

const VALID_TYPES = new Set([
  'MULTIPLE_CHOICE',
  'MULTIPLE_SELECT',
  'DROPDOWN',
  'TRUE_FALSE',
  'FILL_IN_BLANK',
  'SHORT_ANSWER',
  'ESSAY',
  'MATCHING',
  'ORDERING',
  'IMAGE',
  'AUDIO',
  'CODING',
]);

const NEEDS_OPTIONS = new Set(['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'DROPDOWN']);
const MANUAL_TYPES = new Set(['ESSAY', 'MATCHING', 'ORDERING', 'IMAGE', 'AUDIO', 'CODING']);

const normalizeType = (t: any): string | null => {
  if (typeof t !== 'string') return null;
  const v = t.trim().toUpperCase().replace(/[- ]/g, '_');
  // Map common aliases
  if (v === 'MCQ') return 'MULTIPLE_CHOICE';
  if (v === 'MSQ' || v === 'MULTIPLESELECT') return 'MULTIPLE_SELECT';
  if (v === 'TF' || v === 'TRUEFALSE') return 'TRUE_FALSE';
  if (v === 'FIB' || v === 'FILLINBLANK') return 'FILL_IN_BLANK';
  if (v === 'SHORTANSWER') return 'SHORT_ANSWER';
  if (v === 'DROP_DOWN') return 'DROPDOWN';
  return VALID_TYPES.has(v) ? v : null;
};

const ensureCategoryId = async (categoryId?: string): Promise<string> => {
  if (typeof categoryId === 'string' && categoryId.length > 0) return categoryId;
  let existing = await prisma.questionCategory.findFirst({ where: { name: 'General' } });
  if (!existing) {
    existing = await prisma.questionCategory.create({ data: { name: 'General' } });
  }
  return existing.id;
};

const normalizeOptionsArray = (options: unknown): string[] | null => {
  if (!Array.isArray(options)) return null;
  const arr = options.map((o) => (o === null || o === undefined ? '' : String(o)));
  if (arr.length === 0) return null;
  return arr;
};

const normalizeTrueFalseString = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 't' || s === 'y') return 'True';
  if (s === 'false' || s === '0' || s === 'no' || s === 'f' || s === 'n') return 'False';
  return null;
};

/**
 * Validate and coerce a question payload.
 * Returns a ready-to-save Prisma Question data object or throws a descriptive Error.
 */
const validateAndCoerceQuestionPayload = async (
  raw: any,
): Promise<{
  questionText: string;
  type: string;
  points: number;
  difficulty: string;
  categoryId: string;
  tags?: string | null;
  explanation?: string | null;
  options: unknown;
  correctAnswer: unknown;
}> => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid question payload');

  const questionText = typeof raw.questionText === 'string' ? raw.questionText.trim() : '';
  if (!questionText) throw new Error('questionText is required');

  const type = normalizeType(raw.type);
  if (!type) {
    throw new Error(
      `Invalid question type. Supported: ${Array.from(VALID_TYPES).join(', ')}`,
    );
  }

  const points =
    typeof raw.points === 'number'
      ? Math.max(1, Math.floor(raw.points))
      : Number.isFinite(Number(raw.points))
        ? Math.max(1, Math.floor(Number(raw.points)))
        : 1;

  const difficulty =
    typeof raw.difficulty === 'string' && raw.difficulty.trim().length > 0
      ? raw.difficulty.trim().toLowerCase()
      : 'medium';

  const explanation =
    typeof raw.explanation === 'string' && raw.explanation.trim().length > 0
      ? raw.explanation.trim()
      : null;

  const tags =
    typeof raw.tags === 'string' && raw.tags.trim().length > 0 ? raw.tags.trim() : null;

  const categoryId = await ensureCategoryId(raw.categoryId);

  let options: string[] | null = null;
  if (NEEDS_OPTIONS.has(type)) {
    options = normalizeOptionsArray(raw.options);
    if (!options) throw new Error(`options (non-empty array) is required for type ${type}`);
    if (type !== 'MULTIPLE_SELECT' && options.length < 2) {
      throw new Error(`${type} requires at least 2 options`);
    }
    if (type === 'MULTIPLE_SELECT' && options.length < 2) {
      throw new Error(`MULTIPLE_SELECT requires at least 2 options`);
    }
  } else if (type === 'TRUE_FALSE') {
    options = ['True', 'False'];
  } else {
    options = normalizeOptionsArray(raw.options); // optional for other types; stored as-is
  }

  // correctAnswer handling
  let correctAnswer: unknown = raw.correctAnswer ?? null;
  const requiresCorrect = !MANUAL_TYPES.has(type);
  if (requiresCorrect) {
    if (correctAnswer === null || correctAnswer === undefined || correctAnswer === '') {
      throw new Error(`correctAnswer is required for question type ${type}`);
    }
  } else {
    // Essay/manual: correctAnswer optional, but normalize to null if empty
    if (
      correctAnswer === null ||
      correctAnswer === undefined ||
      (typeof correctAnswer === 'string' && correctAnswer.trim() === '') ||
      (Array.isArray(correctAnswer) && correctAnswer.length === 0)
    ) {
      correctAnswer = null;
    }
  }

  // Per-type normalization of correctAnswer
  switch (type) {
    case 'MULTIPLE_CHOICE':
    case 'DROPDOWN': {
      // Accept number index, stringified number index, or option text.
      // Keep as either number (if numeric and within range) or text string.
      if (Array.isArray(correctAnswer)) {
        if (correctAnswer.length === 0) throw new Error('correctAnswer cannot be empty');
        correctAnswer = correctAnswer[0];
      }
      if (typeof correctAnswer === 'string') {
        const trimmed = correctAnswer.trim();
        if (/^\d+$/.test(trimmed)) {
          const idx = Number(trimmed);
          if (options && idx >= options.length) {
            throw new Error(
              `correctAnswer index ${idx} out of range (options.length=${options.length})`,
            );
          }
          correctAnswer = idx;
        } else if (options && !options.includes(trimmed)) {
          throw new Error(`correctAnswer "${trimmed}" is not one of the options`);
        }
      } else if (typeof correctAnswer === 'number') {
        if (!Number.isInteger(correctAnswer)) throw new Error('correctAnswer index must be integer');
        if (options && (correctAnswer < 0 || correctAnswer >= options.length)) {
          throw new Error(
            `correctAnswer index ${correctAnswer} out of range (options.length=${options.length})`,
          );
        }
      } else {
        throw new Error('correctAnswer must be a number index or option text');
      }
      break;
    }
    case 'MULTIPLE_SELECT': {
      // Must be array of indices or option texts (or mixed).
      if (!Array.isArray(correctAnswer)) {
        // Accept single value but wrap in array.
        correctAnswer = [correctAnswer];
      }
      if ((correctAnswer as any[]).length === 0) {
        throw new Error('MULTIPLE_SELECT requires at least one correct answer');
      }
      correctAnswer = (correctAnswer as any[]).map((v) => {
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (/^\d+$/.test(trimmed)) {
            const idx = Number(trimmed);
            if (options && (idx < 0 || idx >= options.length)) {
              throw new Error(`correctAnswer index ${idx} out of range`);
            }
            return idx;
          }
          if (options && !options.includes(trimmed)) {
            throw new Error(`correctAnswer "${trimmed}" is not one of the options`);
          }
          return trimmed;
        } else if (typeof v === 'number') {
          if (!Number.isInteger(v)) throw new Error('correctAnswer indices must be integers');
          if (options && (v < 0 || v >= options.length)) {
            throw new Error(`correctAnswer index ${v} out of range`);
          }
          return v;
        }
        throw new Error('correctAnswer entries must be indices or option text strings');
      });
      break;
    }
    case 'TRUE_FALSE': {
      const tf = normalizeTrueFalseString(correctAnswer);
      if (!tf) throw new Error('correctAnswer must be "True" or "False"');
      correctAnswer = tf;
      break;
    }
    case 'FILL_IN_BLANK':
    case 'SHORT_ANSWER': {
      // Accept string or string array. Store as string or string[].
      if (Array.isArray(correctAnswer)) {
        correctAnswer = (correctAnswer as any[])
          .map((s) => (typeof s === 'string' ? s.trim() : s === null || s === undefined ? '' : String(s).trim()))
          .filter((s) => s !== '');
        if ((correctAnswer as any[]).length === 0) {
          throw new Error('correctAnswer cannot be an empty array');
        }
      } else if (typeof correctAnswer === 'string') {
        const t = correctAnswer.trim();
        if (t === '') throw new Error('correctAnswer cannot be empty');
        correctAnswer = t;
      } else {
        correctAnswer = String(correctAnswer).trim();
      }
      break;
    }
    default:
      // Manual types: leave as-is or null
      break;
  }

  return {
    questionText,
    type,
    points,
    difficulty,
    categoryId,
    tags,
    explanation,
    options,
    correctAnswer,
  };
};

export class QuestionService {
  static async listQuestions(page = 1, limit = 20, filter: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null, ...(filter || {}) };
    const [items, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.question.count({ where }),
    ]);
    return {
      data: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getQuestion(id: string) {
    return prisma.question.findUnique({ where: { id } });
  }

  static async createQuestion(data: any, userId: string) {
    const validated = await validateAndCoerceQuestionPayload(data);
    return prisma.question.create({
      data: {
        ...validated,
        type: validated.type as any,
        options: validated.options as any,
        correctAnswer: validated.correctAnswer as any,
        createdBy: userId,
        updatedBy: userId,
      } as any,
    });
  }

  static async updateQuestion(id: string, data: any, userId: string) {
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) throw new Error('Question not found');
    // Merge: caller may send partial fields. Preserve existing values for any omitted.
    const merged: any = {
      questionText: data.questionText ?? existing.questionText,
      type: data.type ?? existing.type,
      points: data.points ?? existing.points,
      difficulty: data.difficulty ?? existing.difficulty,
      categoryId: data.categoryId ?? existing.categoryId,
      tags: data.tags ?? existing.tags ?? null,
      explanation: data.explanation ?? existing.explanation ?? null,
      options: data.options !== undefined ? data.options : existing.options,
      correctAnswer:
        data.correctAnswer !== undefined ? data.correctAnswer : (existing as any).correctAnswer,
    };
    const validated = await validateAndCoerceQuestionPayload(merged);
    return prisma.question.update({
      where: { id },
      data: {
        ...validated,
        type: validated.type as any,
        options: validated.options as any,
        correctAnswer: validated.correctAnswer as any,
        updatedBy: userId,
      } as any,
    });
  }

  static async deleteQuestion(id: string, userId: string) {
    return prisma.question.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
  }
}

export default QuestionService;
