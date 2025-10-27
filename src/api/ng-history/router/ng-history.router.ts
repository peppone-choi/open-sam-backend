import { Router } from 'express';
import { NgHistoryController } from '../controller/ng-history.controller';
import { NgHistoryService } from '../service/ng-history.service';
import { NgHistoryRepository } from '../repository/ng-history.repository';

const router = Router();

// DI
const repository = new NgHistoryRepository();
const service = new NgHistoryService(repository);
const controller = new NgHistoryController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
