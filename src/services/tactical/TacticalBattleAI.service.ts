/**
 * 전술전투 AI 서비스
 * NPC/위임 시 자동 행동 결정
 */

import { 
  TacticalBattle, 
  ITacticalBattle,
  ITacticalUnit,
  BattleStatus,
  UnitStatus,
  UnitType,
  Position,
  TerrainType,
} from '../../models/tactical_battle.model';
import { TacticalBattleEngineService } from './TacticalBattleEngine.service';

// ============================================================
// AI 전략 타입
// ============================================================

export type AIStrategy = 'aggressive' | 'defensive' | 'balanced';

interface AIAction {
  type: 'move' | 'attack' | 'wait' | 'retreat';
  unitId: string;
  targetPosition?: Position;
  targetUnitId?: string;
  priority: number;
}

// ============================================================
// AI 서비스
// ============================================================

export class TacticalBattleAIService {
  
  /**
   * 현재 진영의 모든 유닛 자동 행동
   */
  static async executeAITurn(battleId: string): Promise<{ actions: string[]; turnEnded: boolean }> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) throw new Error('전투를 찾을 수 없습니다');
    if (battle.status !== BattleStatus.ONGOING) {
      return { actions: [], turnEnded: false };
    }
    
    const currentSide = battle.currentSide;
    const participant = currentSide === 'attacker' ? battle.attacker : battle.defender;
    const strategy = participant.aiStrategy || 'balanced';
    
    const actions: string[] = [];
    
    // 현재 진영의 활성 유닛 가져오기
    const activeUnits = battle.units.filter(
      u => u.side === currentSide && 
           u.status === UnitStatus.ACTIVE &&
           (!u.hasMoved || !u.hasActed) &&
           u.unitType !== UnitType.WALL &&
           u.unitType !== UnitType.GATE
    );
    
    // 각 유닛에 대해 행동 결정 및 실행
    for (const unit of activeUnits) {
      // 전투 상태 다시 조회 (이전 행동으로 상태가 변경됐을 수 있음)
      const updatedBattle = await TacticalBattle.findOne({ battle_id: battleId });
      if (!updatedBattle || updatedBattle.status !== BattleStatus.ONGOING) {
        break;
      }
      
      const updatedUnit = updatedBattle.units.find(u => u.id === unit.id);
      if (!updatedUnit || updatedUnit.status !== UnitStatus.ACTIVE) {
        continue;
      }
      
      const action = this.decideAction(updatedBattle, updatedUnit, strategy);
      if (action) {
        const result = await this.executeAction(battleId, action);
        if (result) {
          actions.push(result);
        }
      }
    }
    
    // 턴 종료
    if (battle.status === BattleStatus.ONGOING) {
      await TacticalBattleEngineService.endTurn(battleId, currentSide);
    }
    
    return { actions, turnEnded: true };
  }
  
  /**
   * AI 행동 결정
   */
  private static decideAction(
    battle: ITacticalBattle,
    unit: ITacticalUnit,
    strategy: AIStrategy
  ): AIAction | null {
    const possibleActions: AIAction[] = [];
    
    // 1. 공격 가능 대상 확인
    if (!unit.hasActed) {
      const targets = TacticalBattleEngineService.getAttackableTargets(battle, unit);
      for (const target of targets) {
        const priority = this.calculateAttackPriority(unit, target, strategy);
        possibleActions.push({
          type: 'attack',
          unitId: unit.id,
          targetUnitId: target.id,
          priority,
        });
      }
    }
    
    // 2. 이동 가능 위치 확인
    if (!unit.hasMoved) {
      const positions = TacticalBattleEngineService.getMovablePositions(battle, unit);
      
      // 각 위치에서 공격 가능 여부 확인
      for (const pos of positions) {
        const priority = this.calculateMovePriority(battle, unit, pos, strategy);
        if (priority > 0) {
          possibleActions.push({
            type: 'move',
            unitId: unit.id,
            targetPosition: pos,
            priority,
          });
        }
      }
    }
    
    // 3. 퇴각 여부 (HP가 낮을 때)
    if (unit.hp < unit.maxHp * 0.2 && strategy === 'defensive') {
      possibleActions.push({
        type: 'retreat',
        unitId: unit.id,
        priority: 30,
      });
    }
    
    // 4. 행동 없으면 대기
    if (possibleActions.length === 0) {
      return {
        type: 'wait',
        unitId: unit.id,
        priority: 0,
      };
    }
    
    // 우선순위 높은 행동 선택
    possibleActions.sort((a, b) => b.priority - a.priority);
    return possibleActions[0];
  }
  
  /**
   * 공격 우선순위 계산
   */
  private static calculateAttackPriority(
    unit: ITacticalUnit,
    target: ITacticalUnit,
    strategy: AIStrategy
  ): number {
    let priority = 50;
    
    // 낮은 HP 대상 우선
    const targetHpRatio = target.hp / target.maxHp;
    priority += (1 - targetHpRatio) * 20;
    
    // 성문 우선 (공격측)
    if (unit.side === 'attacker' && target.unitType === UnitType.GATE) {
      priority += 30;
    }
    
    // 전략에 따른 조정
    if (strategy === 'aggressive') {
      priority += 20;
    } else if (strategy === 'defensive') {
      priority -= 10;
    }
    
    // 장수 유닛 우선
    if (target.generalId > 0) {
      priority += 10;
    }
    
    return priority;
  }
  
  /**
   * 이동 우선순위 계산
   */
  private static calculateMovePriority(
    battle: ITacticalBattle,
    unit: ITacticalUnit,
    targetPos: Position,
    strategy: AIStrategy
  ): number {
    let priority = 20;
    
    const enemies = battle.units.filter(
      u => u.side !== unit.side && u.status === UnitStatus.ACTIVE
    );
    
    // 가장 가까운 적과의 거리
    let minEnemyDist = Infinity;
    for (const enemy of enemies) {
      const dist = this.getDistance(targetPos, enemy.position);
      minEnemyDist = Math.min(minEnemyDist, dist);
    }
    
    // 공격측: 본진으로 전진
    if (unit.side === 'attacker') {
      const hqPos = this.getHeadquartersPosition(battle.terrain);
      if (hqPos) {
        const distToHQ = this.getDistance(targetPos, hqPos);
        const currentDistToHQ = this.getDistance(unit.position, hqPos);
        
        // 본진에 가까워지면 우선순위 상승
        if (distToHQ < currentDistToHQ) {
          priority += (currentDistToHQ - distToHQ) * 5;
        }
      }
      
      // 성문 근처 우선
      const gates = battle.units.filter(
        u => u.unitType === UnitType.GATE && u.status === UnitStatus.ACTIVE
      );
      for (const gate of gates) {
        const dist = this.getDistance(targetPos, gate.position);
        if (dist <= 2) {
          priority += 15;
        }
      }
    }
    
    // 방어측: 본진 방어
    if (unit.side === 'defender') {
      const hqPos = this.getHeadquartersPosition(battle.terrain);
      if (hqPos) {
        const distToHQ = this.getDistance(targetPos, hqPos);
        // 본진 근처 유지
        if (distToHQ <= 3) {
          priority += 10;
        }
      }
    }
    
    // 전략에 따른 조정
    if (strategy === 'aggressive') {
      // 적에게 접근
      if (minEnemyDist <= 3) {
        priority += 15;
      }
    } else if (strategy === 'defensive') {
      // 적으로부터 거리 유지
      if (minEnemyDist >= 3) {
        priority += 10;
      }
    }
    
    // 이동 후 공격 가능한 경우 우선순위 상승
    // (임시 위치에서 공격 범위 체크)
    const attackRange = this.getUnitAttackRange(unit);
    for (const enemy of enemies) {
      const dist = this.getDistance(targetPos, enemy.position);
      if (dist <= attackRange) {
        priority += 20;
        break;
      }
    }
    
    return priority;
  }
  
  /**
   * 행동 실행
   */
  private static async executeAction(battleId: string, action: AIAction): Promise<string | null> {
    try {
      switch (action.type) {
        case 'attack':
          if (action.targetUnitId) {
            const result = await TacticalBattleEngineService.attack(battleId, {
              unitId: action.unitId,
              targetUnitId: action.targetUnitId,
            });
            return result.success ? result.message : null;
          }
          break;
          
        case 'move':
          if (action.targetPosition) {
            const result = await TacticalBattleEngineService.moveUnit(battleId, {
              unitId: action.unitId,
              targetPosition: action.targetPosition,
            });
            return result.success ? result.message : null;
          }
          break;
          
        case 'wait':
          const waitResult = await TacticalBattleEngineService.waitUnit(battleId, action.unitId);
          return waitResult.success ? waitResult.message : null;
          
        case 'retreat':
          const retreatResult = await TacticalBattleEngineService.retreatUnit(battleId, action.unitId);
          return retreatResult.success ? retreatResult.message : null;
      }
    } catch (error) {
      console.error(`[TacticalAI] 행동 실행 실패:`, error);
    }
    
    return null;
  }
  
  /**
   * 거리 계산
   */
  private static getDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  
  /**
   * 본진 위치 찾기
   */
  private static getHeadquartersPosition(terrain: any[][]): Position | null {
    for (let y = 0; y < terrain.length; y++) {
      for (let x = 0; x < terrain[y].length; x++) {
        if (terrain[y][x].type === TerrainType.HEADQUARTERS) {
          return { x, y };
        }
      }
    }
    return null;
  }
  
  /**
   * 유닛 공격 범위 가져오기
   */
  private static getUnitAttackRange(unit: ITacticalUnit): number {
    switch (unit.unitType) {
      case UnitType.ARCHER: return 3;
      case UnitType.CROSSBOW: return 4;
      case UnitType.SIEGE: return 5;
      default: return 1;
    }
  }
  
  /**
   * AI가 제어해야 하는 진영인지 확인
   */
  static isAIControlled(battle: ITacticalBattle, side: 'attacker' | 'defender'): boolean {
    const participant = side === 'attacker' ? battle.attacker : battle.defender;
    return !participant.isUserControlled;
  }
  
  /**
   * 전체 AI 턴 자동 실행 (양측 모두 AI일 때)
   */
  static async executeFullAutoTurn(battleId: string): Promise<{ finished: boolean; winner?: string }> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle || battle.status !== BattleStatus.ONGOING) {
      return { finished: true, winner: battle?.winner };
    }
    
    // AI 진영이면 자동 실행
    if (this.isAIControlled(battle, battle.currentSide)) {
      await this.executeAITurn(battleId);
    }
    
    // 전투 종료 체크
    const updatedBattle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!updatedBattle || updatedBattle.status === BattleStatus.FINISHED) {
      return { finished: true, winner: updatedBattle?.winner };
    }
    
    return { finished: false };
  }
  
  /**
   * 전체 전투 자동 시뮬레이션 (한 번에 끝까지)
   */
  static async simulateBattle(battleId: string, maxIterations = 200): Promise<{
    winner: 'attacker' | 'defender' | 'draw';
    turns: number;
    logs: string[];
  }> {
    let iterations = 0;
    const logs: string[] = [];
    
    while (iterations < maxIterations) {
      const battle = await TacticalBattle.findOne({ battle_id: battleId });
      if (!battle || battle.status === BattleStatus.FINISHED) {
        return {
          winner: battle?.winner || 'draw',
          turns: battle?.currentTurn || 0,
          logs,
        };
      }
      
      if (battle.status === BattleStatus.WAITING || battle.status === BattleStatus.READY) {
        // 전투 시작
        const { TacticalBattleSessionService } = await import('./TacticalBattleSession.service');
        await TacticalBattleSessionService.startBattle(battleId);
      }
      
      // AI 턴 실행
      const { actions } = await this.executeAITurn(battleId);
      logs.push(...actions);
      
      iterations++;
    }
    
    // 최대 반복 초과
    console.warn(`[TacticalAI] 시뮬레이션 최대 반복 초과: ${battleId}`);
    
    const finalBattle = await TacticalBattle.findOne({ battle_id: battleId });
    return {
      winner: finalBattle?.winner || 'draw',
      turns: finalBattle?.currentTurn || 0,
      logs,
    };
  }
}





