import { Request, Response, NextFunction } from 'express';
import { CityService } from '../service/city.service';
import { HttpException } from '../../../common/errors/HttpException';

export class CityController {
  constructor(private service: CityService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;
      
      // TODO: Implement list
      res.json({ data: [], total: 0 });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const city = await this.service.getById(req.params.id);
      
      if (!city) {
        throw new HttpException(404, 'City not found');
      }
      
      res.json({ data: city });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement create
      res.status(201).json({ message: 'Create not implemented' });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement update
      res.json({ message: 'Update not implemented' });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement delete
      res.json({ message: 'Delete not implemented' });
    } catch (error) {
      next(error);
    }
  };
}
