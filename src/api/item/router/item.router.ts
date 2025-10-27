import { Router } from 'express';
import { ItemController } from '../controller/item.controller';
import { ItemService } from '../service/item.service';
import { ItemRepository } from '../repository/item.repository';

const router = Router();

// DI
const repository = new ItemRepository();
const service = new ItemService(repository);
const controller = new ItemController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
