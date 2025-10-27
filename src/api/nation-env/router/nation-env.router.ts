import { Router } from 'express';
import { NationEnvController } from '../controller/nation-env.controller';
import { NationEnvService } from '../service/nation-env.service';
import { NationEnvRepository } from '../repository/nation-env.repository';

const router = Router();

// DI
const repository = new NationEnvRepository();
const service = new NationEnvService(repository);
const controller = new NationEnvController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
