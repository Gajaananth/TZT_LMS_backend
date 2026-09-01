import { Router } from 'express';
import gradingCtrl from '../controllers/grading.controller';

const router = Router();

router.post('/auto/:attemptId', gradingCtrl.runAutoGrader);
router.get('/queue', gradingCtrl.getManualQueue);
router.post('/manual/:attemptId', gradingCtrl.manualGrade);

export default router;
