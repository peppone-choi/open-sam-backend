import { Router } from 'express';
import { NationTurnController } from '../controller/nation-turn.controller';
import { NationTurnService } from '../service/nation-turn.service';
import { NationTurnRepository } from '../repository/nation-turn.repository';

const router = Router();

// DI
const repository = new NationTurnRepository();
const service = new NationTurnService(repository);
const controller = new NationTurnController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
