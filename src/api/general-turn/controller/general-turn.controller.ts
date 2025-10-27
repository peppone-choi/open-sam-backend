import { Request, Response, NextFunction } from 'express';
import { GeneralTurnService } from '../service/general-turn.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class GeneralTurnController {
  constructor(private service: GeneralTurnService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const turn = await this.service.getById(req.params.id);

      if (!turn) {
        throw new HttpException(404, 'GeneralTurn not found');
      }

      const response: ApiResponse<typeof turn> = { data: turn };
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

      const turns = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof turns[0]> = {
        data: turns,
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
      const turn = await this.service.create(req.body);
      const response: ApiResponse<typeof turn> = { data: turn };
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
      const turn = await this.service.update(req.params.id, req.body);

      if (!turn) {
        throw new HttpException(404, 'GeneralTurn not found');
      }

      const response: ApiResponse<typeof turn> = { data: turn };
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
        throw new HttpException(404, 'GeneralTurn not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
