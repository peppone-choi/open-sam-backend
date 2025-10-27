import { Router } from 'express';
import { NgBettingController } from '../controller/ng-betting.controller';
import { NgBettingService } from '../service/ng-betting.service';
import { NgBettingRepository } from '../repository/ng-betting.repository';

const router = Router();

// DI
const repository = new NgBettingRepository();
const service = new NgBettingService(repository);
const controller = new NgBettingController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
