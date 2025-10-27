import { Request, Response, NextFunction } from 'express';
import { GeneralAccessLogService } from '../service/general-access-log.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class GeneralAccessLogController {
  constructor(private service: GeneralAccessLogService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const log = await this.service.getById(req.params.id);

      if (!log) {
        throw new HttpException(404, 'GeneralAccessLog not found');
      }

      const response: ApiResponse<typeof log> = { data: log };
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const logs = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof logs[0]> = {
        data: logs,
        count,
        limit,
        skip,
      };
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
      const log = await this.service.create(req.body);
      const response: ApiResponse<typeof log> = { data: log };
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
      const log = await this.service.update(req.params.id, req.body);

      if (!log) {
        throw new HttpException(404, 'GeneralAccessLog not found');
      }

      const response: ApiResponse<typeof log> = { data: log };
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
        throw new HttpException(404, 'GeneralAccessLog not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
