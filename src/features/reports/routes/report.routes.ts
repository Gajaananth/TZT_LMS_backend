import { Router } from 'express';
import ReportController from '../controllers/report.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/generate', requireRole(['SuperAdmin', 'Admin']), ReportController.generate);
router.get('/generated', requireRole(['SuperAdmin', 'Admin']), ReportController.list);

export default router;
