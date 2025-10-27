import { Request, Response, NextFunction } from 'express';
import { TroopService } from '../service/troop.service';
import { HttpException } from '../../../common/errors/HttpException';

export class TroopController {
  constructor(private service: TroopService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const troop = await this.service.getById(req.params.id);

      if (!troop) {
        throw new HttpException(404, 'Troop not found');
      }

      res.json({ data: troop });
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

      const troops = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      res.json({
        data: troops,
        count,
        limit,
        skip,
      });
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
      const troop = await this.service.create(req.body);
      res.status(201).json({ data: troop });
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
      const troop = await this.service.update(req.params.id, req.body);

      if (!troop) {
        throw new HttpException(404, 'Troop not found');
      }

      res.json({ data: troop });
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
        throw new HttpException(404, 'Troop not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
