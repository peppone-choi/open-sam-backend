import { Router } from 'express';
import { StorageController } from '../controller/storage.controller';
import { StorageService } from '../service/storage.service';
import { StorageRepository } from '../repository/storage.repository';

const router = Router();

// DI
const repository = new StorageRepository();
const service = new StorageService(repository);
const controller = new StorageController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
