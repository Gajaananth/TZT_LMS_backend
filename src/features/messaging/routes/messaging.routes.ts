import { Router } from 'express';
import MessagingController from '../controllers/messaging.controller';
import { requireAuth } from '@/middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/send', MessagingController.send);
router.get('/inbox', MessagingController.getInbox);
router.get('/templates', MessagingController.getTemplates);
router.get('/conversation/:partnerId', MessagingController.getConversation);
router.post('/read/:partnerId', MessagingController.markRead);

export default router;
