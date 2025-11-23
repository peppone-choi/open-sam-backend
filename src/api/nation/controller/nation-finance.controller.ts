import { Request, Response } from 'express';
import { NationFinanceService } from '../../../services/nation/NationFinance.service';
import { nationRepository } from '../../../repositories/nation.repository';
import { cityRepository } from '../../../repositories/city.repository';
import { generalRepository } from '../../../repositories/general.repository';
import { logger } from '../../../common/logger';

/**
 * 국가 재정 정보 조회 컨트롤러
 */
export class NationFinanceController {
  /**
   * GET /api/nation/:nationId/finance
   * 국가의 예상 수입/지출 조회
   */
  static async getFinanceEstimate(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.session_id as string || 'sangokushi_default';
      const nationId = parseInt(req.params.nationId, 10);

      if (isNaN(nationId)) {
        res.status(400).json({
          success: false,
          message: '유효하지 않은 국가 ID입니다'
        });
        return;
      }

      const nation = await nationRepository.findByNationNum(sessionId, nationId);
      if (!nation) {
        res.status(404).json({
          success: false,
          message: '국가를 찾을 수 없습니다'
        });
        return;
      }

      const cities = await cityRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });

      const generals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });

      const goldStats = await NationFinanceService.calculateGoldIncome(nation, cities, generals);
      const riceStats = await NationFinanceService.calculateRiceIncome(nation, cities, generals);

      res.json({
        success: true,
        data: {
          nationId,
          gold: {
            income: goldStats.income,
            outcome: goldStats.outcome,
            net: goldStats.net,
            breakdown: goldStats.breakdown
          },
          rice: {
            income: riceStats.income,
            outcome: riceStats.outcome,
            net: riceStats.net,
            breakdown: riceStats.breakdown
          },
          current: {
            gold: nation.data?.gold || 0,
            rice: nation.data?.rice || 0
          }
        }
      });
    } catch (error: any) {
      logger.error('[NationFinanceController] Error in getFinanceEstimate', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: '재정 정보 조회 중 오류가 발생했습니다'
      });
    }
  }

  /**
   * GET /api/nation/:nationId/finance/history
   * 국가의 재정 변동 히스토리 조회
   */
  static async getFinanceHistory(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.session_id as string || 'sangokushi_default';
      const nationId = parseInt(req.params.nationId, 10);
      const limit = parseInt(req.query.limit as string, 10) || 10;

      if (isNaN(nationId)) {
        res.status(400).json({
          success: false,
          message: '유효하지 않은 국가 ID입니다'
        });
        return;
      }

      // TODO: Implement finance history tracking
      // For now, return empty array
      res.json({
        success: true,
        data: {
          nationId,
          history: []
        }
      });
    } catch (error: any) {
      logger.error('[NationFinanceController] Error in getFinanceHistory', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: '재정 히스토리 조회 중 오류가 발생했습니다'
      });
    }
  }
}
