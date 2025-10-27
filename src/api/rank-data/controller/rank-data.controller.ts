import { Request, Response, NextFunction } from 'express';
import { RankDataService } from '../service/rank-data.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class RankDataController {
  constructor(private service: RankDataService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const rankData = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof rankData[0]> = {
        data: rankData,
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
      const rankData = await this.service.getById(req.params.id);

      if (!rankData) {
        throw new HttpException(404, 'RankData not found');
      }

      const response: ApiResponse<typeof rankData> = { data: rankData };
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
      const rankData = await this.service.create(req.body);
      const response: ApiResponse<typeof rankData> = { data: rankData };
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
      const rankData = await this.service.update(req.params.id, req.body);

      if (!rankData) {
        throw new HttpException(404, 'RankData not found');
      }

      const response: ApiResponse<typeof rankData> = { data: rankData };
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
      const result = await this.service.delete(req.params.id);

      if (!result) {
        throw new HttpException(404, 'RankData not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
