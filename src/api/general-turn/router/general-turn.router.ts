import { Router } from 'express';
import { GeneralTurnController } from '../controller/general-turn.controller';
import { GeneralTurnService } from '../service/general-turn.service';
import { GeneralTurnRepository } from '../repository/general-turn.repository';

const router = Router();

// DI
const repository = new GeneralTurnRepository();
const service = new GeneralTurnService(repository);
const controller = new GeneralTurnController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
