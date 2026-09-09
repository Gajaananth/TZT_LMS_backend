"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradingService = void 0;
const client_1 = require("../../../db/prisma/client");
const normalizeAnswer = (value) => {
    if (Array.isArray(value))
        return value.map((entry) => String(entry).trim().toLowerCase());
    if (value === null || value === undefined)
        return '';
    return String(value).trim().toLowerCase();
};
class GradingService {
    static async autoGradeAttempt(attemptId) {
        const attempt = await client_1.prisma.examAttempt.findUnique({
            where: { id: attemptId },
            include: {
                responses: { include: { question: true } },
                exam: true,
            },
        });
        if (!attempt)
            throw new Error('Attempt not found');
        let totalPoints = 0;
        let earnedPoints = 0;
        let hasEssay = false;
        let hasManualGradingNeeded = false;
        for (const response of attempt.responses) {
            const question = response.question;
            const maxPoints = question.points || 1;
            totalPoints += maxPoints;
            let correct = false;
            const selectedOptions = Array.isArray(response.selectedOptions) ? response.selectedOptions : [];
            const answerText = normalizeAnswer(response.answerText ?? selectedOptions[0]);
            const expectedAnswer = normalizeAnswer(question.correctAnswer ?? '');
            // Auto-gradable question types
            if (question.type === 'MULTIPLE_CHOICE') {
                // Check if correctAnswer is an index or text
                if (typeof question.correctAnswer === 'string' && /^\d+$/.test(question.correctAnswer.trim())) {
                    correct = selectedOptions.includes(Number(question.correctAnswer));
                }
                else {
                    correct = normalizeAnswer(selectedOptions[0]) === expectedAnswer || answerText === expectedAnswer;
                }
            }
            else if (question.type === 'MULTIPLE_SELECT') {
                // For multiple select, all selected options must match
                const expectedOptions = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.map(o => normalizeAnswer(o))
                    : [expectedAnswer];
                correct = selectedOptions.length > 0 &&
                    selectedOptions.every(opt => expectedOptions.includes(normalizeAnswer(opt)));
            }
            else if (question.type === 'TRUE_FALSE') {
                correct = answerText === expectedAnswer || normalizeAnswer(selectedOptions[0]) === expectedAnswer;
            }
            else if (question.type === 'DROPDOWN') {
                // Dropdown is similar to multiple choice
                if (typeof question.correctAnswer === 'string' && /^\d+$/.test(question.correctAnswer.trim())) {
                    correct = selectedOptions.includes(Number(question.correctAnswer));
                }
                else {
                    correct = normalizeAnswer(selectedOptions[0]) === expectedAnswer;
                }
            }
            else if (question.type === 'FILL_IN_BLANK') {
                // Fill in blank - exact or close match
                const studentAnswer = normalizeAnswer(answerText);
                const correctAnswers = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.map(a => normalizeAnswer(a))
                    : [expectedAnswer];
                correct = correctAnswers.includes(studentAnswer);
            }
            else if (question.type === 'SHORT_ANSWER') {
                // Short answer - may need partial credit or keyword matching
                const studentAnswer = normalizeAnswer(answerText);
                const correctAnswers = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.map(a => normalizeAnswer(a))
                    : [expectedAnswer];
                correct = correctAnswers.includes(studentAnswer);
            }
            else if (question.type === 'ESSAY' ||
                question.type === 'MATCHING' ||
                question.type === 'ORDERING' ||
                question.type === 'IMAGE' ||
                question.type === 'AUDIO' ||
                question.type === 'CODING') {
                // Manual grading needed
                hasManualGradingNeeded = true;
                hasEssay = true;
            }
            await client_1.prisma.examResponse.update({
                where: { id: response.id },
                data: {
                    isCorrect: question.type === 'ESSAY' ||
                        question.type === 'MATCHING' ||
                        question.type === 'ORDERING' ||
                        question.type === 'IMAGE' ||
                        question.type === 'AUDIO' ||
                        question.type === 'CODING'
                        ? null // Manual grading needed
                        : correct,
                    pointsEarned: correct ? maxPoints : 0,
                },
            });
            if (correct)
                earnedPoints += maxPoints;
        }
        const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        // Calculate grade based on percentage
        let grade = 'F';
        if (scorePercentage >= 90)
            grade = 'A';
        else if (scorePercentage >= 80)
            grade = 'B';
        else if (scorePercentage >= 70)
            grade = 'C';
        else if (scorePercentage >= 60)
            grade = 'D';
        // Status depends on whether manual grading is needed
        const status = hasManualGradingNeeded ? 'submitted' : 'graded';
        const updated = await client_1.prisma.examAttempt.update({
            where: { id: attemptId },
            data: { score: scorePercentage, status },
        });
        await client_1.prisma.examResult.upsert({
            where: { attemptId },
            create: {
                attemptId,
                grade,
                issuedAt: new Date(),
            },
            update: {
                grade,
                issuedAt: new Date(),
            },
        });
        return updated;
    }
    static async listManualQueue(limit = 50) {
        const items = await client_1.prisma.examAttempt.findMany({
            where: { status: 'submitted' },
            take: limit,
            orderBy: { submittedAt: 'asc' },
            include: {
                student: { include: { user: true } },
                exam: true,
                responses: { include: { question: true } },
            },
        });
        return items;
    }
    static async manualGradeResponse(responseId, pointsEarned, isCorrect, graderId) {
        const response = await client_1.prisma.examResponse.update({
            where: { id: responseId },
            data: {
                isCorrect,
                pointsEarned: pointsEarned,
            },
        });
        // Recalculate attempt score
        const attempt = await client_1.prisma.examAttempt.findUnique({
            where: { id: response.attemptId },
            include: { responses: true },
        });
        if (attempt) {
            const totalPoints = attempt.responses.reduce((sum, r) => sum + (r.pointsEarned ? Number(r.pointsEarned) : 0), 0);
            const allResponsesGraded = attempt.responses.every(r => r.isCorrect !== null);
            if (allResponsesGraded) {
                // All responses graded - calculate final grade
                const maxPoints = await client_1.prisma.examResponse.aggregate({
                    where: { attemptId: attempt.id },
                    _sum: { pointsEarned: true },
                });
                const scorePercentage = maxPoints._sum.pointsEarned ?
                    (totalPoints / Number(maxPoints._sum.pointsEarned)) * 100 : 0;
                let grade = 'F';
                if (scorePercentage >= 90)
                    grade = 'A';
                else if (scorePercentage >= 80)
                    grade = 'B';
                else if (scorePercentage >= 70)
                    grade = 'C';
                else if (scorePercentage >= 60)
                    grade = 'D';
                await client_1.prisma.examAttempt.update({
                    where: { id: attempt.id },
                    data: { score: scorePercentage, status: 'graded' },
                });
                await client_1.prisma.examResult.upsert({
                    where: { attemptId: attempt.id },
                    create: { attemptId: attempt.id, grade, issuedAt: new Date() },
                    update: { grade, issuedAt: new Date() },
                });
            }
        }
        return response;
    }
    static async manualGradeAttempt(attemptId, score, graderId) {
        const updated = await client_1.prisma.examAttempt.update({
            where: { id: attemptId },
            data: { score: score, status: 'graded' },
        });
        let grade = 'F';
        if (score >= 90)
            grade = 'A';
        else if (score >= 80)
            grade = 'B';
        else if (score >= 70)
            grade = 'C';
        else if (score >= 60)
            grade = 'D';
        await client_1.prisma.examResult.upsert({
            where: { attemptId },
            create: { attemptId, grade, issuedAt: new Date() },
            update: { grade, issuedAt: new Date() },
        });
        return updated;
    }
}
exports.GradingService = GradingService;
exports.default = GradingService;
