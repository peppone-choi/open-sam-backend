import { Request, Response, NextFunction } from 'express';
import { CommandService } from '../service/command.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse } from '../../../@types';

/**
 * Command Controller (요청/응답 처리)
 */
export class CommandController {
  constructor(private service: CommandService) {}

  /**
   * POST /api/commands
   * 명령 제출
   */
  submit = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // TODO: DTO 검증 (validate middleware에서 처리됨)
      const result = await this.service.submit(req.body);

      // TODO: 응답 (명령 접수됨)
      res.status(202).json({
        message: 'Command submitted successfully',
        messageId: result.messageId,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/commands/:id
   * 명령 조회
   */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const command = await this.service.getById(req.params.id);

      if (!command) {
        throw new HttpException(404, 'Command not found');
      }

      const response: ApiResponse<typeof command> = { data: command };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/commands?generalId=xxx
   * 장수별 명령 조회
   */
  getByGeneralId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const generalId = req.query.generalId as string;
      if (!generalId) {
        throw new HttpException(400, 'generalId is required');
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const commands = await this.service.getByGeneralId(generalId, limit, skip);

      res.json({ data: commands, count: commands.length, limit, skip });
    } catch (error) {
      next(error);
    }
  };
}
