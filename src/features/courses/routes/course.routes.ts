import { Router } from 'express';
import CourseController from '../controllers/course.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', CourseController.list);
router.post('/', requireRole(['SuperAdmin', 'Admin', 'Teacher']), CourseController.create);
router.get('/:id', CourseController.get);
router.put('/:id', requireRole(['SuperAdmin', 'Admin', 'Teacher']), CourseController.update);
router.delete('/:id', requireRole(['SuperAdmin', 'Admin']), CourseController.remove);

export default router;
