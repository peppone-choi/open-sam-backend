import { Router } from 'express';
import { CommandController } from '../controller/command.controller';
import { CommandService } from '../service/command.service';
import { CommandRepository } from '../repository/command.repository';
import { getCommandQueue } from '../../../container';

const router = Router();

// DI
const repository = new CommandRepository();
const service = new CommandService(repository, getCommandQueue());
const controller = new CommandController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
