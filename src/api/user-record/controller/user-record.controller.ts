import { Request, Response, NextFunction } from 'express';
import { UserRecordService } from '../service/user-record.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class UserRecordController {
  constructor(private service: UserRecordService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const record = await this.service.getById(req.params.id);

      if (!record) {
        throw new HttpException(404, 'UserRecord not found');
      }

      const response: ApiResponse<typeof record> = { data: record };
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

      const records = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof records[0]> = {
        data: records,
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
      const record = await this.service.create(req.body);

      const response: ApiResponse<typeof record> = { data: record };
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
      const record = await this.service.update(req.params.id, req.body);

      if (!record) {
        throw new HttpException(404, 'UserRecord not found');
      }

      const response: ApiResponse<typeof record> = { data: record };
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
        throw new HttpException(404, 'UserRecord not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
