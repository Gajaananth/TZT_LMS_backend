"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradingService = exports.buildStudentAnswerSet = exports.parseCorrectAnswerSet = void 0;
const client_1 = require("../../../db/prisma/client");
const MANUAL_GRADING_TYPES = new Set([
    'ESSAY',
    'MATCHING',
    'ORDERING',
    'IMAGE',
    'AUDIO',
    'CODING',
]);
const normalizeString = (value) => {
    if (value === null || value === undefined)
        return '';
    return String(value).trim().toLowerCase();
};
// Normalize TF to canonical "true" / "false" strings (lowercase) for comparison.
const normalizeTrueFalse = (value) => {
    const s = normalizeString(value);
    if (s === '' || s === null || s === undefined)
        return null;
    if (['1', 'true', 't', 'yes', 'y'].includes(s))
        return 'true';
    if (['0', 'false', 'f', 'no', 'n'].includes(s))
        return 'false';
    return s;
};
/**
 * Flatten a JSON-typed correctAnswer into a set of normalized strings.
 * - JSON string / number / boolean → 1 entry
 * - JSON array → each element as string (recurse if nested arrays, but flat expected)
 * - JSON object → attempt JSON.stringify for stability (rarely used)
 * - null → []
 * Used for lookups so both "True" text and index "0" (or 0) find the same match.
 */
const parseCorrectAnswerSet = (correctAnswer) => {
    const out = new Set();
    if (correctAnswer === null || correctAnswer === undefined)
        return out;
    const push = (v) => {
        const s = normalizeString(v);
        if (s !== '')
            out.add(s);
        const tf = normalizeTrueFalse(v);
        if (tf)
            out.add(tf);
        if (typeof v === 'number' || /^\d+$/.test(s)) {
            out.add(String(Number(v)));
        }
    };
    if (Array.isArray(correctAnswer)) {
        correctAnswer.forEach(push);
    }
    else if (typeof correctAnswer === 'object') {
        try {
            push(JSON.stringify(correctAnswer));
        }
        catch {
            /* ignore */
        }
    }
    else {
        push(correctAnswer);
    }
    return out;
};
exports.parseCorrectAnswerSet = parseCorrectAnswerSet;
/**
 * From the student response, build a normalized set of tokens we can match
 * against correctAnswerSet. Includes both:
 *   - selected option indices (as numeric strings)
 *   - selected option texts (from the Question.options array if available)
 *   - answerText normalized and true/false parsed
 */
