import { Router } from 'express';
import { NgAuctionController } from '../controller/ng-auction.controller';
import { NgAuctionService } from '../service/ng-auction.service';
import { NgAuctionRepository } from '../repository/ng-auction.repository';

const router = Router();

// DI
const repository = new NgAuctionRepository();
const service = new NgAuctionService(repository);
const controller = new NgAuctionController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
