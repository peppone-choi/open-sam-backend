import { Router } from 'express';
import { CommentController } from '../controller/comment.controller';
import { CommentService } from '../service/comment.service';
import { CommentRepository } from '../repository/comment.repository';

const router = Router();

// DI
const repository = new CommentRepository();
const service = new CommentService(repository);
const controller = new CommentController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
