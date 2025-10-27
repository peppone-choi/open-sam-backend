import { Router } from 'express';
import { NgAuctionBidController } from '../controller/ng-auction-bid.controller';
import { NgAuctionBidService } from '../service/ng-auction-bid.service';
import { NgAuctionBidRepository } from '../repository/ng-auction-bid.repository';

const router = Router();

// DI
const repository = new NgAuctionBidRepository();
const service = new NgAuctionBidService(repository);
const controller = new NgAuctionBidController(service);

// Routes
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
