import { Request, Response, NextFunction } from 'express';
import { NationEnvService } from '../service/nation-env.service';
import { HttpException } from '../../../common/errors/HttpException';

export class NationEnvController {
  constructor(private service: NationEnvService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const nationEnvs = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      res.json({
        data: nationEnvs,
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
      const nationEnv = await this.service.getById(req.params.id);

      if (!nationEnv) {
        throw new HttpException(404, 'NationEnv not found');
      }

      res.json({ data: nationEnv });
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
      const nationEnv = await this.service.create(req.body);
      res.status(201).json({ data: nationEnv });
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
      const nationEnv = await this.service.update(req.params.id, req.body);

      if (!nationEnv) {
        throw new HttpException(404, 'NationEnv not found');
      }

      res.json({ data: nationEnv });
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
        throw new HttpException(404, 'NationEnv not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
