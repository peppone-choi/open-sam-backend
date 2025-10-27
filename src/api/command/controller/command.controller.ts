import { Request, Response, NextFunction } from 'express';
import { CommandService } from '../service/command.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse } from '../../../@types';

/**
 * Command Controller (요청/응답 처리)
 */
export class CommandController {
  constructor(private service: CommandService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;
      const generalId = req.query.generalId as string;

      if (generalId) {
        const commands = await this.service.getByGeneralId(generalId, limit, skip);
        res.json({ data: commands, count: commands.length, limit, skip });
      } else {
        const commands = await this.service.getExecuting();
        res.json({ data: commands, count: commands.length, limit, skip });
      }
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.submit(req.body);
      res.status(202).json({ messageId: result.messageId });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Command updates are handled by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Command deletion is handled by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  submit = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.submit(req.body);

      res.status(202).json({
        message: 'Command submitted successfully',
        messageId: result.messageId,
      });
    } catch (error) {
      next(error);
    }
  };

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
