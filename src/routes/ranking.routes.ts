import { Router } from 'express';
import { RankingController } from '../controllers/ranking.controller';

const router = Router();
const controller = new RankingController();

// 장수 랭킹 조회 (Hall of Fame)
router.get('/generals', controller.getGeneralRanking.bind(controller));

// 국가 랭킹 조회
router.get('/nations', controller.getNationRanking.bind(controller));

// 연혁(역사) 조회
router.get('/history', controller.getHistory.bind(controller));

export default router;

