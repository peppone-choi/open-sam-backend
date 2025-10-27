import { Router } from 'express';
import { VoteController } from '../controller/vote.controller';
import { VoteService } from '../service/vote.service';
import { VoteRepository } from '../repository/vote.repository';

const router = Router();

// DI
const repository = new VoteRepository();
const service = new VoteService(repository);
const controller = new VoteController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
