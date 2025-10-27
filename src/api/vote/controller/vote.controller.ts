import { Request, Response, NextFunction } from 'express';
import { VoteService } from '../service/vote.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class VoteController {
  constructor(private service: VoteService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const vote = await this.service.getById(req.params.id);

      if (!vote) {
        throw new HttpException(404, 'Vote not found');
      }

      const response: ApiResponse<typeof vote> = { data: vote };
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

      const votes = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof votes[0]> = {
        data: votes,
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
      const vote = await this.service.create(req.body);
      const response: ApiResponse<typeof vote> = { data: vote };
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
      const vote = await this.service.update(req.params.id, req.body);

      if (!vote) {
        throw new HttpException(404, 'Vote not found');
      }

      const response: ApiResponse<typeof vote> = { data: vote };
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
        throw new HttpException(404, 'Vote not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
