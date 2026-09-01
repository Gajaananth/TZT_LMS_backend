import { Router } from 'express';
import CertificateController from '../controllers/certificate.controller';
import { requireAuth, requireRole } from '@/middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.get('/templates', requireAuth, CertificateController.listTemplates);
router.post('/templates', requireRole(['SuperAdmin', 'Admin']), CertificateController.createTemplate);
router.post('/generate', requireRole(['SuperAdmin', 'Admin', 'Teacher']), CertificateController.generate);
// public verification endpoint (no auth)
router.get('/verify/:code', CertificateController.verify);

export default router;
