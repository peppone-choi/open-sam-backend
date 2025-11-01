import { Request, Response } from 'express';
import { BuildNationCandidateService } from '../services/general/BuildNationCandidate.service';
import { DieOnPrestartService } from '../services/general/DieOnPrestart.service';
import { DropItemService } from '../services/general/DropItem.service';
import { GetGeneralInfoService } from '../services/general/GetGeneralInfo.service';
import { GetItemListService } from '../services/general/GetItemList.service';
import { GetOtherGeneralInfoService } from '../services/general/GetOtherGeneralInfo.service';
import { PickItemService } from '../services/general/PickItem.service';
import { SetItemsService } from '../services/general/SetItems.service';

/**
 * GeneralController
 * general 그룹의 모든 API 처리
 */
export class GeneralController {

  /**
   * BuildNationCandidate
   */
  static async buildNationCandidate(req: Request, res: Response) {
    try {
      const result = await BuildNationCandidateService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * DieOnPrestart
   */
  static async dieOnPrestart(req: Request, res: Response) {
    try {
      const result = await DieOnPrestartService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * DropItem
   */
  static async dropItem(req: Request, res: Response) {
    try {
      const result = await DropItemService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetGeneralInfo
   */
  static async getGeneralInfo(req: Request, res: Response) {
    try {
      const result = await GetGeneralInfoService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetItemList
   */
  static async getItemList(req: Request, res: Response) {
    try {
      const result = await GetItemListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetOtherGeneralInfo
   */
  static async getOtherGeneralInfo(req: Request, res: Response) {
    try {
      const result = await GetOtherGeneralInfoService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * PickItem
   */
  static async pickItem(req: Request, res: Response) {
    try {
      const result = await PickItemService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * SetItems
   */
  static async setItems(req: Request, res: Response) {
    try {
      const result = await SetItemsService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
