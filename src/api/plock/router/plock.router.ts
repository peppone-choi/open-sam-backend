import { Router } from 'express';
import { PlockController } from '../controller/plock.controller';
import { PlockService } from '../service/plock.service';
import { PlockRepository } from '../repository/plock.repository';

const router = Router();

// DI
const repository = new PlockRepository();
const service = new PlockService(repository);
const controller = new PlockController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
