import { Router } from 'express';
import { CityController } from '../controller/city.controller';
import { CityService } from '../service/city.service';
import { CityRepository } from '../repository/city.repository';

const router = Router();

// DI
const cityRepo = new CityRepository();
const service = new CityService(cityRepo);
const controller = new CityController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
