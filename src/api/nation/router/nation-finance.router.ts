import { Router } from 'express';
import { NationFinanceController } from '../controller/nation-finance.controller';

const router = Router();

/**
 * 국가 재정 API 라우터
 */

// GET /api/nation/:nationId/finance - 국가 재정 예상 수입/지출 조회
router.get('/:nationId/finance', NationFinanceController.getFinanceEstimate);

// GET /api/nation/:nationId/finance/history - 국가 재정 히스토리 조회
router.get('/:nationId/finance/history', NationFinanceController.getFinanceHistory);

export default router;
