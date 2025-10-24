import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { GeneralService } from '../../domain/general/general.service';
import { logger } from '../../shared/utils/logger';

@injectable()
export class GeneralController {
  constructor(private generalService: GeneralService) {}

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: 쿼리 파라미터 파싱 (nationId, page, limit 등)
      // TODO: GeneralService.findAll() 호출
      // TODO: 캐시 적용 고려
      
      const generals = []; // placeholder
      res.json({ data: generals });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // TODO: GeneralService.findById(id) 호출
      // TODO: 캐시에서 먼저 확인
      // TODO: 404 처리
      
      res.json({ data: {} });
    } catch (error) {
      next(error);
    }
  }

  async train(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { statType, amount } = req.body;
      
      // TODO: DTO 검증
      // TODO: GeneralService.train(id, statType, amount)
      // TODO: 실제로는 Redis Streams에 커맨드 발행
      // TODO: Game Daemon이 처리 후 완료
      
      logger.info(`General ${id} training ${statType} +${amount}`);
      res.json({ message: 'Training command submitted' });
    } catch (error) {
      next(error);
    }
  }

  async equip(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { itemId } = req.body;
      
      // TODO: GeneralService.equipItem(id, itemId)
      
      res.json({ message: 'Item equipped' });
    } catch (error) {
      next(error);
    }
  }
}
