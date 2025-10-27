import { Router } from 'express';
import { SelectPoolController } from '../controller/select-pool.controller';
import { SelectPoolService } from '../service/select-pool.service';
import { SelectPoolRepository } from '../repository/select-pool.repository';

const router = Router();

// DI
const repository = new SelectPoolRepository();
const service = new SelectPoolService(repository);
const controller = new SelectPoolController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
