import { Request, Response } from 'express';
import { BetService } from '../services/betting/Bet.service';
import { GetBettingDetailService } from '../services/betting/GetBettingDetail.service';
import { GetBettingListService } from '../services/betting/GetBettingList.service';

/**
 * BettingController
 * betting 그룹의 모든 API 처리
 */
export class BettingController {

  /**
   * Bet
   */
  static async bet(req: Request, res: Response) {
    try {
      const result = await BetService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetBettingDetail
   */
  static async getBettingDetail(req: Request, res: Response) {
    try {
      const result = await GetBettingDetailService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetBettingList
   */
  static async getBettingList(req: Request, res: Response) {
    try {
      const result = await GetBettingListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
