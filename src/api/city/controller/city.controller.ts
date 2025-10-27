import { Request, Response, NextFunction } from 'express';
import { CityService } from '../service/city.service';
import { HttpException } from '../../../common/errors/HttpException';

export class CityController {
  constructor(private service: CityService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;
      const nationId = req.query.nationId as string;

      let cities;
      let count;

      if (nationId) {
        cities = await this.service.getByNation(nationId);
        count = cities.length;
      } else {
        cities = await this.service.getAll(limit, skip);
        count = cities.length;
      }

      res.json({ data: cities, count, limit, skip });
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
      const city = await this.service.create(req.body);
      res.status(201).json({ data: city });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const city = await this.service.update(req.params.id, req.body);

      if (!city) {
        throw new HttpException(404, 'City not found');
      }

      res.json({ data: city });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await this.service.delete(req.params.id);

      if (!deleted) {
        throw new HttpException(404, 'City not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