const buildStudentAnswerSet = (selectedOptions, answerText, options) => {
    const out = new Set();
    const optsArray = Array.isArray(options) ? options : [];
    if (Array.isArray(selectedOptions)) {
        for (const idx of selectedOptions) {
            const num = Number(idx);
            if (!Number.isNaN(num)) {
                out.add(String(num));
                if (typeof optsArray[num] === 'string') {
                    const textNormalized = normalizeString(optsArray[num]);
                    if (textNormalized !== '')
                        out.add(textNormalized);
                    const tf = normalizeTrueFalse(optsArray[num]);
                    if (tf)
                        out.add(tf);
                }
                else if (optsArray[num] !== null && optsArray[num] !== undefined) {
                    const s = normalizeString(optsArray[num]);
                    if (s !== '')
                        out.add(s);
                }
            }
        }
    }
    if (typeof answerText === 'string' && answerText.trim() !== '') {
        const s = normalizeString(answerText);
        if (s !== '')
            out.add(s);
        const tf = normalizeTrueFalse(answerText);
        if (tf)
            out.add(tf);
        const asNum = Number(answerText.trim());
        if (!Number.isNaN(asNum))
            out.add(String(asNum));
    }
    return out;
};
exports.buildStudentAnswerSet = buildStudentAnswerSet;
const setsEqual = (a, b) => {
    if (a.size !== b.size)
        return false;
    for (const v of a)
        if (!b.has(v))
            return false;
    return true;
};
const setsIntersect = (a, b) => {
    for (const v of a)
        if (b.has(v))
            return true;
    return false;
};
const isManualType = (type) => {
    if (!type)
        return false;
    return MANUAL_GRADING_TYPES.has(String(type).toUpperCase().replace(/[-_]/g, '_'));
};
const gradeFromPercentage = (pct) => {
    if (pct >= 90)
        return 'A';
    if (pct >= 80)
        return 'B';
    if (pct >= 70)
        return 'C';
    if (pct >= 60)
        return 'D';
    return 'F';
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
        const responses = attempt.responses || [];
        // First pass: compute max possible points by aggregating question.points.
        // Fall back to 1 per response if missing.
        const pointsPerQuestion = responses.map((r) => {
            const q = r.question;
            return Number(q?.points ?? 1) || 1;
        });
        const totalMax = pointsPerQuestion.reduce((s, p) => s + p, 0);
        let earnedTotal = 0;
        let hasManualGradingNeeded = false;
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const question = response.question;
            const typeRaw = String(question?.type ?? 'SHORT_ANSWER').toUpperCase().replace(/[-_]/g, '_');
            const maxPoints = pointsPerQuestion[i];
            const correctSet = (0, exports.parseCorrectAnswerSet)(question?.correctAnswer);
            const studentSet = (0, exports.buildStudentAnswerSet)(Array.isArray(response.selectedOptions) ? response.selectedOptions : [], typeof response.answerText === 'string' ? response.answerText : '', question?.options ?? null);
            let correct = false;
            let manual = isManualType(typeRaw);
            if (!manual) {
                switch (typeRaw) {
                    case 'MULTIPLE_CHOICE':
                    case 'MCQ':
                    case 'DROPDOWN':
                    case 'DROP_DOWN': {
                        correct = setsIntersect(studentSet, correctSet) && correctSet.size > 0;
                        break;
                    }
                    case 'MULTIPLE_SELECT':
                    case 'MSQ':
                    case 'MULTIPLESELECT': {
                        // For MSQ we require the student selections to EXACTLY match any valid
                        // encoding of the correct answer (either indices OR texts OR combined set).
                        // To be robust when correctAnswer stores indices and student sent indices,
                        // we compare the student set (which contains indices + mapped texts) with
                        // the correct set; because correctSet also accepts multiple encodings we
                        // compare by checking both direction subset equality within the index/text
                        // space that is present on both sides.
                        // Simpler robust rule:
                        //   (1) correctSet must contain at least one correct entry
                        //   (2) every student token that is a valid index OR option text must be
                        //       present in correctSet (no wrong selections)
                        //   (3) at least one correct-index / correct-text from correctSet must be
                        //       selected (covers all)
                        // But simpler still, and consistent with the spec's "exact match":
                        //   Build studentIndexSet (from selectedOptions numeric) + studentTextSet
                        //   (from mapped option texts); build correctIndexSet (numeric strings from
                        //   correctSet that parse as int) + correctTextSet (option-text strings).
                        //   If correctIndexSet non-empty → compare against studentIndexSet (equal).
                        //   Else if correctTextSet non-empty → compare studentTextSet (equal).
                        //   Otherwise fall back to setsEqual on raw sets.
                        {
                            const optionsArr = Array.isArray(question?.options) ? question.options : [];
                            const validTexts = new Set(optionsArr.map((o) => normalizeString(o)).filter((s) => s !== ''));
                            const correctIndexSet = new Set();
                            const correctTextSet = new Set();
                            for (const v of correctSet) {
                                if (/^\d+$/.test(v))
                                    correctIndexSet.add(v);
                                if (validTexts.has(v))
                                    correctTextSet.add(v);
                            }
                            const studentIndexSet = new Set();
                            const studentTextSet = new Set();
                            for (const v of studentSet) {
                                if (/^\d+$/.test(v))
                                    studentIndexSet.add(v);
                                if (validTexts.has(v))
                                    studentTextSet.add(v);
                            }
                            if (correctIndexSet.size > 0) {
                                correct = setsEqual(studentIndexSet, correctIndexSet);
                            }
                            else if (correctTextSet.size > 0) {
                                correct = setsEqual(studentTextSet, correctTextSet);
                            }
                            else {
                                correct = correctSet.size > 0 && setsEqual(studentSet, correctSet);
                            }
                        }
                        break;
                    }
                    case 'TRUE_FALSE':
                    case 'TRUEFALSE':
                    case 'TF': {
                        // Normalize correct set + student set to "true"/"false" entries; compare intersection.
                        const normCorrect = new Set();
                        for (const v of correctSet) {
                            const tf = normalizeTrueFalse(v);
                            if (tf)
                                normCorrect.add(tf);
                        }
                        const normStudent = new Set();
                        for (const v of studentSet) {
                            const tf = normalizeTrueFalse(v);
                            if (tf)
                                normStudent.add(tf);
                        }
                        // Fallback: if options is ["True","False"] or null, accept selectedOptions[0] 0=True,1=False
                        const opts = Array.isArray(question?.options) ? question.options : ['True', 'False'];
                        const idxToTF = {};
                        if (opts.length >= 2) {
                            const a = normalizeTrueFalse(opts[0]);
                            const b = normalizeTrueFalse(opts[1]);
                            if (a)
                                idxToTF[0] = a;
                            if (b)
                                idxToTF[1] = b;
                        }
                        if (Array.isArray(response.selectedOptions) && response.selectedOptions.length > 0) {
                            const mapped = idxToTF[Number(response.selectedOptions[0])];
                            if (mapped)
                                normStudent.add(mapped);
                        }
                        correct = normCorrect.size > 0 && setsIntersect(normStudent, normCorrect);
                        break;
                    }
                    case 'FILL_IN_BLANK':
                    case 'FIB':
                    case 'SHORT_ANSWER':
                    case 'SHORTANSWER': {
                        correct = correctSet.size > 0 && setsIntersect(studentSet, correctSet);
                        break;
                    }
                    default: {
                        // Unknown non-manual type: try generic intersection; flag manual if still unsure.
                        if (correctSet.size === 0)
                            manual = true;
                        else
                            correct = setsIntersect(studentSet, correctSet);
                    }
                }
            }
            if (manual)
                hasManualGradingNeeded = true;
            const pointsEarned = manual ? 0 : correct ? maxPoints : 0;
            if (!manual && correct)
                earnedTotal += maxPoints;
            // Update response
            await client_1.prisma.examResponse.update({
                where: { id: response.id },
                data: {
                    isCorrect: manual ? null : correct,
                    pointsEarned: pointsEarned,
                },
            });
        }
        const scorePct = totalMax > 0 ? (earnedTotal / totalMax) * 100 : 0;
        const grade = gradeFromPercentage(scorePct);
        const status = hasManualGradingNeeded ? 'submitted' : 'graded';
        const updated = await client_1.prisma.examAttempt.update({
            where: { id: attemptId },
            data: { score: scorePct, status },
        });
        await client_1.prisma.examResult.upsert({
            where: { attemptId },
            create: { attemptId, grade, issuedAt: new Date() },
            update: { grade, issuedAt: new Date() },
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
        const attempt = await client_1.prisma.examAttempt.findUnique({
            where: { id: response.attemptId },
            include: { responses: { include: { question: true } } },
        });
        if (attempt) {
            const responsesAll = attempt.responses || [];
            const totalMax = responsesAll.reduce((s, r) => s + (Number(r.question?.points ?? 1) || 1), 0);
            const earned = responsesAll.reduce((s, r) => s + (Number(r.pointsEarned ?? 0) || 0), 0);
            const allGraded = responsesAll.every((r) => r.isCorrect !== null);
            if (allGraded) {
                const pct = totalMax > 0 ? (earned / totalMax) * 100 : 0;
                const grade = gradeFromPercentage(pct);
                await client_1.prisma.examAttempt.update({
                    where: { id: attempt.id },
                    data: { score: pct, status: 'graded' },
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
        const grade = gradeFromPercentage(score);
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
