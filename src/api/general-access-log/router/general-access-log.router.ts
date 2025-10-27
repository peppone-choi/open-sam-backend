import { Router } from 'express';
import { GeneralAccessLogController } from '../controller/general-access-log.controller';
import { GeneralAccessLogService } from '../service/general-access-log.service';
import { GeneralAccessLogRepository } from '../repository/general-access-log.repository';

const router = Router();

// DI
const repository = new GeneralAccessLogRepository();
const service = new GeneralAccessLogService(repository);
const controller = new GeneralAccessLogController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
