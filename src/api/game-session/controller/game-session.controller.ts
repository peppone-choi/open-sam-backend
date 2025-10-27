import { Request, Response, NextFunction } from 'express';
import { GameSessionService } from '../service/game-session.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class GameSessionController {
  constructor(private service: GameSessionService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;
      const status = req.query.status as any;
      const scenarioId = req.query.scenarioId as string;

      let sessions;
      let count;

      if (status) {
        sessions = await this.service.getByStatus(status, limit, skip);
        count = await this.service.count({ status });
      } else if (scenarioId) {
        sessions = await this.service.getByScenarioId(scenarioId);
        count = sessions.length;
      } else {
        sessions = await this.service.getAll(limit, skip);
        count = await this.service.count();
      }

      const response: Paginated<typeof sessions[0]> = {
        data: sessions,
        count,
        limit,
        skip,
      };
      res.json(response);
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
      const session = await this.service.getById(req.params.id);

      if (!session) {
        throw new HttpException(404, 'GameSession not found');
      }

      const response: ApiResponse<typeof session> = { data: session };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = await this.service.create(req.body);

      const response: ApiResponse<typeof session> = { data: session };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = await this.service.update(req.params.id, req.body);

      if (!session) {
        throw new HttpException(404, 'GameSession not found');
      }

      const response: ApiResponse<typeof session> = { data: session };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const deleted = await this.service.delete(req.params.id);

      if (!deleted) {
        throw new HttpException(404, 'GameSession not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
