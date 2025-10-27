import { Request, Response, NextFunction } from 'express';
import { NationService } from '../service/nation.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class NationController {
  constructor(private service: NationService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;
      const sessionId = req.query.sessionId as string;

      let nations;
      let count;

      if (sessionId) {
        nations = await this.service.getBySessionId(sessionId, limit, skip);
        count = await this.service.count({ sessionId });
      } else {
        nations = await this.service.getAll(limit, skip);
        count = await this.service.count();
      }

      const response: Paginated<typeof nations[0]> = {
        data: nations,
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
      const nation = await this.service.getById(req.params.id);

      if (!nation) {
        throw new HttpException(404, 'Nation not found');
      }

      const response: ApiResponse<typeof nation> = { data: nation };
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
      const nation = await this.service.create(req.body);

      const response: ApiResponse<typeof nation> = { data: nation };
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
      const nation = await this.service.update(req.params.id, req.body);

      if (!nation) {
        throw new HttpException(404, 'Nation not found');
      }

      const response: ApiResponse<typeof nation> = { data: nation };
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
        throw new HttpException(404, 'Nation not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
