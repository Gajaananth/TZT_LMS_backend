import { Router } from 'express';
import questionCtrl from '../controllers/question.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router();

// List/get questions are read-only and used by teachers/authors + exam creator UI;
// we still require authentication because question bank should not be public.
router.get('/', requireAuth, questionCtrl.listQuestions);
router.get('/:id', requireAuth, questionCtrl.getQuestion);

// Create / update / delete are teacher/admin only
router.post(
  '/',
  requireAuth,
  requireRole(['Teacher', 'Admin', 'SuperAdmin']),
  questionCtrl.createQuestion,
);
router.put(
  '/:id',
  requireAuth,
  requireRole(['Teacher', 'Admin', 'SuperAdmin']),
  questionCtrl.updateQuestion,
);
router.delete(
  '/:id',
  requireAuth,
  requireRole(['Teacher', 'Admin', 'SuperAdmin']),
  questionCtrl.deleteQuestion,
);

export default router;
