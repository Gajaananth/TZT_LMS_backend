import { Router } from 'express';
import MessagingController from '../controllers/messaging.controller';
import GroupChatController from '../controllers/group.chat.controller';
import { requireAuth } from '@/middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// Direct 1-on-1 messaging
router.post('/send', MessagingController.send);
router.get('/inbox', MessagingController.getInbox);
router.get('/templates', MessagingController.getTemplates);
router.get('/conversation/:partnerId', MessagingController.getConversation);
router.post('/read/:partnerId', MessagingController.markRead);

// Subject Study Groups (Max 20 students per group, unlimited groups per teacher)
router.post('/groups', GroupChatController.createGroup);
router.get('/groups', GroupChatController.listGroups);
router.get('/groups/:groupId', GroupChatController.getGroup);
router.post('/groups/:groupId/leader', GroupChatController.setLeader);
router.post('/groups/:groupId/members', GroupChatController.addMember);
router.delete('/groups/:groupId/members/:userId', GroupChatController.removeMember);
router.post('/groups/:groupId/mute', GroupChatController.muteMember);
router.post('/groups/:groupId/unmute', GroupChatController.unmuteMember);
router.get('/groups/:groupId/messages', GroupChatController.getMessages);
router.post('/groups/:groupId/messages', GroupChatController.sendMessage);
router.post('/groups/:groupId/messages/:messageId/flag', GroupChatController.flagMessage);
router.delete('/groups/:groupId/messages/:messageId', GroupChatController.deleteMessage);

export default router;
