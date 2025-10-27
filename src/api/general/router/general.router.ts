import { Router } from 'express';
import { GeneralController } from '../controller/general.controller';
import { GeneralService } from '../service/general.service';
import { GeneralRepository } from '../repository/general.repository';
import { getCacheManager, getCommandQueue } from '../../../container';

const router = Router();

// DI
const repository = new GeneralRepository();
const service = new GeneralService(repository, getCacheManager(), getCommandQueue());
const controller = new GeneralController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
