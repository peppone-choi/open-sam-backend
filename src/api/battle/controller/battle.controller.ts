import { Request, Response, NextFunction } from 'express';
import { BattleService } from '../../../services/battle/BattleService';
import { HttpException } from '../../../common/errors/HttpException';
import { conflictService } from '../../../services/war/Conflict.service';

/**
 * 전투 컨트롤러
 * 토탈워 스타일 전투 시스템 API 엔드포인트
 */
export class BattleController {
  private service: BattleService;

  constructor() {
    this.service = new BattleService();
  }

  // ============================================
  // 전투 조회
  // ============================================

  /**
   * 전투 목록 조회
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;
      const status = req.query.status as string || 'active';
      const nationId = req.query.nationId ? Number(req.query.nationId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 20, 100);

      if (!sessionId) {
        throw new HttpException(400, '세션 식별자가 필요합니다.');
      }

      const battles = await this.service.findBattles({
        sessionId,
        status,
        nationId,
        limit
      });

      res.json({
        success: true,
        data: battles,
        meta: {
          count: battles.length,
          sessionId,
          status
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 상세 조회
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;

      const battle = await this.service.getBattleById(battleId);
      if (!battle) {
        throw new HttpException(404, '전투를 찾을 수 없습니다.');
      }

      res.json({
        success: true,
        data: battle
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 실시간 상태 조회
   */
  getState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;

      const state = await this.service.getBattleState(battleId);
      if (!state) {
        throw new HttpException(404, '전투 상태를 찾을 수 없습니다.');
      }

