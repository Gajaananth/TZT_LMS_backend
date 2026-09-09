"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamService = void 0;
const client_1 = require("../../../db/prisma/client");
const grading_service_1 = __importDefault(require("../../../features/grading/services/grading.service"));
const normalizeQuestionType = (type) => {
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
class ExamService {
    static async listExams(filters = {}, user) {
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;
        const now = new Date();
        const whereClause = { deletedAt: null };
        // If teacher, filter to only courses assigned to the teacher
        if (user?.id) {
            const roles = user.userRoles?.map((ur) => ur.role?.name || ur) || [];
            if (roles.includes('Teacher') && !roles.includes('Admin') && !roles.includes('SuperAdmin')) {
                const teacher = await client_1.prisma.teacher.findUnique({
                    where: { userId: user.id },
                    include: { teacherAssignments: true },
                });
                if (teacher) {
                    const assignedCourseIds = teacher.teacherAssignments.map(ta => ta.courseId);
                    whereClause.courseId = { in: assignedCourseIds };
                }
            }
        }
        let studentAttempts = [];
        if (user?.id) {
            const student = await client_1.prisma.student.findUnique({ where: { userId: user.id } });
            if (student) {
                studentAttempts = await client_1.prisma.examAttempt.findMany({
                    where: { studentId: student.id, deletedAt: null },
                    select: { examId: true, score: true, status: true },
                });
            }
        }
        const exams = await client_1.prisma.exam.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                examQuestions: { select: { id: true } },
                course: { select: { id: true, title: true, code: true } },
            },
            orderBy: { startDate: 'desc' },
        });
        // Calculate status and attempts for each exam
        const results = exams.map((exam) => {
            const myAttempts = studentAttempts.filter((a) => a.examId === exam.id);
            const attemptsCount = myAttempts.length;
            const bestScore = myAttempts.length > 0 ? Math.max(...myAttempts.map((a) => Number(a.score) || 0)) : null;
            return {
                ...exam,
                status: now < new Date(exam.startDate ?? new Date())
                    ? 'Upcoming'
                    : now > new Date(exam.endDate ?? new Date())
                        ? 'Closed'
                        : 'Active',
                questionCount: exam.examQuestions.length,
                attemptsCount,
                bestScore,
            };
        });
        return results;
    }
    static async getExam(examId) {
        const exam = await client_1.prisma.exam.findUnique({
            where: { id: examId },
            include: {
                examQuestions: { select: { id: true } },
            },
        });
        if (!exam)
            throw new Error('Exam not found');
        const now = new Date();
        return {
            ...exam,
            status: now < new Date(exam.startDate ?? new Date())
                ? 'Upcoming'
                : now > new Date(exam.endDate ?? new Date())
                    ? 'Closed'
                    : 'Active',
        };
    }
    static async getExamWithQuestions(examId) {
        const exam = await client_1.prisma.exam.findUnique({
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
        if (!exam)
            throw new Error('Exam not found');
        return {
            ...exam,
            questions: exam.examQuestions.map((eq) => ({
                ...eq.question,
                type: normalizeQuestionType(eq.question.type),
            })),
        };
    }
    static async getExamQuestions(examId) {
        const exam = await client_1.prisma.exam.findUnique({
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
        if (!exam)
            throw new Error('Exam not found');
        return {
            examId: exam.id,
            questions: exam.examQuestions.map((eq) => ({
                id: eq.question.id,
                questionText: eq.question.questionText,
                type: normalizeQuestionType(eq.question.type),
                points: eq.question.points,
                options: eq.question.options,
                // correctAnswer and explanation intentionally omitted
            })),
        };
    }
    static async startAttempt(examId, userId) {
        const exam = await client_1.prisma.exam.findUnique({ where: { id: examId } });
        if (!exam)
            throw new Error('Exam not found');
        let student = await client_1.prisma.student.findUnique({ where: { userId } });
        if (!student) {
            const department = await client_1.prisma.department.findFirst();
            const batch = await client_1.prisma.batch.findFirst({ where: { isActive: true } });
            student = await client_1.prisma.student.create({
                data: {
                    userId,
                    studentId: `STU${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
                    batchId: batch?.id || (await client_1.prisma.batch.findFirst()).id,
                    departmentId: department?.id || (await client_1.prisma.department.findFirst()).id,
                    dateOfAdmission: new Date(),
                    isActive: true,
                },
            });
        }
        // Check attempts limit
        const pastAttempts = await client_1.prisma.examAttempt.count({
            where: {
                examId,
                studentId: student.id,
                deletedAt: null,
            },
        });
        const isSummative = (exam.examType || '').toUpperCase() === 'SUMMATIVE';
        const maxAllowed = isSummative ? 1 : (exam.maxAttempts || 1);
        if (pastAttempts >= maxAllowed) {
            throw new Error(isSummative
                ? 'Summative exams allow only 1 attempt. You have already completed this exam.'
                : `Maximum attempts (${maxAllowed}) reached for this formative exam.`);
        }
        const attempt = await client_1.prisma.examAttempt.create({
            data: {
                examId,
                studentId: student.id,
                status: 'started',
                startedAt: new Date(),
            },
        });
        return attempt;
    }
    static async autosaveAttempt(attemptId, responses) {
        const entries = Array.isArray(responses) ? responses : [responses];
        for (const response of entries) {
            if (!response || !response.questionId)
                continue;
            if (response.id) {
                await client_1.prisma.examResponse.update({
                    where: { id: response.id },
                    data: {
                        selectedOptions: response.selectedOptions ?? [],
                        answerText: response.answerText ?? '',
                    },
                });
            }
            else {
                await client_1.prisma.examResponse.create({
                    data: {
                        attemptId,
                        questionId: response.questionId,
                        selectedOptions: response.selectedOptions ?? [],
                        answerText: response.answerText ?? '',
                    },
                });
            }
        }
        return client_1.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: { responses: true },
        });
    }
    static async resumeAttempt(attemptId) {
        return client_1.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: {
                exam: true,
                responses: true,
            },
        });
    }
    static async submitAttempt(attemptId, responses = []) {
        if (responses.length > 0) {
            await this.autosaveAttempt(attemptId, responses);
        }
        const updated = await client_1.prisma.examAttempt.update({
            where: { id: attemptId },
            data: { status: 'submitted', submittedAt: new Date() },
            include: { exam: true },
        });
        try {
            await grading_service_1.default.autoGradeAttempt(attemptId);
        }
        catch (err) {
            console.error('Auto-grading failed:', err);
        }
        // Recalculate score based on grading strategy across attempts
        try {
            if (updated.exam) {
                const allAttempts = await client_1.prisma.examAttempt.findMany({
                    where: {
                        examId: updated.examId,
                        studentId: updated.studentId,
                        deletedAt: null,
                        status: { in: ['submitted', 'graded', 'reviewed'] },
                    },
                    orderBy: { submittedAt: 'asc' },
                });
                const scores = allAttempts.map(a => Number(a.score) || 0);
                let finalScore = scores[scores.length - 1] || 0;
                if (updated.exam.gradingStrategy === 'HIGHEST') {
                    finalScore = Math.max(...scores);
                }
                else if (updated.exam.gradingStrategy === 'AVERAGE') {
                    finalScore = Math.round((scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1)) * 10) / 10;
                }
                const passingScore = Number(updated.exam.passingScore) || 0;
                const grade = finalScore >= passingScore ? 'Pass' : 'Fail';
                await client_1.prisma.examResult.upsert({
                    where: { attemptId: updated.id },
                    create: {
                        attemptId: updated.id,
                        grade,
                    },
                    update: {
                        grade,
                    },
                });
            }
        }
        catch (calcErr) {
            console.error('Grading strategy calculation failed:', calcErr);
        }
        return updated;
    }
    static async getAttemptResults(attemptId) {
        const attempt = await client_1.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: {
                exam: true,
                responses: { include: { question: true } },
            },
        });
        if (!attempt)
            throw new Error('Attempt not found');
        // Calculate which responses are correct (for display only)
        const responses = attempt.responses.map((r) => ({
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
    static async getAttemptDetails(attemptId) {
        const attempt = await client_1.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: {
                exam: true,
                responses: { include: { question: true } },
            },
        });
        if (!attempt)
            throw new Error('Attempt not found');
        // Build detailed response info
        const details = attempt.responses.map((response) => ({
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
    static async createExam(data, createdBy) {
        const isSummative = (data.examType || '').toUpperCase() === 'SUMMATIVE';
        const exam = await client_1.prisma.exam.create({
            data: {
                title: data.title,
                description: data.description,
                courseId: data.courseId,
                startDate: data.startDate,
                endDate: data.endDate,
                durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : 60,
                passingScore: data.passingScore ? parseFloat(String(data.passingScore)) : 0,
                randomizeQuestions: data.randomizeQuestions ?? false,
                examType: isSummative ? 'SUMMATIVE' : 'FORMATIVE',
                maxAttempts: isSummative ? 1 : Math.max(1, Number(data.maxAttempts) || 1),
                gradingStrategy: isSummative ? 'HIGHEST' : (data.gradingStrategy || 'HIGHEST'),
                createdBy,
            },
        });
        if (data.sections && data.sections.length > 0) {
            for (const section of data.sections) {
                const createdSection = await client_1.prisma.examSection.create({
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
                        await client_1.prisma.examQuestion.create({
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
        }
        else {
            const defaultSection = await client_1.prisma.examSection.create({
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
    static async getUserRoleNames(userId) {
        const u = await client_1.prisma.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } },
        });
        return u?.userRoles.map((ur) => ur.role.name) || [];
    }
    static async updateExam(examId, data, updatedBy) {
        const existing = await client_1.prisma.exam.findUnique({ where: { id: examId } });
        if (!existing)
            throw new Error('Exam not found');
        const roles = await this.getUserRoleNames(updatedBy);
        const isAdmin = roles.some((r) => r === 'SuperAdmin' || r === 'Admin');
        if (!isAdmin && existing.createdBy && existing.createdBy !== updatedBy) {
            throw new Error('You do not have permission to update this exam');
        }
        const isSummative = data.examType ? (data.examType || '').toUpperCase() === 'SUMMATIVE' : (existing.examType === 'SUMMATIVE');
        return client_1.prisma.$transaction(async (tx) => {
            const exam = await tx.exam.update({
                where: { id: examId },
                data: {
                    title: data.title !== undefined ? data.title : undefined,
                    description: data.description !== undefined ? data.description : undefined,
                    courseId: data.courseId !== undefined ? data.courseId : undefined,
                    startDate: data.startDate !== undefined ? data.startDate : undefined,
                    endDate: data.endDate !== undefined ? data.endDate : undefined,
                    durationMinutes: data.durationMinutes !== undefined ? Number(data.durationMinutes) : undefined,
                    passingScore: data.passingScore !== undefined ? parseFloat(String(data.passingScore)) : undefined,
                    randomizeQuestions: data.randomizeQuestions !== undefined ? !!data.randomizeQuestions : undefined,
                    examType: data.examType ? (isSummative ? 'SUMMATIVE' : 'FORMATIVE') : undefined,
                    maxAttempts: isSummative ? 1 : (data.maxAttempts !== undefined ? Math.max(1, Number(data.maxAttempts)) : undefined),
                    gradingStrategy: data.gradingStrategy !== undefined ? data.gradingStrategy : undefined,
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
exports.ExamService = ExamService;
exports.default = ExamService;
