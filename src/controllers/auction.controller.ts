import { Request, Response } from 'express';
import { BidBuyRiceAuctionService } from '../services/auction/BidBuyRiceAuction.service';
import { BidSellRiceAuctionService } from '../services/auction/BidSellRiceAuction.service';
import { BidUniqueAuctionService } from '../services/auction/BidUniqueAuction.service';
import { GetActiveResourceAuctionListService } from '../services/auction/GetActiveResourceAuctionList.service';
import { GetUniqueItemAuctionDetailService } from '../services/auction/GetUniqueItemAuctionDetail.service';
import { GetUniqueItemAuctionListService } from '../services/auction/GetUniqueItemAuctionList.service';
import { OpenBuyRiceAuctionService } from '../services/auction/OpenBuyRiceAuction.service';
import { OpenSellRiceAuctionService } from '../services/auction/OpenSellRiceAuction.service';
import { OpenUniqueAuctionService } from '../services/auction/OpenUniqueAuction.service';

/**
 * AuctionController
 * auction 그룹의 모든 API 처리
 */
export class AuctionController {

  /**
   * BidBuyRiceAuction
   */
  static async bidBuyRiceAuction(req: Request, res: Response) {
    try {
      const result = await BidBuyRiceAuctionService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * BidSellRiceAuction
   */
  static async bidSellRiceAuction(req: Request, res: Response) {
    try {
      const result = await BidSellRiceAuctionService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * BidUniqueAuction
   */
  static async bidUniqueAuction(req: Request, res: Response) {
    try {
      const result = await BidUniqueAuctionService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetActiveResourceAuctionList
   */
  static async getActiveResourceAuctionList(req: Request, res: Response) {
    try {
      const result = await GetActiveResourceAuctionListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetUniqueItemAuctionDetail
   */
  static async getUniqueItemAuctionDetail(req: Request, res: Response) {
    try {
      const result = await GetUniqueItemAuctionDetailService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * GetUniqueItemAuctionList
   */
  static async getUniqueItemAuctionList(req: Request, res: Response) {
    try {
      const result = await GetUniqueItemAuctionListService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * OpenBuyRiceAuction
   */
  static async openBuyRiceAuction(req: Request, res: Response) {
    try {
      const result = await OpenBuyRiceAuctionService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * OpenSellRiceAuction
   */
  static async openSellRiceAuction(req: Request, res: Response) {
    try {
      const result = await OpenSellRiceAuctionService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * OpenUniqueAuction
   */
  static async openUniqueAuction(req: Request, res: Response) {
    try {
      const result = await OpenUniqueAuctionService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
