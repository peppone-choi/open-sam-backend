import { Router } from 'express';
import { BattleController } from '../controller/battle.controller';
import { BattleService } from '../../services/battle/StartBattle.service';
import { BattleRepository } from '../../models/battle.model';

const router = Router();

// DI
const repository = new BattleRepository();
const service = new BattleService(repository);
const controller = new BattleController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
