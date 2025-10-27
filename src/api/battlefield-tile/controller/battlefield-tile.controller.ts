import { Request, Response, NextFunction } from 'express';
import { BattleFieldTileService } from '../service/battlefield-tile.service';
import { HttpException } from '../../../common/errors/HttpException';

export class BattleFieldTileController {
  constructor(private service: BattleFieldTileService) {}

  /**
   * GET /api/:sessionId/cities/:cityId/tiles
   * 도시의 전투 맵 타일 조회
   */
  getTilesByCityId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, cityId } = req.params;
      
      // 타일 조회 (없으면 생성)
      const tiles = await this.service.getOrCreateTiles(sessionId, cityId);
      
      if (!tiles) {
        throw new HttpException(404, 'Tiles not found');
      }
      
      res.json({ data: tiles });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/:sessionId/cities/:cityId/tiles/regenerate
   * 타일 재생성 (관리자용)
   */
  regenerateTiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: 관리자 권한 확인
      // TODO: 기존 타일 삭제 후 재생성
      
      res.json({ message: 'TODO: Regenerate tiles' });
    } catch (error) {
      next(error);
    }
  };
}
