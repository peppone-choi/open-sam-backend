import { Router } from 'express';
import { TroopController } from '../controller/troop.controller';
import { TroopService } from '../service/troop.service';
import { TroopRepository } from '../repository/troop.repository';

const router = Router();

// DI
const repository = new TroopRepository();
const service = new TroopService(repository);
const controller = new TroopController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
