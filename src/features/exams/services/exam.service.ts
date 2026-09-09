import { prisma } from '@/db/prisma/client';
import GradingService from '../../../features/grading/services/grading.service';

const normalizeQuestionType = (type?: string) => {
  const value = (type || '').toUpperCase().replace(/[-_]/g, '_');
  switch (value) {
    case 'MULTIPLE_CHOICE':
    case 'MCQ':
      return 'MCQ';
    case 'MULTIPLE_SELECT':
    case 'MSQ':
    case 'MULTIPLESELECT':
      return 'Multiple_Select';
    case 'DROPDOWN':
    case 'DROP_DOWN':
      return 'Dropdown';
    case 'TRUE_FALSE':
    case 'TRUEFALSE':
    case 'TF':
      return 'True_False';
    case 'FILL_IN_BLANK':
    case 'FILLINBLANK':
    case 'FIB':
      return 'Fill_In_Blank';
    case 'SHORT_ANSWER':
    case 'SHORTANSWER':
      return 'Short_Answer';
    case 'ESSAY':
      return 'Essay';
    default:
      return 'Short_Answer';
  }
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
      type: normalizeQuestionType(response.question.type),
      points: response.question.points,
      options: response.question.options,
      selectedOptions: response.selectedOptions,
      answerText: response.answerText,
      correctAnswer: response.question.correctAnswer,
      explanation: response.question.explanation ?? null,
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

  static async createExam(
    data: {
      title: string;
      description?: string;
      courseId: string;
      startDate?: Date;
      endDate?: Date;
      durationMinutes?: number;
      passingScore?: number;
      randomizeQuestions?: boolean;
      examType?: string;
      status?: string;
      startTime?: Date;
      sections?: Array<{
        title: string;
        description?: string;
        sequenceNumber: number;
        questions: Array<{ questionId: string; points: number; sequenceNumber: number }>;
      }>;
    },
    createdBy: string,
  ) {
    const exam = await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        startDate: data.startDate,
        endDate: data.endDate,
        startTime: data.startTime || data.startDate,
        durationMinutes: data.durationMinutes,
        passingScore: data.passingScore ? parseFloat(String(data.passingScore)) : 0,
        randomizeQuestions: data.randomizeQuestions ?? false,
        examType: data.examType,
        status: data.status || 'Draft',
        createdBy,
      },
    });

    if (data.sections && data.sections.length > 0) {
      for (const section of data.sections) {
        const createdSection = await prisma.examSection.create({
          data: {
            examId: exam.id,
            title: section.title,
            description: section.description,
            sequenceNumber: section.sequenceNumber,
            createdBy,
          },
        });

        if (section.questions && section.questions.length > 0) {
          for (const q of section.questions) {
            await prisma.examQuestion.create({
              data: {
                examId: exam.id,
                sectionId: createdSection.id,
                questionId: q.questionId,
                points: q.points,
                sequenceNumber: q.sequenceNumber,
              },
            });
          }
        }
      }
    } else {
      const defaultSection = await prisma.examSection.create({
        data: {
          examId: exam.id,
          title: 'General',
          sequenceNumber: 1,
          createdBy,
        },
      });
    }

    return exam;
  }

  static async getUserRoleNames(userId: string): Promise<string[]> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    return u?.userRoles.map((ur) => ur.role.name) || [];
  }

  static async updateExam(
    examId: string,
    data: {
      title?: string;
      description?: string;
      courseId?: string;
      startDate?: Date;
      endDate?: Date;
      durationMinutes?: number;
      passingScore?: number;
      randomizeQuestions?: boolean;
      examType?: string;
      status?: string;
      startTime?: Date;
      sections?: Array<{
        title: string;
        description?: string;
        sequenceNumber: number;
        questions: Array<{ questionId: string; points: number; sequenceNumber: number }>;
      }>;
    },
    updatedBy: string,
  ) {
    const existing = await prisma.exam.findUnique({ where: { id: examId } });
    if (!existing) throw new Error('Exam not found');

    const roles = await this.getUserRoleNames(updatedBy);
    const isAdmin = roles.some((r) => r === 'SuperAdmin' || r === 'Admin');
    if (!isAdmin && existing.createdBy && existing.createdBy !== updatedBy) {
      throw new Error('You do not have permission to update this exam');
    }

    return prisma.$transaction(async (tx) => {
      const exam = await tx.exam.update({
        where: { id: examId },
        data: {
          title: data.title !== undefined ? data.title : undefined,
          description: data.description !== undefined ? data.description : undefined,
          courseId: data.courseId !== undefined ? data.courseId : undefined,
          startDate: data.startDate !== undefined ? data.startDate : undefined,
          endDate: data.endDate !== undefined ? data.endDate : undefined,
          startTime: data.startTime !== undefined ? data.startTime : data.startDate !== undefined ? data.startDate : undefined,
          durationMinutes: data.durationMinutes !== undefined ? Number(data.durationMinutes) : undefined,
          passingScore: data.passingScore !== undefined ? parseFloat(String(data.passingScore)) : undefined,
          randomizeQuestions: data.randomizeQuestions !== undefined ? !!data.randomizeQuestions : undefined,
          examType: data.examType !== undefined ? data.examType : undefined,
          status: data.status !== undefined ? data.status : undefined,
        },
      });

      if (data.sections && Array.isArray(data.sections)) {
        await tx.examQuestion.deleteMany({ where: { examId } });
        await tx.examSection.deleteMany({ where: { examId } });

        if (data.sections.length > 0) {
          for (const section of data.sections) {
            const createdSection = await tx.examSection.create({
              data: {
                examId,
                title: section.title,
                description: section.description,
                sequenceNumber: Number(section.sequenceNumber || 1),
                createdBy: updatedBy,
              },
            });

            if (section.questions && section.questions.length > 0) {
              for (const q of section.questions) {
                await tx.examQuestion.create({
                  data: {
                    examId,
                    sectionId: createdSection.id,
                    questionId: q.questionId,
                    points: q.points,
                    sequenceNumber: Number(q.sequenceNumber || 1),
                  },
                });
              }
            }
          }
        }
      }

      return exam;
    });
  }
}

export default ExamService;
