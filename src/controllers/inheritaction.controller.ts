import { Request, Response } from 'express';
import { BuyHiddenBuffService } from '../services/inheritaction/BuyHiddenBuff.service';
import { BuyRandomUniqueService } from '../services/inheritaction/BuyRandomUnique.service';
import { CheckOwnerService } from '../services/inheritaction/CheckOwner.service';
import { GetInheritPointListService } from '../services/inheritaction/GetInheritPointList.service';
import { GetPrevCharListService } from '../services/inheritaction/GetPrevCharList.service';
import { PickSpecificUniqueService } from '../services/inheritaction/PickSpecificUnique.service';
import { ResetAttrService } from '../services/inheritaction/ResetAttr.service';
import { SelectSpecialService } from '../services/inheritaction/SelectSpecial.service';

/**
 * InheritactionController
 * inheritaction 그룹의 모든 API 처리
 */
export class InheritactionController {

  /**
   * BuyHiddenBuff
   */
  static async buyHiddenBuff(req: Request, res: Response) {
    try {
      const result = await BuyHiddenBuffService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * BuyRandomUnique
   */
  static async buyRandomUnique(req: Request, res: Response) {
    try {
      const result = await BuyRandomUniqueService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * CheckOwner
   */
  static async checkOwner(req: Request, res: Response) {
    try {
      const result = await CheckOwnerService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetInheritPointList
   */
  static async getInheritPointList(req: Request, res: Response) {
    try {
      const result = await GetInheritPointListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetPrevCharList
   */
  static async getPrevCharList(req: Request, res: Response) {
    try {
      const result = await GetPrevCharListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * PickSpecificUnique
   */
  static async pickSpecificUnique(req: Request, res: Response) {
    try {
      const result = await PickSpecificUniqueService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ResetAttr
   */
  static async resetAttr(req: Request, res: Response) {
    try {
      const result = await ResetAttrService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SelectSpecial
   */
  static async selectSpecial(req: Request, res: Response) {
    try {
      const result = await SelectSpecialService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
