import { Request, Response, NextFunction } from 'express';
import { ItemService } from '../service/item.service';
import { HttpException } from '../../../common/errors/HttpException';

export class ItemController {
  constructor(private service: ItemService) {}
  
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement list
      res.json({ data: [], total: 0 });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implement getById
      res.json({ data: null });
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
