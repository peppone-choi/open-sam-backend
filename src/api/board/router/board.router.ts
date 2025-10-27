import { Router } from 'express';
import { BoardController } from '../controller/board.controller';
import { BoardService } from '../service/board.service';
import { BoardRepository } from '../repository/board.repository';

const router = Router();

// DI
const repository = new BoardRepository();
const service = new BoardService(repository);
const controller = new BoardController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
