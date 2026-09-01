import { prisma } from '@/db/prisma/client';
import GradingService from '../../../features/grading/services/grading.service';

const normalizeQuestionType = (type?: string) => {
  const value = (type || '').toUpperCase();
  if (value === 'MULTIPLE_CHOICE') return 'MCQ';
  if (value === 'TRUE_FALSE') return 'True_False';
  if (value === 'SHORT_ANSWER') return 'Short_Answer';
  if (value === 'ESSAY') return 'Essay';
  return type || 'Short_Answer';
};

export class ExamService {
  static async listExams(filters: { status?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;
    const now = new Date();

    const exams = await prisma.exam.findMany({
      skip,
      take: limit,
      include: {
        examQuestions: { select: { id: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    // Calculate status for each exam
    const results = exams.map((exam: any) => ({
      ...exam,
      status:
        now < new Date(exam.startDate ?? new Date())
          ? 'Upcoming'
          : now > new Date(exam.endDate ?? new Date())
            ? 'Closed'
            : 'Active',
      questionCount: exam.examQuestions.length,
    }));

    return results;
  }

  static async getExam(examId: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: { select: { id: true } },
      },
    });

    if (!exam) throw new Error('Exam not found');

    const now = new Date();
    return {
      ...exam,
      status:
        now < new Date(exam.startDate ?? new Date())
          ? 'Upcoming'
          : now > new Date(exam.endDate ?? new Date())
            ? 'Closed'
            : 'Active',
    };
  }

  static async getExamWithQuestions(examId: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: {
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                type: true,
                points: true,
                options: true,
                correctAnswer: true,
                explanation: true,
              },
            },
          },
        },
      },
    });

    if (!exam) throw new Error('Exam not found');
    return {
      ...exam,
      questions: exam.examQuestions.map((eq: any) => ({
        ...eq.question,
        type: normalizeQuestionType(eq.question.type),
      })),
    };
  }

  static async getExamQuestions(examId: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: {
          include: {
            question: {
              select: {
                id: true,
                questionText: true,
                type: true,
                points: true,
                options: true,
                // NOTE: correctAnswer and explanation deliberately excluded for student security
                // These are only revealed after exam submission during grading
              },
            },
          },
        },
      },
    });

    if (!exam) throw new Error('Exam not found');

    return {
      examId: exam.id,
      questions: exam.examQuestions.map((eq: any) => ({
        id: eq.question.id,
        questionText: eq.question.questionText,
        type: normalizeQuestionType(eq.question.type),
        points: eq.question.points,
        options: eq.question.options,
        // correctAnswer and explanation intentionally omitted
      })),
    };
  }

  static async startAttempt(examId: string, userId: string) {
    let student = await prisma.student.findUnique({ where: { userId } });

    if (!student) {
      const department = await prisma.department.findFirst();
      const batch = await prisma.batch.findFirst({ where: { isActive: true } });
      student = await prisma.student.create({
        data: {
          userId,
          studentId: `STU${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
          batchId: batch?.id || (await prisma.batch.findFirst())!.id,
          departmentId: department?.id || (await prisma.department.findFirst())!.id,
          dateOfAdmission: new Date(),
          isActive: true,
        },
      });
    }

    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId: student.id,
        status: 'started',
        startedAt: new Date(),
      },
    });
    return attempt;
  }

  static async autosaveAttempt(attemptId: string, responses: any[]) {
    const entries = Array.isArray(responses) ? responses : [responses];

    for (const response of entries) {
      if (!response || !response.questionId) continue;

      if (response.id) {
        await prisma.examResponse.update({
          where: { id: response.id },
          data: {
            selectedOptions: response.selectedOptions ?? [],
            answerText: response.answerText ?? '',
          },
        });
      } else {
        await prisma.examResponse.create({
          data: {
            attemptId,
            questionId: response.questionId,
            selectedOptions: response.selectedOptions ?? [],
            answerText: response.answerText ?? '',
          },
        });
      }
    }

    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { responses: true },
    });
  }

  static async resumeAttempt(attemptId: string) {
    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        responses: true,
      },
    });
  }

  static async submitAttempt(attemptId: string, responses: any[] = []) {
    if (responses.length > 0) {
      await this.autosaveAttempt(attemptId, responses);
    }

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: 'submitted', submittedAt: new Date() },
    });

    try {
      await GradingService.autoGradeAttempt(attemptId);
    } catch (err) {
      console.error('Auto-grading failed:', err);
    }

    return updated;
  }

  static async getAttemptResults(attemptId: string) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        responses: { include: { question: true } },
      },
    });

    if (!attempt) throw new Error('Attempt not found');

    // Calculate which responses are correct (for display only)
    const responses = attempt.responses.map((r: any) => ({
      ...r,
      isCorrect: r.isCorrect ?? null, // null = pending manual grading
    }));

    return {
      attemptId,
      studentId: attempt.studentId,
      examId: attempt.examId,
      score: attempt.score,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      exam: attempt.exam,
      responses,
    };
  }

  static async getAttemptDetails(attemptId: string) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        responses: { include: { question: true } },
      },
    });

    if (!attempt) throw new Error('Attempt not found');

    // Build detailed response info
    const details = attempt.responses.map((response: any) => ({
      questionId: response.questionId,
      questionText: response.question.questionText,
      type: response.question.type,
      points: response.question.points,
      options: response.question.options,
      selectedOptions: response.selectedOptions,
      answerText: response.answerText,
      correctAnswer: response.question.correctAnswer,
      isCorrect: response.isCorrect,
      pointsEarned: response.pointsEarned,
    }));

    return {
      attemptId,
      studentId: attempt.studentId,
      examId: attempt.examId,
      examTitle: attempt.exam.title,
      score: attempt.score,
      status: attempt.status,
      passingScore: attempt.exam.passingScore,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      details,
    };
  }
}

export default ExamService;
