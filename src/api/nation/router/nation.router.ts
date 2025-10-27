import { Router } from 'express';
import { NationController } from '../controller/nation.controller';
import { NationService } from '../service/nation.service';
import { NationRepository } from '../repository/nation.repository';

const router = Router();

// DI
const repository = new NationRepository();
const service = new NationService(repository);
const controller = new NationController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
