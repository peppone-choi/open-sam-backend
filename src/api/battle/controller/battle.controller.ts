import { Request, Response, NextFunction } from 'express';
import { BattleService } from '../../services/battle/StartBattle.service';
import { HttpException } from '../../../common/errors/HttpException';

export class BattleController {
  constructor(private service: BattleService) {}
  
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;
      const commanderId = req.query.commanderId as string;

      if (!sessionId) {
        throw new HttpException(400, '세션 식별자가 필요합니다.');
      }


      let battles;
      if (commanderId) {
        battles = await this.service.findByCommanderId(sessionId, commanderId);
      } else {
        battles = await this.service.findActive(sessionId);
      }

      res.json(battles);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, '전투 상세 조회 API가 아직 구현되지 않았습니다.');
    } catch (error) {

      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, '전투 생성은 게임 데몬에서만 수행됩니다.');
    } catch (error) {

      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, '전투 업데이트는 게임 데몬에서만 수행됩니다.');
    } catch (error) {

      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      throw new HttpException(501, '전투 삭제는 게임 데몬에서만 수행됩니다.');
    } catch (error) {

      next(error);
    }
  };
}
