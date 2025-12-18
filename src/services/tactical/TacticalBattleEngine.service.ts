/**
 * 전술전투 엔진 서비스
 * 턴 관리, 이동, 전투 로직
 */

import { 
  TacticalBattle, 
  ITacticalBattle,
  ITacticalUnit,
  BattleStatus,
  UnitStatus,
  UnitType,
  UnitTypeProperties,
  TerrainType,
  TerrainProperties,
  TerrainCell,
  Position,
  BattleActionLog,
} from '../../models/tactical_battle.model';

// ============================================================
// 인터페이스
// ============================================================

export interface MoveCommand {
  unitId: string;
  targetPosition: Position;
}

export interface AttackCommand {
  unitId: string;
  targetUnitId: string;
}

export interface SkillCommand {
  unitId: string;
  skillId: string;
  targetPosition?: Position;
  targetUnitId?: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  damage?: number;
  unitUpdates?: Partial<ITacticalUnit>[];
  logs?: BattleActionLog[];
}

// ============================================================
// 전투 엔진
// ============================================================

export class TacticalBattleEngineService {
  
  // ============================================================
  // 턴 관리
  // ============================================================
  
  /**
   * 다음 턴으로 넘기기
   */
  static async nextTurn(battleId: string): Promise<ITacticalBattle> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) throw new Error('전투를 찾을 수 없습니다');
    if (battle.status !== BattleStatus.ONGOING) throw new Error('진행 중인 전투가 아닙니다');
    
    // 현재 턴 종료
    const currentSide = battle.currentSide;
    
    // 모든 유닛 행동 완료 처리
    for (const unit of battle.units) {
      if (unit.side === currentSide) {
        unit.hasMoved = true;
        unit.hasActed = true;
      }
    }
    
    // 다음 턴 계산
    if (currentSide === 'attacker') {
      // 공격측 → 방어측
      battle.currentSide = 'defender';
    } else {
      // 방어측 → 공격측 (새 턴)
      battle.currentSide = 'attacker';
      battle.currentTurn += 1;
    }
    
    // 턴 시작 처리
    battle.turnStartedAt = new Date();
    
    // 새 진영 유닛들 행동력 초기화
    for (const unit of battle.units) {
      if (unit.side === battle.currentSide && unit.status === UnitStatus.ACTIVE) {
        unit.actionPoints = unit.maxActionPoints;
        unit.hasMoved = false;
        unit.hasActed = false;
      }
    }
    
    // 승리 조건 체크
    const winner = this.checkVictoryCondition(battle);
    if (winner) {
      return this.finishBattle(battle, winner);
    }
    
    // 최대 턴 초과 체크 → 공격 실패 (무승부 = 방어 승리)
    if (battle.currentTurn > battle.maxTurns) {
      return this.finishBattle(battle, 'draw', '최대 턴 초과');
    }
    
    // 군량 체크 (턴 시작 시)
    const riceCheckResult = await this.checkRiceAndApplyPenalty(battle);
    if (riceCheckResult.forceEnd) {
      return this.finishBattle(battle, riceCheckResult.winner!, riceCheckResult.reason);
    }
    
    await battle.save();
    return battle;
  }
  
  /**
   * 턴 종료 (현재 진영)
   */
  static async endTurn(battleId: string, side: 'attacker' | 'defender'): Promise<ITacticalBattle> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) throw new Error('전투를 찾을 수 없습니다');
    if (battle.currentSide !== side) throw new Error('현재 차례가 아닙니다');
    
    return this.nextTurn(battleId);
  }
  
  /**
   * 턴 시간 초과 체크 및 자동 턴 넘김
   * @returns 처리된 전투 ID 목록
   */
  static async processTimeoutTurns(sessionId: string): Promise<string[]> {
    const processedBattles: string[] = [];
    const now = new Date();
    
    // 진행 중인 전투 조회
    const ongoingBattles = await TacticalBattle.find({
      session_id: sessionId,
      status: BattleStatus.ONGOING,
    });
    
    for (const battle of ongoingBattles) {
      if (!battle.turnStartedAt) continue;
      
      const turnElapsed = (now.getTime() - battle.turnStartedAt.getTime()) / 1000;
      
      // 턴 시간 초과 체크
      if (turnElapsed >= battle.turnTimeLimit) {
        console.log(`[TacticalBattle] 턴 시간 초과: ${battle.battle_id} (${Math.round(turnElapsed)}초/${battle.turnTimeLimit}초)`);
        
        // 현재 진영이 AI 제어가 아니면 AI로 행동 후 턴 넘김
        const currentParticipant = battle.currentSide === 'attacker' ? battle.attacker : battle.defender;
        
        if (!currentParticipant.isUserControlled) {
          // AI 턴 실행
          const { TacticalBattleAIService } = await import('./TacticalBattleAI.service');
          await TacticalBattleAIService.executeAITurn(battle.battle_id);
        } else {
          // 유저 턴 시간 초과 - 강제 턴 넘김
          await this.nextTurn(battle.battle_id);
        }
        
        processedBattles.push(battle.battle_id);
      }
    }
    
    return processedBattles;
  }
  
  // ============================================================
  // 이동 시스템
  // ============================================================
  
  /**
   * 유닛 이동
   */
  static async moveUnit(battleId: string, command: MoveCommand): Promise<CommandResult> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) return { success: false, message: '전투를 찾을 수 없습니다' };
    
    const unit = battle.units.find(u => u.id === command.unitId);
    if (!unit) return { success: false, message: '유닛을 찾을 수 없습니다' };
    
    // 검증
    if (unit.side !== battle.currentSide) {
      return { success: false, message: '현재 차례가 아닙니다' };
    }
    if (unit.status !== UnitStatus.ACTIVE) {
      return { success: false, message: '행동 불가 상태입니다' };
    }
    if (unit.hasMoved) {
      return { success: false, message: '이미 이동했습니다' };
    }
    
    // 이동 가능 범위 체크
    const movablePositions = this.getMovablePositions(battle, unit);
    const target = command.targetPosition;
    const canMove = movablePositions.some(p => p.x === target.x && p.y === target.y);
    
    if (!canMove) {
      return { success: false, message: '이동할 수 없는 위치입니다' };
    }
    
    // 이동 실행
    const oldPos = { ...unit.position };
    unit.position = target;
    unit.hasMoved = true;
    unit.actionPoints -= 1;
    
    // 로그 추가
    const log: BattleActionLog = {
      turn: battle.currentTurn,
      phase: 0,
      actorId: unit.id,
      actorName: unit.name,
      action: 'move',
      targetPosition: target,
      timestamp: new Date(),
    };
    battle.actionLogs.push(log);
    
    await battle.save();
    
    return {
      success: true,
      message: `${unit.name}이(가) (${target.x}, ${target.y})로 이동했습니다`,
      logs: [log],
    };
  }
  
  /**
   * 이동 가능 위치 계산
   */
  static getMovablePositions(battle: ITacticalBattle, unit: ITacticalUnit): Position[] {
    const positions: Position[] = [];
    const unitProps = UnitTypeProperties[unit.unitType];
    const moveRange = unitProps.moveRange;
    
    if (moveRange === 0) return positions; // 건물은 이동 불가
    
    const { terrain, units } = battle;
    const visited = new Set<string>();
    const queue: { pos: Position; cost: number }[] = [{ pos: unit.position, cost: 0 }];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.pos.x},${current.pos.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (current.cost > 0) {
        // 다른 유닛이 있는지 체크
        const occupied = units.some(
          u => u.id !== unit.id && 
               u.status === UnitStatus.ACTIVE && 
               u.position.x === current.pos.x && 
               u.position.y === current.pos.y
        );
        if (!occupied) {
          positions.push(current.pos);
        }
      }
      
      if (current.cost >= moveRange) continue;
      
      // 인접 4방향 탐색
      const directions = [
        { x: 0, y: -1 }, { x: 0, y: 1 },
        { x: -1, y: 0 }, { x: 1, y: 0 },
      ];
      
      for (const dir of directions) {
        const nx = current.pos.x + dir.x;
        const ny = current.pos.y + dir.y;
        
        if (nx < 0 || nx >= battle.mapWidth || ny < 0 || ny >= battle.mapHeight) continue;
        
        const cell = terrain[ny][nx];
        const terrainProps = TerrainProperties[cell.type];
        
        // 통과 가능 여부 체크
        if (!this.canPassTerrain(unit, cell)) continue;
        
        const newCost = current.cost + terrainProps.moveCost;
        if (newCost <= moveRange) {
          queue.push({ pos: { x: nx, y: ny }, cost: newCost });
        }
      }
    }
    
    return positions;
  }
  
  /**
   * 유닛이 지형을 통과할 수 있는지 체크
   */
  private static canPassTerrain(unit: ITacticalUnit, cell: TerrainCell): boolean {
    const terrainProps = TerrainProperties[cell.type];
    const unitProps = UnitTypeProperties[unit.unitType];
    
    if (!terrainProps.passable) {
      // 성문이 파괴되었으면 통과 가능
      if (cell.type === TerrainType.GATE && cell.destroyed) {
        return true;
      }
      // 성벽은 사다리가 있으면 통과 가능
      if (cell.type === TerrainType.WALL && unit.hasLadder && unitProps.canClimbWall) {
        return true;
      }
      return false;
    }
    
    // 산은 보병만 통과 가능
    if (cell.type === TerrainType.MOUNTAIN && !unitProps.canPassMountain) {
      return false;
    }
    
    return true;
  }
  
  // ============================================================
  // 전투 시스템
  // ============================================================
  
  /**
   * 공격 실행
   */
  static async attack(battleId: string, command: AttackCommand): Promise<CommandResult> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) return { success: false, message: '전투를 찾을 수 없습니다' };
    
    const attacker = battle.units.find(u => u.id === command.unitId);
    const defender = battle.units.find(u => u.id === command.targetUnitId);
    
    if (!attacker) return { success: false, message: '공격 유닛을 찾을 수 없습니다' };
    if (!defender) return { success: false, message: '대상 유닛을 찾을 수 없습니다' };
    
    // 검증
    if (attacker.side !== battle.currentSide) {
      return { success: false, message: '현재 차례가 아닙니다' };
    }
    if (attacker.status !== UnitStatus.ACTIVE) {
      return { success: false, message: '행동 불가 상태입니다' };
    }
    if (attacker.hasActed) {
      return { success: false, message: '이미 행동했습니다' };
    }
    if (attacker.side === defender.side) {
      return { success: false, message: '아군을 공격할 수 없습니다' };
    }
    
    // 공격 범위 체크
    const attackableTargets = this.getAttackableTargets(battle, attacker);
    const canAttack = attackableTargets.some(t => t.id === defender.id);
    
    if (!canAttack) {
      return { success: false, message: '공격 범위 밖입니다' };
    }
    
    // 데미지 계산
    const damage = this.calculateDamage(battle, attacker, defender);
    
    // 데미지 적용
    defender.hp = Math.max(0, defender.hp - damage);
    if (defender.hp === 0) {
      defender.status = UnitStatus.DEAD;
    }
    
    // 행동 완료
    attacker.hasActed = true;
    attacker.actionPoints -= 1;
    
    // 로그
    const log: BattleActionLog = {
      turn: battle.currentTurn,
      phase: 0,
      actorId: attacker.id,
      actorName: attacker.name,
      action: 'attack',
      targetId: defender.id,
      targetName: defender.name,
      damage,
      result: defender.status === UnitStatus.DEAD ? '전멸' : `HP ${defender.hp}`,
      timestamp: new Date(),
    };
    battle.actionLogs.push(log);
    
    // 승리 조건 체크
    const winner = this.checkVictoryCondition(battle);
    if (winner) {
      await this.finishBattle(battle, winner);
    } else {
      await battle.save();
    }
    
    return {
      success: true,
      message: `${attacker.name}이(가) ${defender.name}에게 ${damage} 데미지!`,
      damage,
      logs: [log],
    };
  }
  
  /**
   * 공격 가능 대상 목록
   */
  static getAttackableTargets(battle: ITacticalBattle, unit: ITacticalUnit): ITacticalUnit[] {
    const targets: ITacticalUnit[] = [];
    const unitProps = UnitTypeProperties[unit.unitType];
    const attackRange = unitProps.attackRange;
    
    if (attackRange === 0) return targets; // 건물은 공격 불가
    
    for (const target of battle.units) {
      if (target.side === unit.side) continue; // 아군 제외
      if (target.status !== UnitStatus.ACTIVE) continue; // 전멸 유닛 제외
      
      const distance = this.getDistance(unit.position, target.position);
      if (distance <= attackRange) {
        targets.push(target);
      }
    }
    
    return targets;
  }
  
  /**
   * 거리 계산 (맨해튼 거리)
   */
  private static getDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  
  /**
   * 데미지 계산
   */
  private static calculateDamage(
    battle: ITacticalBattle,
    attacker: ITacticalUnit,
    defender: ITacticalUnit
  ): number {
    // 기본 공격력
    let damage = attacker.attack;
    
    // 병력 비율 보정
    const hpRatio = attacker.hp / attacker.maxHp;
    damage *= Math.max(0.5, hpRatio);
    
    // 방어력 감소
    const defenseReduction = defender.defense / (defender.defense + 100);
    damage *= (1 - defenseReduction * 0.5);
    
    // 지형 보정 (방어측)
    const defenderCell = battle.terrain[defender.position.y][defender.position.x];
    const terrainBonus = TerrainProperties[defenderCell.type].defenseBonus;
    damage *= (1 - terrainBonus / 100);
    
    // 사기 보정
    const moraleBonus = (attacker.morale - 50) / 100;
    damage *= (1 + moraleBonus * 0.2);
    
    // 병종 상성 (간단화)
    const typeBonus = this.getTypeAdvantage(attacker.unitType, defender.unitType);
    damage *= typeBonus;
    
    // 랜덤 요소 (±10%)
    const random = 0.9 + Math.random() * 0.2;
    damage *= random;
    
    // 최소/최대 데미지
    damage = Math.max(50, Math.round(damage));
    damage = Math.min(damage, defender.hp);
    
    return damage;
  }
  
  /**
   * 병종 상성
   */
  private static getTypeAdvantage(attackerType: UnitType, defenderType: UnitType): number {
    // 기병 > 궁병 > 보병 > 기병
    const advantages: Record<UnitType, UnitType[]> = {
      [UnitType.CAVALRY]: [UnitType.ARCHER, UnitType.CROSSBOW],
      [UnitType.ARCHER]: [UnitType.INFANTRY],
      [UnitType.CROSSBOW]: [UnitType.INFANTRY, UnitType.CAVALRY],
      [UnitType.INFANTRY]: [UnitType.CAVALRY],
      [UnitType.SIEGE]: [UnitType.WALL, UnitType.GATE],
      [UnitType.WALL]: [],
      [UnitType.GATE]: [],
    };
    
    if (advantages[attackerType]?.includes(defenderType)) {
      return 1.3; // 30% 보너스
    }
    
    // 역상성 체크
    for (const [type, targets] of Object.entries(advantages)) {
      if (targets.includes(attackerType) && type === defenderType) {
        return 0.7; // 30% 페널티
      }
    }
    
    return 1.0;
  }
  
  // ============================================================
  // 승리 조건
  // ============================================================
  
  /**
   * 승리 조건 체크
   */
  private static checkVictoryCondition(battle: ITacticalBattle): 'attacker' | 'defender' | null {
    // 1. 본진 점령 체크
    const hqPos = this.getHeadquartersPosition(battle.terrain);
    if (hqPos) {
      const attackerOnHQ = battle.units.some(
        u => u.side === 'attacker' && 
             u.status === UnitStatus.ACTIVE &&
             u.position.x === hqPos.x && 
             u.position.y === hqPos.y
      );
      if (attackerOnHQ) {
        return 'attacker';
      }
    }
    
    // 2. 전멸 체크
    const attackerAlive = battle.units.some(
      u => u.side === 'attacker' && 
           u.status === UnitStatus.ACTIVE && 
           u.unitType !== UnitType.WALL && 
           u.unitType !== UnitType.GATE
    );
    const defenderAlive = battle.units.some(
      u => u.side === 'defender' && 
           u.status === UnitStatus.ACTIVE && 
           u.unitType !== UnitType.WALL && 
           u.unitType !== UnitType.GATE
    );
    
    if (!attackerAlive) return 'defender';
    if (!defenderAlive) return 'attacker';
    
    return null;
  }
  
  /**
   * 본진 위치 찾기
   */
  private static getHeadquartersPosition(terrain: TerrainCell[][]): Position | null {
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
   * 전투 종료 처리
   * - draw(무승부) = 공격 실패, 방어 승리로 처리
   * - 분쟁 기여도는 양측 모두 누적
   */
  private static async finishBattle(
    battle: ITacticalBattle,
    winner: 'attacker' | 'defender' | 'draw',
    reason?: string
  ): Promise<ITacticalBattle> {
    // 손실 계산
    const attackerCasualties = battle.units
      .filter(u => u.side === 'attacker' && u.unitType !== UnitType.WALL && u.unitType !== UnitType.GATE)
      .reduce((sum, u) => sum + (u.maxHp - u.hp), 0);
    
    const defenderCasualties = battle.units
      .filter(u => u.side === 'defender' && u.unitType !== UnitType.WALL && u.unitType !== UnitType.GATE)
      .reduce((sum, u) => sum + (u.maxHp - u.hp), 0);
    
    // === 무승부(시간/턴 초과) 처리 ===
    // 무승부 = 공격 실패, 방어 승리로 처리
    let actualWinner: 'attacker' | 'defender' = winner === 'draw' ? 'defender' : winner;
    let additionalAttackerPenalty = 0;
    
    if (winner === 'draw') {
      // 공성전에서 시간 초과 = 공격 실패
      additionalAttackerPenalty = 0.2; // 공격측 추가 20% 병력 손실
      
      console.log(`[TacticalBattle] 무승부 → 공격 실패 처리 (${reason || '시간/턴 초과'})`);
    }
    
    battle.status = BattleStatus.FINISHED;
    battle.winner = actualWinner;
    (battle as any).result = {
      attackerCasualties,
      defenderCasualties,
      cityOccupied: actualWinner === 'attacker',
      originalResult: winner, // 원래 결과 저장 (무승부 여부 확인용)
      finishReason: reason || (winner === 'draw' ? '시간/턴 초과' : undefined),
      additionalPenalty: additionalAttackerPenalty,
    };
    battle.finishedAt = new Date();
    
    await battle.save();
    
    // === 분쟁 기여도 누적 (양측 모두) ===
    try {
      const { conflictService } = await import('../war/Conflict.service');
      
      // 공격측 기여도: 준 피해량 기반
      if (defenderCasualties > 0) {
        await conflictService.addConflict(
          battle.session_id,
          battle.cityId,
          battle.attacker.nationId,
          defenderCasualties
        );
        console.log(`[TacticalBattle] 공격측 분쟁 기여도 추가: ${defenderCasualties}`);
      }
      
      // 방어측 기여도: 준 피해량 기반
      if (attackerCasualties > 0) {
        await conflictService.addConflict(
          battle.session_id,
          battle.cityId,
          battle.defender.nationId,
          attackerCasualties
        );
        console.log(`[TacticalBattle] 방어측 분쟁 기여도 추가: ${attackerCasualties}`);
      }
    } catch (conflictError) {
      console.warn('[TacticalBattle] 분쟁 기여도 누적 실패:', conflictError);
    }
    
    // === 전투 결과에 따른 후속 처리 ===
    try {
      await this.applyBattleResult(battle, actualWinner, additionalAttackerPenalty);
    } catch (resultError) {
      console.error('[TacticalBattle] 전투 결과 적용 실패:', resultError);
    }
    
    console.log(`[TacticalBattle] 전투 종료: ${battle.battle_id} (승자: ${actualWinner}${winner === 'draw' ? ', 원래: 무승부' : ''})`);
    
    return battle;
  }
  
  /**
   * 군량 체크 및 페널티 적용
   * - 공격측 군량 0: 강제 후퇴 (공격 실패)
   * - 방어측 군량 0: 방어력 -50%, 사기 -20
   */
  private static async checkRiceAndApplyPenalty(
    battle: ITacticalBattle
  ): Promise<{ forceEnd: boolean; winner?: 'attacker' | 'defender'; reason?: string }> {
    const { generalRepository } = await import('../../repositories/general.repository');
    
    // 공격측 군량 체크 (리더 기준)
    const attackerLeaderId = battle.attacker.generals[0];
    if (attackerLeaderId > 0) {
      const attackerLeader = await generalRepository.findBySessionAndNo(battle.session_id, attackerLeaderId);
      
      if (attackerLeader && (attackerLeader.rice ?? 0) <= 0) {
        console.log(`[TacticalBattle] 공격측 군량 고갈 - 강제 후퇴`);
        return {
          forceEnd: true,
          winner: 'defender',
          reason: '공격측 군량 고갈',
        };
      }
    }
    
    // 방어측 군량 체크 (방어측 유닛 전체에 페널티)
    const defenderLeaderId = battle.defender.generals[0];
    if (defenderLeaderId > 0) {
      const defenderLeader = await generalRepository.findBySessionAndNo(battle.session_id, defenderLeaderId);
      
      if (defenderLeader && (defenderLeader.rice ?? 0) <= 0) {
        console.log(`[TacticalBattle] 방어측 군량 고갈 - 페널티 적용`);
        
        // 방어측 유닛 페널티: 방어력 -50%, 사기 -20
        for (const unit of battle.units) {
          if (unit.side === 'defender' && unit.status === UnitStatus.ACTIVE) {
            unit.defense = Math.floor(unit.defense * 0.5);
            unit.morale = Math.max(0, unit.morale - 20);
          }
        }
        
        // 별도 플래그로 표시 (한 번만 적용)
        if (!battle.result) {
          battle.result = {} as any;
        }
        (battle.result as any).defenderRicePenaltyApplied = true;
        
        await battle.save();
      }
    }
    
    return { forceEnd: false };
  }
  
  /**
   * 전투 결과 적용 (병력 손실, 도시 점령 등)
   */
  private static async applyBattleResult(
    battle: ITacticalBattle,
    winner: 'attacker' | 'defender',
    additionalPenalty: number = 0
  ): Promise<void> {
    const { ProcessWarService } = await import('../war/ProcessWar.service');
    const { generalRepository } = await import('../../repositories/general.repository');
    const { ActionLogger } = await import('../logger/ActionLogger');
    
    // 공격측 장수들의 병력 손실 적용
    for (const unit of battle.units) {
      if (unit.side === 'attacker' && unit.generalId > 0) {
        const lostHp = unit.maxHp - unit.hp;
        const additionalLoss = Math.floor(unit.maxHp * additionalPenalty);
        const totalLoss = lostHp + additionalLoss;
        
        if (totalLoss > 0) {
          await ProcessWarService.applyBattleLossToGeneral(
            battle.session_id,
            unit.generalId,
            totalLoss
          );
        }
      }
    }
    
    // 방어측 장수들의 병력 손실 적용
    for (const unit of battle.units) {
      if (unit.side === 'defender' && unit.generalId > 0) {
        const lostHp = unit.maxHp - unit.hp;
        
        if (lostHp > 0) {
          await ProcessWarService.applyBattleLossToGeneral(
            battle.session_id,
            unit.generalId,
            lostHp
          );
        }
      }
    }
    
    // 공격측 승리 시 도시 점령
    if (winner === 'attacker') {
      const attackerLeaderId = battle.attacker.generals[0];
      const attackerLeader = await generalRepository.findBySessionAndNo(battle.session_id, attackerLeaderId);
      
      if (attackerLeader) {
        // 년/월 정보 가져오기
        const { sessionRepository } = await import('../../repositories/session.repository');
        const session = await sessionRepository.findBySessionId(battle.session_id);
        const gameEnv = session?.data?.game_env || {};
        const year = gameEnv.year || 184;
        const month = gameEnv.month || 1;
        
        const logger = new ActionLogger(
          attackerLeaderId,
          battle.attacker.nationId,
          year,
          month,
          battle.session_id,
          false
        );
        
        await ProcessWarService.conquerCity(
          battle.session_id,
          battle.cityId,
          battle.attacker.nationId,
          attackerLeaderId,
          { logger }
        );
        
        await logger.flush();
      }
    } else {
      // 방어측 승리 시 공격측 사기 감소 (-30)
      for (const unit of battle.units) {
        if (unit.side === 'attacker' && unit.generalId > 0) {
          const general = await generalRepository.findBySessionAndNo(battle.session_id, unit.generalId);
          if (general) {
            general.morale = Math.max(0, (general.morale || 100) - 30);
            await generalRepository.save(general);
          }
        }
      }
    }
  }
  
  // ============================================================
  // 유틸리티
  // ============================================================
  
  /**
   * 대기 명령
   */
  static async waitUnit(battleId: string, unitId: string): Promise<CommandResult> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) return { success: false, message: '전투를 찾을 수 없습니다' };
    
    const unit = battle.units.find(u => u.id === unitId);
    if (!unit) return { success: false, message: '유닛을 찾을 수 없습니다' };
    
    if (unit.side !== battle.currentSide) {
      return { success: false, message: '현재 차례가 아닙니다' };
    }
    
    unit.hasMoved = true;
    unit.hasActed = true;
    unit.actionPoints = 0;
    
    const log: BattleActionLog = {
      turn: battle.currentTurn,
      phase: 0,
      actorId: unit.id,
      actorName: unit.name,
      action: 'wait',
      timestamp: new Date(),
    };
    battle.actionLogs.push(log);
    
    await battle.save();
    
    return {
      success: true,
      message: `${unit.name}이(가) 대기합니다`,
      logs: [log],
    };
  }
  
  /**
   * 퇴각 명령
   */
  static async retreatUnit(battleId: string, unitId: string): Promise<CommandResult> {
    const battle = await TacticalBattle.findOne({ battle_id: battleId });
    if (!battle) return { success: false, message: '전투를 찾을 수 없습니다' };
    
    const unit = battle.units.find(u => u.id === unitId);
    if (!unit) return { success: false, message: '유닛을 찾을 수 없습니다' };
    
    if (unit.side !== battle.currentSide) {
      return { success: false, message: '현재 차례가 아닙니다' };
    }
    
    unit.status = UnitStatus.RETREATED;
    
    const log: BattleActionLog = {
      turn: battle.currentTurn,
      phase: 0,
      actorId: unit.id,
      actorName: unit.name,
      action: 'retreat',
      timestamp: new Date(),
    };
    battle.actionLogs.push(log);
    
    // 승리 조건 체크
    const winner = this.checkVictoryCondition(battle);
    if (winner) {
      await this.finishBattle(battle, winner);
    } else {
      await battle.save();
    }
    
    return {
      success: true,
      message: `${unit.name}이(가) 퇴각합니다`,
      logs: [log],
    };
  }
}

