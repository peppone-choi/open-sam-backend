import { Request, Response, NextFunction } from 'express';
import { BattleService } from '../service/battle.service';
import { HttpException } from '../../../common/errors/HttpException';

export class BattleController {
  constructor(private service: BattleService) {}
  
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;
      const generalId = req.query.generalId as string;

      if (!sessionId) {
        throw new HttpException(400, 'sessionId is required');
      }

      let battles;
      if (generalId) {
        battles = await this.service.findByGeneralId(sessionId, generalId);
      } else {
        battles = await this.service.findActive(sessionId);
      }

      res.json({ data: battles, count: battles.length });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Battle getById is not implemented yet');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Battles are created by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Battles are updated by Game Daemon');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, 'Battles are deleted by Game Daemon');
    } catch (error) {
      next(error);
    }
  };
}
