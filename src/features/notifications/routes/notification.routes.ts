import { Router } from 'express';
import NotificationController from '../controllers/notification.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', requireRole(['SuperAdmin', 'Admin']), NotificationController.create);
router.get('/', NotificationController.list);
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);
router.delete('/delete-all', NotificationController.deleteAll);
router.delete('/:id', NotificationController.delete);

export default router;
