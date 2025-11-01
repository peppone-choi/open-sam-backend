import { Request, Response, NextFunction } from 'express';
import { GameSessionService } from '../service/game-session.service';
import { GameSessionRepository } from '../repository/game-session.repository';
import { CreateGameSessionDto, UpdateGameSessionDto } from '../@types/game-session.types';
import { HttpException } from '../../../common/errors/HttpException';

/**
 * GameSession Controller
 * 
 * Entity 시스템 기반 게임 세션 관리 API
 * - Entity Repository를 통한 통계 조회
 * - 시나리오 기반 Entity 초기화
 * - CQRS 패턴 지원 (turnBased/realtime)
 */
export class GameSessionController {
  private service: GameSessionService;

  constructor() {
    const repository = new GameSessionRepository();
    this.service = new GameSessionService(repository);
  }

  /**
   * 전체 세션 조회
   * GET /api/game-session
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const sessions = await this.service.getAll(limit, skip);
      const total = await this.service.count();

      res.json({
        data: sessions,
        meta: {
          total,
          limit,
          skip,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ID로 세션 조회
   * GET /api/game-session/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const session = await this.service.getById(id);

      if (!session) {
        throw new HttpException(404, '게임 세션을 찾을 수 없습니다.');
      }

      res.json({ data: session });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 세션 생성 (Entity 기반 초기화 포함)
   * POST /api/game-session
   * 
   * Body:
   * {
   *   "scenarioId": "scenario_0",
   *   "title": "【공백지】 일반",
   *   "startYear": 220,
   *   "mapName": "che",
   *   "gameMode": "turnBased",
   *   "turnInterval": 300
   * }
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: CreateGameSessionDto = req.body;

      if (!dto.scenarioId) {
        throw new HttpException(400, 'scenarioId는 필수입니다.');
      }

      // 기본값 설정
      const data = {
        scenarioId: dto.scenarioId,
        title: dto.title || '새 게임',
        startYear: dto.startYear || 220,
        currentYear: dto.startYear || 220,
        currentMonth: 1,
        mapName: dto.mapName || 'che',
        status: 'waiting' as const,
        gameMode: 'turnBased' as const,
        turnInterval: 300,
        config: dto.config || {},
        events: [],
        stats: {
          totalGenerals: 0,
          totalCities: 0,
          totalNations: 0,
          activePlayers: 0,
        },
        turnConfig: {
          turnDuration: 300,
        },
      };

      const session = await this.service.create(data);

      res.status(201).json({ data: session });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 세션 업데이트
   * PATCH /api/game-session/:id
   * 
   * Body:
   * {
   *   "status": "running",
   *   "currentYear": 221,
   *   "currentMonth": 3
   * }
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const dto: UpdateGameSessionDto = req.body;

      const session = await this.service.update(id, dto);

      if (!session) {
        throw new HttpException(404, '게임 세션을 찾을 수 없습니다.');
      }

      res.json({ data: session });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 세션 삭제
   * DELETE /api/game-session/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.service.delete(id);

      if (!success) {
        throw new HttpException(404, '게임 세션을 찾을 수 없습니다.');
      }

      res.json({ message: '게임 세션이 삭제되었습니다.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 상태별 세션 조회
   * GET /api/game-session/status/:status
   */
  async getByStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = parseInt(req.query.skip as string) || 0;

      const sessions = await this.service.getByStatus(status as any, limit, skip);
      const total = await this.service.count({ status });

      res.json({
        data: sessions,
        meta: {
          total,
          limit,
          skip,
          status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 시나리오 ID별 세션 조회
   * GET /api/game-session/scenario/:scenarioId
   */
  async getByScenarioId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scenarioId } = req.params;
      const sessions = await this.service.getByScenarioId(scenarioId);

      res.json({
        data: sessions,
        meta: {
          total: sessions.length,
          scenarioId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 세션 통계 업데이트 (Entity 기반 재계산)
   * POST /api/game-session/:id/update-stats
   */
  async updateStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      await this.service.updateStats(id);
      const session = await this.service.getById(id);

      res.json({
        data: session,
        message: '통계가 업데이트되었습니다.',
      });
    } catch (error) {
      next(error);
    }
  }
}
