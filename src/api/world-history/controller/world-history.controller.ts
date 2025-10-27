import { Request, Response, NextFunction } from 'express';
import { WorldHistoryService } from '../service/world-history.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class WorldHistoryController {
  constructor(private service: WorldHistoryService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const histories = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof histories[0]> = {
        data: histories,
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
      const history = await this.service.getById(req.params.id);

      if (!history) {
        throw new HttpException(404, 'World history not found');
      }

      const response: ApiResponse<typeof history> = { data: history };
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
      const history = await this.service.create(req.body);

      const response: ApiResponse<typeof history> = { data: history };
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
      const history = await this.service.update(req.params.id, req.body);

      if (!history) {
        throw new HttpException(404, 'World history not found');
      }

      const response: ApiResponse<typeof history> = { data: history };
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
      const success = await this.service.delete(req.params.id);

      if (!success) {
        throw new HttpException(404, 'World history not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
