import { Router } from 'express';
import DiscussionController from '../controllers/discussion.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', DiscussionController.list);
router.post('/', DiscussionController.create);
router.post('/:topicId/replies', DiscussionController.reply);
router.post('/replies/:replyId/react', DiscussionController.react);

// moderation endpoints (pin/delete) will be added later
export default router;
