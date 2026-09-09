import { Router } from 'express';
import SettingsController from '../controllers/settings.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['SuperAdmin']));

router.get('/', SettingsController.list);
router.patch('/bulk', SettingsController.bulkUpdate);

router.get('/rbac/roles', SettingsController.listRoles);
router.get('/rbac/users', SettingsController.listUsersRBAC);
router.patch('/rbac/users/:userId/roles', SettingsController.assignUserRoles);

export default router;
