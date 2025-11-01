import { Request, Response } from 'express';
import { GeneralListService } from '../services/nation/GeneralList.service';
import { GetGeneralLogService } from '../services/nation/GetGeneralLog.service';
import { GetNationInfoService } from '../services/nation/GetNationInfo.service';
import { GrantPowerService } from '../services/nation/GrantPower.service';
import { JoinNationService } from '../services/nation/JoinNation.service';
import { KickGeneralService } from '../services/nation/KickGeneral.service';
import { ModifyDiplomacyService } from '../services/nation/ModifyDiplomacy.service';
import { SetChiefAttrService } from '../services/nation/SetChiefAttr.service';
import { SetNationAttrService } from '../services/nation/SetNationAttr.service';
import { TransferNationOwnerService } from '../services/nation/TransferNationOwner.service';
import { WithdrawNationService } from '../services/nation/WithdrawNation.service';

/**
 * NationController
 * nation 그룹의 모든 API 처리
 */
export class NationController {

  /**
   * GeneralList
   */
  static async generalList(req: Request, res: Response) {
    try {
      const result = await GeneralListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetGeneralLog
   */
  static async getGeneralLog(req: Request, res: Response) {
    try {
      const result = await GetGeneralLogService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetNationInfo
   */
  static async getNationInfo(req: Request, res: Response) {
    try {
      const result = await GetNationInfoService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GrantPower
   */
  static async grantPower(req: Request, res: Response) {
    try {
      const result = await GrantPowerService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * JoinNation
   */
  static async joinNation(req: Request, res: Response) {
    try {
      const result = await JoinNationService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * KickGeneral
   */
  static async kickGeneral(req: Request, res: Response) {
    try {
      const result = await KickGeneralService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ModifyDiplomacy
   */
  static async modifyDiplomacy(req: Request, res: Response) {
    try {
      const result = await ModifyDiplomacyService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SetChiefAttr
   */
  static async setChiefAttr(req: Request, res: Response) {
    try {
      const result = await SetChiefAttrService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SetNationAttr
   */
  static async setNationAttr(req: Request, res: Response) {
    try {
      const result = await SetNationAttrService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * TransferNationOwner
   */
  static async transferNationOwner(req: Request, res: Response) {
    try {
      const result = await TransferNationOwnerService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * WithdrawNation
   */
  static async withdrawNation(req: Request, res: Response) {
    try {
      const result = await WithdrawNationService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
