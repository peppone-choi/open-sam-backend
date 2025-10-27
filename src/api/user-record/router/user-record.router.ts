import { Router } from 'express';
import { UserRecordController } from '../controller/user-record.controller';
import { UserRecordService } from '../service/user-record.service';
import { UserRecordRepository } from '../repository/user-record.repository';

const router = Router();

// DI
const repository = new UserRecordRepository();
const service = new UserRecordService(repository);
const controller = new UserRecordController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
