import { Request, Response, NextFunction } from 'express';
import { ReservedOpenService } from '../service/reserved-open.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class ReservedOpenController {
  constructor(private service: ReservedOpenService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const reservedOpens = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof reservedOpens[0]> = {
        data: reservedOpens,
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
      const reservedOpen = await this.service.getById(req.params.id);

      if (!reservedOpen) {
        throw new HttpException(404, 'ReservedOpen not found');
      }

      const response: ApiResponse<typeof reservedOpen> = { data: reservedOpen };
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
      const reservedOpen = await this.service.create(req.body);
      const response: ApiResponse<typeof reservedOpen> = { data: reservedOpen };
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
      const reservedOpen = await this.service.update(req.params.id, req.body);

      if (!reservedOpen) {
        throw new HttpException(404, 'ReservedOpen not found');
      }

      const response: ApiResponse<typeof reservedOpen> = { data: reservedOpen };
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
        throw new HttpException(404, 'ReservedOpen not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
