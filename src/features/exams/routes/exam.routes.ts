import { Router } from 'express';
import examCtrl from '../controllers/exam.controller';
import { requireAuth } from '@/middleware/auth.middleware';

const router = Router();

// List all exams
router.get('/', requireAuth, examCtrl.listExams);

// Get single exam with questions
router.get('/:examId', requireAuth, examCtrl.getExam);

// Get exam question set
router.get('/:examId/questions', requireAuth, examCtrl.getExamQuestions);

// Start exam attempt
router.post('/start', requireAuth, examCtrl.startExam);

// Autosave responses
router.post('/:attemptId/autosave', requireAuth, examCtrl.autosave);

// Resume attempt
router.get('/:attemptId/resume', requireAuth, examCtrl.resume);

// Submit attempt (triggers grading)
router.post('/:attemptId/submit', requireAuth, examCtrl.submit);

// Get results
router.get('/:attemptId/results', requireAuth, examCtrl.getResults);

// Get detailed results
router.get('/:attemptId/details', requireAuth, examCtrl.getDetails);

export default router;
