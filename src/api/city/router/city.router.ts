import { Router } from 'express';
import { CityController } from '../controller/city.controller';
import { CityService } from '../service/city.service';
import { CityRepository } from '../repository/city.repository';
import { BattleFieldTileRepository } from '../../battlefield-tile/repository/battlefield-tile.repository';
import { getCacheManager } from '../../../container';

const router = Router();

// DI
const cityRepo = new CityRepository();
const tileRepo = new BattleFieldTileRepository();
const cacheManager = getCacheManager();
const service = new CityService(cityRepo, cacheManager, tileRepo);
const controller = new CityController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
