import { Router } from 'express';
import { BattleFieldTileController } from '../controller/battlefield-tile.controller';
import { BattleFieldTileService } from '../service/battlefield-tile.service';
import { BattleFieldTileRepository } from '../repository/battlefield-tile.repository';

const router = Router();

// DI
const repository = new BattleFieldTileRepository();
const service = new BattleFieldTileService(repository);
const controller = new BattleFieldTileController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
