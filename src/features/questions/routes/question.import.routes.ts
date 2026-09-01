import { Router } from 'express';
import QuestionImportController from '../controllers/question.import.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/import', requireRole(['SuperAdmin', 'Admin', 'Teacher']), QuestionImportController.import);
router.get('/export', requireRole(['SuperAdmin', 'Admin', 'Teacher']), QuestionImportController.export);

export default router;
