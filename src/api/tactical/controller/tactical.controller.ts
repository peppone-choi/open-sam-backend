/**
 * 전술전투 API 컨트롤러
 */

import { Request, Response, NextFunction } from 'express';
import { TacticalBattleSessionService } from '../../../services/tactical/TacticalBattleSession.service';
import { TacticalBattleEngineService } from '../../../services/tactical/TacticalBattleEngine.service';
import { TacticalBattleAIService } from '../../../services/tactical/TacticalBattleAI.service';

export class TacticalBattleController {
  
  // ============================================================
  // 전투 세션 관리
  // ============================================================
  
  /**
   * 진행 중인 전투 목록
   */
  getBattles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string || req.body.sessionId;
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'sessionId가 필요합니다' });
        return;
      }
      
      const battles = await TacticalBattleSessionService.getActiveBattles(sessionId);
      
      res.json({
        success: true,
        data: battles.map(b => ({
          battleId: b.battle_id,
          cityId: b.cityId,
          cityName: b.cityName,
          status: b.status,
          attacker: {
            nationId: b.attacker.nationId,
            nationName: b.attacker.nationName,
            isUserControlled: b.attacker.isUserControlled,
            generalCount: b.attacker.generals.length,
          },
          defender: {
            nationId: b.defender.nationId,
            nationName: b.defender.nationName,
            isUserControlled: b.defender.isUserControlled,
            generalCount: b.defender.generals.length,
          },
          currentTurn: b.currentTurn,
          currentSide: b.currentSide,
          createdAt: b.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 내 국가의 참여 가능한 전투 목록
   */
  getAvailableBattles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.query.sessionId as string;
      const nationId = parseInt(req.query.nationId as string, 10);
      
      if (!sessionId || isNaN(nationId)) {
        res.status(400).json({ success: false, message: 'sessionId와 nationId가 필요합니다' });
        return;
      }
      
      const battles = await TacticalBattleSessionService.getBattlesForUser(sessionId, nationId);
      
      res.json({
        success: true,
        data: battles,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 전투 세션 상세 조회
   */
  getBattle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      
      const battle = await TacticalBattleSessionService.getSession(battleId);
      if (!battle) {
        res.status(404).json({ success: false, message: '전투를 찾을 수 없습니다' });
        return;
      }
      
      res.json({
        success: true,
        data: {
          battleId: battle.battle_id,
          sessionId: battle.session_id,
          cityId: battle.cityId,
          cityName: battle.cityName,
          status: battle.status,
          mapWidth: battle.mapWidth,
          mapHeight: battle.mapHeight,
          terrain: battle.terrain,
          attacker: battle.attacker,
          defender: battle.defender,
          units: battle.units,
          currentTurn: battle.currentTurn,
          currentSide: battle.currentSide,
          turnTimeLimit: battle.turnTimeLimit,
          maxTurns: battle.maxTurns,
          winner: battle.winner,
          result: battle.result,
          createdAt: battle.createdAt,
          battleStartAt: battle.battleStartAt,
          finishedAt: battle.finishedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 전투 참여
   */
  joinBattle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { side, userId, aiStrategy } = req.body;
      
      if (!side || !userId) {
        res.status(400).json({ success: false, message: 'side와 userId가 필요합니다' });
        return;
      }
      
      const battle = await TacticalBattleSessionService.joinBattle({
        battleId,
        side,
        userId,
        aiStrategy,
      });
      
      res.json({
        success: true,
        message: '전투에 참여했습니다',
        data: { status: battle.status },
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * AI 위임
   */
  delegateToAI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { side, strategy } = req.body;
      
      if (!side) {
        res.status(400).json({ success: false, message: 'side가 필요합니다' });
        return;
      }
      
      const battle = await TacticalBattleSessionService.delegateToAI(battleId, side, strategy);
      
      res.json({
        success: true,
        message: 'AI에게 위임했습니다',
        data: { aiStrategy: strategy || 'balanced' },
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 전투 시작
   */
  startBattle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      
      const battle = await TacticalBattleSessionService.startBattle(battleId);
      
      res.json({
        success: true,
        message: '전투가 시작되었습니다',
        data: {
          status: battle.status,
          currentTurn: battle.currentTurn,
          currentSide: battle.currentSide,
        },
      });
    } catch (error) {
      next(error);
    }
  };
  
  // ============================================================
  // 전투 행동
  // ============================================================
  
  /**
   * 유닛 이동
   */
  moveUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { unitId, x, y } = req.body;
      
      if (!unitId || x === undefined || y === undefined) {
        res.status(400).json({ success: false, message: 'unitId, x, y가 필요합니다' });
        return;
      }
      
      const result = await TacticalBattleEngineService.moveUnit(battleId, {
        unitId,
        targetPosition: { x, y },
      });
      
      res.json({
        success: result.success,
        message: result.message,
        logs: result.logs,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 유닛 공격
   */
  attackUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { unitId, targetUnitId } = req.body;
      
      if (!unitId || !targetUnitId) {
        res.status(400).json({ success: false, message: 'unitId와 targetUnitId가 필요합니다' });
        return;
      }
      
      const result = await TacticalBattleEngineService.attack(battleId, {
        unitId,
        targetUnitId,
      });
      
      res.json({
        success: result.success,
        message: result.message,
        damage: result.damage,
        logs: result.logs,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 유닛 대기
   */
  waitUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { unitId } = req.body;
      
      if (!unitId) {
        res.status(400).json({ success: false, message: 'unitId가 필요합니다' });
        return;
      }
      
      const result = await TacticalBattleEngineService.waitUnit(battleId, unitId);
      
      res.json({
        success: result.success,
        message: result.message,
        logs: result.logs,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 유닛 퇴각
   */
  retreatUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { unitId } = req.body;
      
      if (!unitId) {
        res.status(400).json({ success: false, message: 'unitId가 필요합니다' });
        return;
      }
      
      const result = await TacticalBattleEngineService.retreatUnit(battleId, unitId);
      
      res.json({
        success: result.success,
        message: result.message,
        logs: result.logs,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 턴 종료
   */
  endTurn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const { side } = req.body;
      
      if (!side) {
        res.status(400).json({ success: false, message: 'side가 필요합니다' });
        return;
      }
      
      const battle = await TacticalBattleEngineService.endTurn(battleId, side);
      
      res.json({
        success: true,
        message: '턴이 종료되었습니다',
        data: {
          currentTurn: battle.currentTurn,
          currentSide: battle.currentSide,
          status: battle.status,
          winner: battle.winner,
        },
      });
    } catch (error) {
      next(error);
    }
  };
  
  // ============================================================
  // AI / 시뮬레이션
  // ============================================================
  
  /**
   * AI 턴 실행
   */
  executeAITurn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      
      const result = await TacticalBattleAIService.executeAITurn(battleId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 전투 시뮬레이션
   */
  simulateBattle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const maxIterations = parseInt(req.query.maxIterations as string, 10) || 200;
      
      const result = await TacticalBattleAIService.simulateBattle(battleId, maxIterations);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  
  // ============================================================
  // 유틸리티
  // ============================================================
  
  /**
   * 이동 가능 위치 조회
   */
  getMovablePositions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId, unitId } = req.params;
      
      const battle = await TacticalBattleSessionService.getSession(battleId);
      if (!battle) {
        res.status(404).json({ success: false, message: '전투를 찾을 수 없습니다' });
        return;
      }
      
      const unit = battle.units.find(u => u.id === unitId);
      if (!unit) {
        res.status(404).json({ success: false, message: '유닛을 찾을 수 없습니다' });
        return;
      }
      
      const positions = TacticalBattleEngineService.getMovablePositions(battle, unit);
      
      res.json({
        success: true,
        data: positions,
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 공격 가능 대상 조회
   */
  getAttackableTargets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId, unitId } = req.params;
      
      const battle = await TacticalBattleSessionService.getSession(battleId);
      if (!battle) {
        res.status(404).json({ success: false, message: '전투를 찾을 수 없습니다' });
        return;
      }
      
      const unit = battle.units.find(u => u.id === unitId);
      if (!unit) {
        res.status(404).json({ success: false, message: '유닛을 찾을 수 없습니다' });
        return;
      }
      
      const targets = TacticalBattleEngineService.getAttackableTargets(battle, unit);
      
      res.json({
        success: true,
        data: targets.map(t => ({
          id: t.id,
          name: t.name,
          hp: t.hp,
          maxHp: t.maxHp,
          position: t.position,
          unitType: t.unitType,
        })),
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * 전투 로그 조회
   */
  getBattleLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { battleId } = req.params;
      const turn = req.query.turn ? parseInt(req.query.turn as string, 10) : undefined;
      
      const battle = await TacticalBattleSessionService.getSession(battleId);
      if (!battle) {
        res.status(404).json({ success: false, message: '전투를 찾을 수 없습니다' });
        return;
      }
      
      let logs = battle.actionLogs;
      if (turn !== undefined) {
        logs = logs.filter(l => l.turn === turn);
      }
      
      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  };
}













