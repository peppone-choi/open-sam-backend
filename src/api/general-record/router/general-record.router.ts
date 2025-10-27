import { Router } from 'express';
import { GeneralRecordController } from '../controller/general-record.controller';
import { GeneralRecordService } from '../service/general-record.service';
import { GeneralRecordRepository } from '../repository/general-record.repository';

const router = Router();

// DI
const repository = new GeneralRecordRepository();
const service = new GeneralRecordService(repository);
const controller = new GeneralRecordController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
