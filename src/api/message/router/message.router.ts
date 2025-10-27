import { Router } from 'express';
import { MessageController } from '../controller/message.controller';
import { MessageService } from '../service/message.service';
import { MessageRepository } from '../repository/message.repository';

const router = Router();

// DI
const repository = new MessageRepository();
const service = new MessageService(repository);
const controller = new MessageController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
