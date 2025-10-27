import { Request, Response, NextFunction } from 'express';
import { ItemService } from '../service/item.service';
import { HttpException } from '../../../common/errors/HttpException';

export class ItemController {
  constructor(private service: ItemService) {}
  
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;
      const ownerId = req.query.ownerId as string;
      const type = req.query.type as string;

      if (!sessionId) {
        throw new HttpException(400, 'sessionId is required');
      }

      let items;
      if (ownerId) {
        items = await this.service.findByOwnerId(sessionId, ownerId);
      } else if (type) {
        items = await this.service.findByType(sessionId, type);
      } else {
        throw new HttpException(400, 'ownerId or type is required');
      }

      res.json({ data: items, count: items.length });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Item getById is not implemented yet');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Items are created by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Items are updated by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Items are deleted by Game Daemon');
    } catch (error) {
      next(error);
    }
  };
}
