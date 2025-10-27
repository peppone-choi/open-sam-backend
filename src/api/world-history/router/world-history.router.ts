import { Router } from 'express';
import { WorldHistoryController } from '../controller/world-history.controller';
import { WorldHistoryService } from '../service/world-history.service';
import { WorldHistoryRepository } from '../repository/world-history.repository';

const router = Router();

// DI
const repository = new WorldHistoryRepository();
const service = new WorldHistoryService(repository);
const controller = new WorldHistoryController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
