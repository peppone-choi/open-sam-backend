import { Request, Response, NextFunction } from 'express';
import { NationTurnService } from '../service/nation-turn.service';
import { HttpException } from '../../../common/errors/HttpException';

export class NationTurnController {
  constructor(private service: NationTurnService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const nationTurns = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      res.json({
        data: nationTurns,
        count,
        limit,
        skip,
      });
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
      const nationTurn = await this.service.getById(req.params.id);

      if (!nationTurn) {
        throw new HttpException(404, 'NationTurn not found');
      }

      res.json({ data: nationTurn });
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
      const nationTurn = await this.service.create(req.body);
      res.status(201).json({ data: nationTurn });
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
      const nationTurn = await this.service.update(req.params.id, req.body);

      if (!nationTurn) {
        throw new HttpException(404, 'NationTurn not found');
      }

      res.json({ data: nationTurn });
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
        throw new HttpException(404, 'NationTurn not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
