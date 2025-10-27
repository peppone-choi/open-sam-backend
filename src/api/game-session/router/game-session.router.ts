import { Router } from 'express';
import { GameSessionController } from '../controller/game-session.controller';
import { GameSessionService } from '../service/game-session.service';
import { GameSessionRepository } from '../repository/game-session.repository';

const router = Router();

// DI
const repository = new GameSessionRepository();
const service = new GameSessionService(repository);
const controller = new GameSessionController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
