import { Router } from 'express';
import basicRouter from './basic';
import boardRouter from './board';
import mapRouter from './map';
import generalRouter from './general';
import diplomacyRouter from './diplomacy';
import serverRouter from './server';
import auctionRouter from './auction';
import commandRouter from './command';
import messageRouter from './message';
import voteRouter from './vote';
import simulatorRouter from './simulator';
import settingRouter from './setting';
import vacationRouter from './vacation';
import troopRouter from './troop';

const router = Router();

router.use('/', basicRouter);
router.use('/', boardRouter);
router.use('/', mapRouter);
router.use('/', generalRouter);
router.use('/', diplomacyRouter);
router.use('/', serverRouter);
router.use('/', auctionRouter);
router.use('/', commandRouter);
router.use('/', messageRouter);
router.use('/', voteRouter);
router.use('/', simulatorRouter);
router.use('/', settingRouter);
router.use('/', vacationRouter);
router.use('/', troopRouter);

export default router;
