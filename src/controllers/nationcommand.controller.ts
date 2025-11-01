import { Request, Response } from 'express';
import { GetReservedCommandService } from '../services/nationcommand/GetReservedCommand.service';
import { PushCommandService } from '../services/nationcommand/PushCommand.service';
import { RepeatCommandService } from '../services/nationcommand/RepeatCommand.service';
import { ReserveBulkCommandService } from '../services/nationcommand/ReserveBulkCommand.service';
import { ReserveCommandService } from '../services/nationcommand/ReserveCommand.service';

/**
 * NationcommandController
 * nationcommand 그룹의 모든 API 처리
 */
export class NationcommandController {

  /**
   * GetReservedCommand
   */
  static async getReservedCommand(req: Request, res: Response) {
    try {
      const result = await GetReservedCommandService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * PushCommand
   */
  static async pushCommand(req: Request, res: Response) {
    try {
      const result = await PushCommandService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * RepeatCommand
   */
  static async repeatCommand(req: Request, res: Response) {
    try {
      const result = await RepeatCommandService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ReserveBulkCommand
   */
  static async reserveBulkCommand(req: Request, res: Response) {
    try {
      const result = await ReserveBulkCommandService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ReserveCommand
   */
  static async reserveCommand(req: Request, res: Response) {
    try {
      const result = await ReserveCommandService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
