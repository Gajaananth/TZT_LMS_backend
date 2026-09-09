import { parseCorrectAnswerSet, buildStudentAnswerSet } from '../src/features/grading/services/grading.service';

describe('Grading helpers (JSON correctAnswer + student answer normalization)', () => {
  describe('parseCorrectAnswerSet', () => {
    it('handles scalar string', () => {
      const s = parseCorrectAnswerSet('Photosynthesis');
      expect(s.has('photosynthesis')).toBe(true);
    });

    it('handles scalar number (MCQ index)', () => {
      const s = parseCorrectAnswerSet(1);
      expect(s.has('1')).toBe(true);
    });

    it('handles JSON array of strings for MSQ', () => {
      const s = parseCorrectAnswerSet(['Paris', 'Berlin']);
      expect(s.has('paris')).toBe(true);
      expect(s.has('berlin')).toBe(true);
    });

    it('handles JSON array of numeric indices for MSQ', () => {
      const s = parseCorrectAnswerSet([0, 2]);
      expect(s.has('0')).toBe(true);
      expect(s.has('2')).toBe(true);
    });

    it('normalizes True/False variants', () => {
      const s = parseCorrectAnswerSet('True');
      expect(s.has('true')).toBe(true);
      const s2 = parseCorrectAnswerSet('FALSE');
      expect(s2.has('false')).toBe(true);
    });

    it('returns empty set for null', () => {
      expect(parseCorrectAnswerSet(null).size).toBe(0);
    });
  });

  describe('buildStudentAnswerSet', () => {
    it('includes selected indices AND option texts when options array is present', () => {
      const s = buildStudentAnswerSet([1, 2], '', ['Paris', 'London', 'Berlin']);
      expect(s.has('1')).toBe(true);
      expect(s.has('2')).toBe(true);
      expect(s.has('london')).toBe(true);
      expect(s.has('berlin')).toBe(true);
    });

    it('includes answerText normalized and with tf + numeric interpretations', () => {
      const s = buildStudentAnswerSet([], '  TRUE  ', null);
      expect(s.has('true')).toBe(true);
    });

    it('handles True_False selectedOptions[0] = 0 with options True/False', () => {
      const s = buildStudentAnswerSet([0], '', ['True', 'False']);
      expect(s.has('0')).toBe(true);
      expect(s.has('true')).toBe(true);
    });
  });
});
