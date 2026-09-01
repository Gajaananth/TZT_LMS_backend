import { Router } from 'express';
import SearchController from '../controllers/search.controller';
import { requireAuth } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/global', SearchController.global);

export default router;
