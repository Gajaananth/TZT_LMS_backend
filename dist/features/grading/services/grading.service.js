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
        for (const response of attempt.responses) {
            const question = response.question;
            const maxPoints = question.points || 1;
            totalPoints += maxPoints;
            let correct = false;
            const selectedOptions = Array.isArray(response.selectedOptions) ? response.selectedOptions : [];
            const answerText = normalizeAnswer(response.answerText ?? selectedOptions[0]);
            const expectedAnswer = normalizeAnswer(question.correctAnswer ?? '');
            if (question.type === 'MULTIPLE_CHOICE') {
                if (typeof question.correctAnswer === 'string' && /^\d+$/.test(question.correctAnswer.trim())) {
                    correct = selectedOptions.includes(Number(question.correctAnswer));
                }
                else {
                    correct = normalizeAnswer(selectedOptions[0]) === expectedAnswer || answerText === expectedAnswer;
                }
            }
            else if (question.type === 'TRUE_FALSE') {
                correct = answerText === expectedAnswer || normalizeAnswer(selectedOptions[0]) === expectedAnswer;
            }
            else {
                hasEssay = true;
            }
            await client_1.prisma.examResponse.update({
                where: { id: response.id },
                data: {
                    isCorrect: question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE' ? correct : null,
                    pointsEarned: correct ? maxPoints : 0,
                },
            });
            if (correct)
                earnedPoints += maxPoints;
        }
        const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        let grade = 'F';
        if (scorePercentage >= 90)
            grade = 'A';
        else if (scorePercentage >= 80)
            grade = 'B';
        else if (scorePercentage >= 70)
            grade = 'C';
        else if (scorePercentage >= 60)
            grade = 'D';
        const status = hasEssay ? 'submitted' : 'graded';
        const updated = await client_1.prisma.examAttempt.update({
            where: { id: attemptId },
            data: { score: scorePercentage, status },
        });
        await client_1.prisma.examResult.upsert({
            where: { attemptId },
            create: { attemptId, grade, issuedAt: new Date() },
            update: { grade, issuedAt: new Date() },
        });
        return updated;
    }
    static async listManualQueue(limit = 50) {
        const items = await client_1.prisma.examAttempt.findMany({ where: { status: 'submitted' }, take: limit, orderBy: { submittedAt: 'asc' } });
        return items;
    }
    static async manualGradeAttempt(attemptId, score, graderId) {
        const updated = await client_1.prisma.examAttempt.update({
            where: { id: attemptId },
            data: { score: score, status: 'graded' },
        });
        return updated;
    }
}
exports.GradingService = GradingService;
exports.default = GradingService;
