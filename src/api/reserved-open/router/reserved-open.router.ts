import { Router } from 'express';
import { ReservedOpenController } from '../controller/reserved-open.controller';
import { ReservedOpenService } from '../service/reserved-open.service';
import { ReservedOpenRepository } from '../repository/reserved-open.repository';

const router = Router();

// DI
const repository = new ReservedOpenRepository();
const service = new ReservedOpenService(repository);
const controller = new ReservedOpenController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
