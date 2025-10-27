import { Router } from 'express';
import { SelectNpcTokenController } from '../controller/select-npc-token.controller';
import { SelectNpcTokenService } from '../service/select-npc-token.service';
import { SelectNpcTokenRepository } from '../repository/select-npc-token.repository';

const router = Router();

// DI
const repository = new SelectNpcTokenRepository();
const service = new SelectNpcTokenService(repository);
const controller = new SelectNpcTokenController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
