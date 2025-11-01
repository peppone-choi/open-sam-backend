import { Request, Response } from 'express';
import { CheckServerOnlineService } from '../services/global/CheckServerOnline.service';
import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { GeneralListService } from '../services/global/GeneralList.service';
import { GeneralListWithTokenService } from '../services/global/GeneralListWithToken.service';
import { GetCitiesBriefService } from '../services/global/GetCitiesBrief.service';
import { GetCityDetailedInfoService } from '../services/global/GetCityDetailedInfo.service';
import { GetDiplomacyInfoService } from '../services/global/GetDiplomacyInfo.service';
import { GetLastTurnService } from '../services/global/GetLastTurn.service';
import { GetNationListService } from '../services/global/GetNationList.service';
import { GetStaticInfoService } from '../services/global/GetStaticInfo.service';
import { GetTurnLogService } from '../services/global/GetTurnLog.service';
import { GetWarLogService } from '../services/global/GetWarLog.service';

/**
 * GlobalController
 * global 그룹의 모든 API 처리
 */
export class GlobalController {

  /**
   * CheckServerOnline
   */
  static async checkServerOnline(req: Request, res: Response) {
    try {
      const result = await CheckServerOnlineService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ExecuteEngine
   */
  static async executeEngine(req: Request, res: Response) {
    try {
      const result = await ExecuteEngineService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

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
   * GeneralListWithToken
   */
  static async generalListWithToken(req: Request, res: Response) {
    try {
      const result = await GeneralListWithTokenService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetCitiesBrief
   */
  static async getCitiesBrief(req: Request, res: Response) {
    try {
      const result = await GetCitiesBriefService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetCityDetailedInfo
   */
  static async getCityDetailedInfo(req: Request, res: Response) {
    try {
      const result = await GetCityDetailedInfoService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetDiplomacyInfo
   */
  static async getDiplomacyInfo(req: Request, res: Response) {
    try {
      const result = await GetDiplomacyInfoService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetLastTurn
   */
  static async getLastTurn(req: Request, res: Response) {
    try {
      const result = await GetLastTurnService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetNationList
   */
  static async getNationList(req: Request, res: Response) {
    try {
      const result = await GetNationListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetStaticInfo
   */
  static async getStaticInfo(req: Request, res: Response) {
    try {
      const result = await GetStaticInfoService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetTurnLog
   */
  static async getTurnLog(req: Request, res: Response) {
    try {
      const result = await GetTurnLogService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetWarLog
   */
  static async getWarLog(req: Request, res: Response) {
    try {
      const result = await GetWarLogService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
