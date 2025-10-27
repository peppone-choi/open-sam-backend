import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../service/storage.service';
import { HttpException } from '../../../common/errors/HttpException';
import { ApiResponse, Paginated } from '../../../@types';

export class StorageController {
  constructor(private service: StorageService) {}

  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const storages = await this.service.getAll(limit, skip);
      const count = await this.service.count();

      const response: Paginated<typeof storages[0]> = {
        data: storages,
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
      const storage = await this.service.getById(req.params.id);

      if (!storage) {
        throw new HttpException(404, 'Storage not found');
      }

      const response: ApiResponse<typeof storage> = { data: storage };
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
      const storage = await this.service.create(req.body);
      const response: ApiResponse<typeof storage> = { data: storage };
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
      const storage = await this.service.update(req.params.id, req.body);

      if (!storage) {
        throw new HttpException(404, 'Storage not found');
      }

      const response: ApiResponse<typeof storage> = { data: storage };
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
        throw new HttpException(404, 'Storage not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
