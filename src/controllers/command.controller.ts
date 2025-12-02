import { Request, Response } from 'express';
import { GetReservedCommandService } from '../services/command/GetReservedCommand.service';
import { PushCommandService } from '../services/command/PushCommand.service';
import { RepeatCommandService } from '../services/command/RepeatCommand.service';
import { ReserveBulkCommandService } from '../services/command/ReserveBulkCommand.service';
import { ReserveCommandService } from '../services/command/ReserveCommand.service';

/**
 * CommandController
 * command 그룹의 모든 API 처리
 */
export class CommandController {

  /**
   * GetReservedCommand
   */
  static async getReservedCommand(req: Request, res: Response) {
    try {
      // GET 요청이므로 req.query 사용
      const result = await GetReservedCommandService.execute(req.query, req.user);
      return CommandController.respond(res, result);
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
      return CommandController.respond(res, result);
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
      return CommandController.respond(res, result);
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
      return CommandController.respond(res, result);
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
      // 디버깅: req.body 원본 로깅
      console.log('[CommandController.reserveCommand] req.body:', JSON.stringify(req.body));
      console.log('[CommandController.reserveCommand] req.body.arg:', JSON.stringify(req.body?.arg));
      console.log('[CommandController.reserveCommand] arg type:', typeof req.body?.arg);
      
      const result = await ReserveCommandService.execute(req.body, req.user);
      return CommandController.respond(res, result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  private static respond(res: Response, result: any) {
    if (result?.success === false) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }
}

