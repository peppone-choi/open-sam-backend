import { Request, Response } from 'express';
import { ExitTroopService } from '../services/troop/ExitTroop.service';
import { JoinTroopService } from '../services/troop/JoinTroop.service';
import { KickFromTroopService } from '../services/troop/KickFromTroop.service';
import { ModifyTroopService } from '../services/troop/ModifyTroop.service';
import { SetLeaderCandidateService } from '../services/troop/SetLeaderCandidate.service';

/**
 * TroopController
 * troop 그룹의 모든 API 처리
 */
export class TroopController {

  /**
   * ExitTroop
   */
  static async exitTroop(req: Request, res: Response) {
    try {
      const result = await ExitTroopService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * JoinTroop
   */
  static async joinTroop(req: Request, res: Response) {
    try {
      const result = await JoinTroopService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * KickFromTroop
   */
  static async kickFromTroop(req: Request, res: Response) {
    try {
      const result = await KickFromTroopService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ModifyTroop
   */
  static async modifyTroop(req: Request, res: Response) {
    try {
      const result = await ModifyTroopService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SetLeaderCandidate
   */
  static async setLeaderCandidate(req: Request, res: Response) {
    try {
      const result = await SetLeaderCandidateService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
