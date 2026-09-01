import { Router } from 'express';
import questionCtrl from '../controllers/question.controller';

const router = Router();

router.get('/', questionCtrl.listQuestions);
router.get('/:id', questionCtrl.getQuestion);
router.post('/', questionCtrl.createQuestion);
router.put('/:id', questionCtrl.updateQuestion);
router.delete('/:id', questionCtrl.deleteQuestion);

export default router;
