export const applyNegativeMarking = (question: any, response: any) => {
  // question: { type, points, negativeMark?, correctAnswer, options }
  // response: { selectedOptions, answerText }
  const points = Number(question.points || 0);
  const negative = Number(question.negativeMark ?? 0);

  if (question.type === 'MCQ') {
    const correct = question.correctAnswer;
    if (!response.selectedOptions || response.selectedOptions.length === 0) return 0;
    const selected = response.selectedOptions[0];
    return selected === correct ? points : -negative;
  }

  if (question.type === 'MSQ') {
    const correctSet = new Set(question.correctAnswer || []);
    const selected = response.selectedOptions || [];
    let score = 0;
    for (const s of selected) {
      if (correctSet.has(s)) score += points / correctSet.size;
      else score -= negative;
    }
    return Math.max(0, score);
  }

  // subjective types handled by manual grading
  return 0;
};

export default { applyNegativeMarking };
