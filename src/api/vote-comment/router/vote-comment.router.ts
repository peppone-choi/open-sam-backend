import { Router } from 'express';
import { VoteCommentController } from '../controller/vote-comment.controller';
import { VoteCommentService } from '../service/vote-comment.service';
import { VoteCommentRepository } from '../repository/vote-comment.repository';

const router = Router();

// DI
const repository = new VoteCommentRepository();
const service = new VoteCommentService(repository);
const controller = new VoteCommentController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