      res.json({
        success: true,
        data: state
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 리플레이 데이터 조회
   */
  getReplay = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;

      const replay = await this.service.getReplayData(battleId);
      if (!replay) {
        throw new HttpException(404, '리플레이 데이터를 찾을 수 없습니다.');
      }

      res.json({
        success: true,
        data: replay
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 기록 조회
   */
  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const nationId = req.query.nationId ? Number(req.query.nationId) : undefined;
      const generalId = req.query.generalId ? Number(req.query.generalId) : undefined;
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Number(req.query.limit) || 20, 100);

      const { battles, total } = await this.service.getBattleHistory({
        sessionId,
        nationId,
        generalId,
        page,
        limit
      });

      res.json({
        success: true,
        data: battles,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // 전투 생성 및 제어
  // ============================================

  /**
   * 전투 시작
   */
  startBattle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        sessionId,
        attackerNationId,
        defenderNationId,
        attackerGeneralIds,
        targetCityId,
        battleType = 'field',
        multiStackMode = true,
        environment
      } = req.body;

      // 유효성 검사
      if (!sessionId) {
        throw new HttpException(400, '세션 ID가 필요합니다.');
      }
      if (!attackerNationId || !defenderNationId) {
        throw new HttpException(400, '공격/방어 국가 ID가 필요합니다.');
      }
      if (!attackerGeneralIds || !Array.isArray(attackerGeneralIds) || attackerGeneralIds.length === 0) {
        throw new HttpException(400, '공격 장수 목록이 필요합니다.');
      }
      if (!targetCityId) {
        throw new HttpException(400, '대상 도시 ID가 필요합니다.');
      }

      const result = await this.service.startBattle({
        session_id: sessionId,
        attackerNationId,
        defenderNationId,
        attackerGeneralIds,
        targetCityId,
        battleType,
        multiStackMode,
        environment
      });

      if (!result.success) {
        throw new HttpException(400, result.message || '전투 시작 실패');
      }

      res.status(201).json({
        success: true,
        data: {
          battleId: result.battleId,
          battle: result.battle,
          websocketUrl: `/socket.io?battleId=${result.battleId}`,
          estimatedDuration: this.estimateDuration(result.battle)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 유닛 배치
   */
  deployUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { generalId, unitId, position, formation } = req.body;

      if (!generalId) {
        throw new HttpException(400, '장수 ID가 필요합니다.');
      }
      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        throw new HttpException(400, '유효한 배치 위치가 필요합니다.');
      }

      const result = await this.service.deployUnit({
        battleId,
        generalId,
        unitId,
        position,
        formation
      });

      if (!result.success) {
        throw new HttpException(400, result.message || '유닛 배치 실패');
      }

      res.json({
        success: true,
        data: result.unit
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 준비 완료
   */
  markReady = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { generalId } = req.body;

      if (!generalId) {
        throw new HttpException(400, '장수 ID가 필요합니다.');
      }

      const result = await this.service.markPlayerReady(battleId, generalId);

      if (!result.success) {
        throw new HttpException(400, result.message || '준비 완료 처리 실패');
      }

      res.json({
        success: true,
        data: {
          readyPlayers: result.readyPlayers,
          allReady: result.allReady,
          battleStarted: result.battleStarted
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 명령 전송
   */
  sendCommand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { generalId, unitId, command, params } = req.body;

      if (!generalId) {
        throw new HttpException(400, '장수 ID가 필요합니다.');
      }
      if (!command) {
        throw new HttpException(400, '명령 타입이 필요합니다.');
      }

      const validCommands = ['move', 'attack', 'hold', 'retreat', 'formation', 'ability', 'stance', 'volley'];
      if (!validCommands.includes(command)) {
        throw new HttpException(400, `유효하지 않은 명령입니다. 허용: ${validCommands.join(', ')}`);
      }

      const result = await this.service.processCommand({
        battleId,
        generalId,
        unitId,
        command,
        params
      });

      if (!result.success) {
        throw new HttpException(400, result.message || '명령 처리 실패');
      }

      res.json({
        success: true,
        data: {
          commandId: result.commandId,
          acknowledged: true,
          timestamp: new Date()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // 전투 결과
  // ============================================

  /**
   * 전투 결과 저장
   */
  submitResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const {
        winner,
        duration,
        attackerResult,
        defenderResult,
        rewards,
        replayData
      } = req.body;

      // 유효성 검사
      if (!winner || !['attacker', 'defender', 'draw'].includes(winner)) {
        throw new HttpException(400, '유효한 승자 정보가 필요합니다.');
      }
      if (!attackerResult || !defenderResult) {
        throw new HttpException(400, '양측 결과 정보가 필요합니다.');
      }

      const result = await this.service.submitBattleResult({
        battleId,
        winner,
        duration,
        attackerResult,
        defenderResult,
        rewards,
        replayData
      });

      if (!result.success) {
        throw new HttpException(400, result.message || '결과 저장 실패');
      }

      res.json({
        success: true,
        data: {
          battleId,
          winner,
          processed: true,
          worldUpdated: result.worldUpdated
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 항복 처리
   */
  surrender = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { generalId } = req.body;

      if (!generalId) {
        throw new HttpException(400, '장수 ID가 필요합니다.');
      }

      const result = await this.service.processSurrender(battleId, generalId);

      if (!result.success) {
        throw new HttpException(400, result.message || '항복 처리 실패');
      }

      res.json({
        success: true,
        data: {
          battleId,
          surrenderedBy: generalId,
          winner: result.winner
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 취소
   */
  cancelBattle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { reason } = req.body;

      const result = await this.service.cancelBattle(battleId, reason);

      if (!result.success) {
        throw new HttpException(400, result.message || '전투 취소 실패');
      }

      res.json({
        success: true,
        data: {
          battleId,
          cancelled: true,
          reason
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 전투 삭제 (관리자)
   */
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;

      const result = await this.service.deleteBattle(battleId);

      if (!result.success) {
        throw new HttpException(400, result.message || '전투 삭제 실패');
      }

      res.json({
        success: true,
        data: {
          battleId,
          deleted: true
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // 분쟁/공략 진행 상황 (전투 Bar)
  // ============================================

  /**
   * 도시 공략 진행 상황 조회 (전투 Bar)
   */
  getCityProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, cityId } = req.params;
      const cityIdNum = Number(cityId);

      if (!sessionId) {
        throw new HttpException(400, '세션 ID가 필요합니다.');
      }
      if (isNaN(cityIdNum)) {
        throw new HttpException(400, '유효한 도시 ID가 필요합니다.');
      }

      const progress = await conflictService.getBattleProgress(sessionId, cityIdNum);
      
      if (!progress) {
        throw new HttpException(404, '도시를 찾을 수 없습니다.');
      }

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 모든 분쟁 중인 도시 조회
   */
  getAllConflicts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        throw new HttpException(400, '세션 ID가 필요합니다.');
      }

      const conflicts = await conflictService.getAllConflictCities(sessionId);

      res.json({
        success: true,
        data: conflicts,
        meta: {
          count: conflicts.length,
          sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 도시 분쟁 참가자 조회
   */
  getConflictParticipants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, cityId } = req.params;
      const cityIdNum = Number(cityId);

      if (!sessionId) {
        throw new HttpException(400, '세션 ID가 필요합니다.');
      }
      if (isNaN(cityIdNum)) {
        throw new HttpException(400, '유효한 도시 ID가 필요합니다.');
      }

      const participants = await conflictService.getConflictParticipants(sessionId, cityIdNum);

      res.json({
        success: true,
        data: participants,
        meta: {
          cityId: cityIdNum,
          participantCount: participants.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // 헬퍼 메서드
  // ============================================

  /**
   * 전투 예상 시간 계산
   */
  private estimateDuration(battle: any): number {
    if (!battle) return 300000; // 기본 5분

    const totalUnits = (battle.attackerUnits?.length || 0) + (battle.defenderUnits?.length || 0);
    const totalTroops = 
      (battle.attackerUnits?.reduce((sum: number, u: any) => sum + (u.troops || 0), 0) || 0) +
      (battle.defenderUnits?.reduce((sum: number, u: any) => sum + (u.troops || 0), 0) || 0);

    // 유닛당 30초 + 병력 1000명당 10초
    const baseTime = totalUnits * 30000;
    const troopTime = Math.floor(totalTroops / 1000) * 10000;

    return Math.min(baseTime + troopTime, 1800000); // 최대 30분
  }
}
