import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { CityService } from '../../domain/city/city.service';

@injectable()
export class CityController {
  constructor(private cityService: CityService) {}

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: CityService.findAll() 호출
      
      res.json({ data: [] });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // TODO: CityService.findById(id) 호출
      
      res.json({ data: {} });
    } catch (error) {
      next(error);
    }
  }

  async produce(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { productType, amount } = req.body;
      
      // TODO: CityService.startProduction(id, productType, amount)
      // TODO: Redis Streams에 PRODUCE 커맨드 발행
      
      res.json({ message: 'Production command submitted' });
    } catch (error) {
      next(error);
    }
  }

  async recruit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      
      // TODO: CityService.recruit(id, amount)
      
      res.json({ message: 'Recruit command submitted' });
    } catch (error) {
      next(error);
    }
  }
}
