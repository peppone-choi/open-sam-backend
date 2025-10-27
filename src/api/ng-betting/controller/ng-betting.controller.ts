import { Request, Response, NextFunction } from 'express';
import { NgBettingService } from '../service/ng-betting.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class NgBettingController {
  constructor(private service: NgBettingService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const betting = await this.service.getById(req.params.id);

      if (!betting) {
        throw new HttpException(404, 'Betting not found');
      }

      const response: ApiResponse<typeof betting> = { data: betting };
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

      const bettings = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof bettings[0]> = {
        data: bettings,
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
      const betting = await this.service.create(req.body);
      const response: ApiResponse<typeof betting> = { data: betting };
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
      const betting = await this.service.update(req.params.id, req.body);

      if (!betting) {
        throw new HttpException(404, 'Betting not found');
      }

      const response: ApiResponse<typeof betting> = { data: betting };
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
        throw new HttpException(404, 'Betting not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
