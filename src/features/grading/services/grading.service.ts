import { prisma } from '@/db/prisma/client';

const normalizeAnswer = (value: any) => {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim().toLowerCase());
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

export class GradingService {
  static async autoGradeAttempt(attemptId: string) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: { include: { question: true } },
        exam: true,
      },
    });

    if (!attempt) throw new Error('Attempt not found');

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
        } else {
          correct = normalizeAnswer(selectedOptions[0]) === expectedAnswer || answerText === expectedAnswer;
        }
      } else if (question.type === 'TRUE_FALSE') {
        correct = answerText === expectedAnswer || normalizeAnswer(selectedOptions[0]) === expectedAnswer;
      } else {
        hasEssay = true;
      }

      await prisma.examResponse.update({
        where: { id: response.id },
        data: {
          isCorrect: question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE' ? correct : null,
          pointsEarned: correct ? (maxPoints as any) : 0,
        },
      });

      if (correct) earnedPoints += maxPoints;
    }

    const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    let grade = 'F';
    if (scorePercentage >= 90) grade = 'A';
    else if (scorePercentage >= 80) grade = 'B';
    else if (scorePercentage >= 70) grade = 'C';
    else if (scorePercentage >= 60) grade = 'D';

    const status = hasEssay ? 'submitted' : 'graded';
    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { score: scorePercentage as any, status },
    });

    await prisma.examResult.upsert({
      where: { attemptId },
      create: { attemptId, grade, issuedAt: new Date() },
      update: { grade, issuedAt: new Date() },
    });

    return updated;
  }

  static async listManualQueue(limit = 50) {
    const items = await prisma.examAttempt.findMany({ where: { status: 'submitted' }, take: limit, orderBy: { submittedAt: 'asc' } });
    return items;
  }

  static async manualGradeAttempt(attemptId: string, score: number, graderId: string) {
    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { score: score as any, status: 'graded' },
    });
    return updated;
  }
}

export default GradingService;
