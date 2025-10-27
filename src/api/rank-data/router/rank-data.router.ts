import { Router } from 'express';
import { RankDataController } from '../controller/rank-data.controller';
import { RankDataService } from '../service/rank-data.service';
import { RankDataRepository } from '../repository/rank-data.repository';

const router = Router();

// DI
const repository = new RankDataRepository();
const service = new RankDataService(repository);
const controller = new RankDataController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
