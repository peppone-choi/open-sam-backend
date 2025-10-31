import { Request, Response, NextFunction } from 'express';
import { CommandService } from '../../../core/command/CommandService';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse } from '../../../common/@types/api.types';

/**
 * Command Controller (요청/응답 처리)
 * 
 * Entity 기반 Service 사용
 */
export class CommandController {
  constructor(private service: CommandService) {}

  /**
   * 명령 목록 조회
   * 
   * GET /api/commands?commanderId=xxx&sessionId=xxx&limit=20&skip=0
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const commanderId = req.query.commanderId as string;
      const sessionId = req.query.sessionId as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      let commands;
      
      if (commanderId) {
        commands = await this.service.getByCommanderId(commanderId, sessionId, limit, skip);
      } else {
        commands = await this.service.getExecuting(sessionId);
      }

      const response: ApiResponse<typeof commands> = { data: commands };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 명령 제출
   * 
   * POST /api/commands
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.submit(req.body);
      
      res.status(202).json({
        message: '명령이 성공적으로 제출되었습니다.',
        messageId: result.messageId,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 명령 업데이트 (비활성화)
   * 
   * PUT /api/commands/:id
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, '명령 업데이트는 Game Daemon에서 처리됩니다.');
    } catch (error) {
      next(error);
    }
  };

  /**
   * 명령 삭제/취소
   * 
   * DELETE /api/commands/:id
   */
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const commanderId = req.body.commanderId || req.query.commanderId as string;
      
      if (!commanderId) {
        throw new HttpException(400, 'commanderId가 필요합니다.');
      }

      const command = await this.service.cancel(req.params.id, commanderId);
      
      const response: ApiResponse<typeof command> = { 
        data: command,
        message: '명령이 취소되었습니다.',
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 명령 제출 (별칭)
   * 
   * POST /api/commands/submit
   */
  submit = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.submit(req.body);

      res.status(202).json({
        message: '명령이 성공적으로 제출되었습니다.',
        messageId: result.messageId,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 명령 상세 조회
   * 
   * GET /api/commands/:id
   */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const command = await this.service.getById(req.params.id);

      if (!command) {
        throw new HttpException(404, '명령을 찾을 수 없습니다.');
      }

      const response: ApiResponse<typeof command> = { data: command };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 지휘관별 명령 조회
   * 
   * GET /api/commands/commander/:commanderId
   */
  getByCommanderId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const commanderId = req.params.commanderId || req.query.commanderId as string;
      
      if (!commanderId) {
        throw new HttpException(400, 'commanderId가 필요합니다.');
      }

      const sessionId = req.query.sessionId as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const commands = await this.service.getByCommanderId(commanderId, sessionId, limit, skip);

      const response: ApiResponse<typeof commands> = { data: commands };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}
