import { Router } from 'express';
import { EventController } from '../controller/event.controller';
import { EventService } from '../service/event.service';
import { EventRepository } from '../repository/event.repository';

const router = Router();

// DI
const repository = new EventRepository();
const service = new EventService(repository);
const controller = new EventController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
