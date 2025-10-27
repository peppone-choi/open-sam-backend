import { Request, Response, NextFunction } from 'express';
import { SelectNpcTokenService } from '../service/select-npc-token.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class SelectNpcTokenController {
  constructor(private service: SelectNpcTokenService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = await this.service.getById(req.params.id);

      if (!token) {
        throw new HttpException(404, 'SelectNpcToken not found');
      }

      const response: ApiResponse<typeof token> = { data: token };
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

      const tokens = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof tokens[0]> = {
        data: tokens,
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
      const token = await this.service.create(req.body);

      const response: ApiResponse<typeof token> = { data: token };
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
      const token = await this.service.update(req.params.id, req.body);

      if (!token) {
        throw new HttpException(404, 'SelectNpcToken not found');
      }

      const response: ApiResponse<typeof token> = { data: token };
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
        throw new HttpException(404, 'SelectNpcToken not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
