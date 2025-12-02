/**
 * TurnBasedBattle.service.ts
 * 삼국지 스타일 턴제 전투 엔진 서비스
 * 
 * 전투 흐름:
 * 1. 전투 시작 - 맵 생성, 유닛 배치
 * 2. 턴 시작 - 버프/디버프 처리, 행동 순서 결정
 * 3. 행동 페이즈 - 속도순 이동 → 공격 → 반격
 * 4. 턴 종료 - 사기 체크, 패주 처리
 * 5. 승리 조건 체크
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TurnBasedBattleState,
  TurnBasedUnit,
  TurnBasedUnitInit,
  CreateTurnBasedBattleParams,
  BattleMap,
  BattleTile,
  GridPosition,
  TerrainType,
  TurnPhase,
  BattleAction,
  ActionResult,
  TurnResult,
  DamageCalculationParams,
  DamageResult,
  VictoryCondition,
  BattleLogEntry,
  DEFAULT_BATTLE_CONFIG,
  TurnBasedBattleConfig,
  GRID_SIZE,
  getUnitCategory,
  UnitCategory,
} from './TurnBasedBattle.types';
import {
  getCompatibilityModifier,
  getCompatibilityInfo,
  getTerrainDefenseModifier,
  getTerrainAttackModifier,
  getTerrainEffect,
  getElevationModifier,
  canPassTerrain,
  getMoveCost,
  applySpecialAbilities,
} from './UnitCompatibility';
import {
  Formation,
  FORMATION_STATS,
  getFormationStats,
  getFormationCounter,
} from '../../core/battle/interfaces/Formation';

// ============================================================================
// 턴제 전투 서비스
// ============================================================================

export class TurnBasedBattleService {
  private config: TurnBasedBattleConfig;

  constructor(config: Partial<TurnBasedBattleConfig> = {}) {
    this.config = { ...DEFAULT_BATTLE_CONFIG, ...config };
  }

  // ==========================================================================
  // 전투 생성
  // ==========================================================================

  /**
   * 새 전투 생성
   */
  createBattle(params: CreateTurnBasedBattleParams): TurnBasedBattleState {
    const battleId = uuidv4();
    const map = this.generateMap(params.mapTemplate);
    
    // 유닛 생성 및 배치
    const attackerUnits = this.createUnits(
      params.attackerUnits, 
      'attacker', 
      params.attackerPlayerId
    );
    const defenderUnits = this.createUnits(
      params.defenderUnits, 
      'defender', 
      params.defenderPlayerId
    );

    // 유닛 배치
    this.deployUnits(map, attackerUnits, 'attacker');
    this.deployUnits(map, defenderUnits, 'defender');

    // 유닛 맵 생성
    const units = new Map<string, TurnBasedUnit>();
    for (const unit of [...attackerUnits, ...defenderUnits]) {
      units.set(unit.id, unit);
    }

    // 행동 순서 계산 (속도순)
    const unitOrder = this.calculateActionOrder(units);

    const state: TurnBasedBattleState = {
      battleId,
      sessionId: params.sessionId,
      attackerPlayerId: params.attackerPlayerId,
      defenderPlayerId: params.defenderPlayerId,
      attackerNationId: params.attackerNationId,
      defenderNationId: params.defenderNationId,
      map,
      units,
      unitOrder,
      currentTurn: 0,
      maxTurns: params.maxTurns ?? this.config.maxTurns,
      currentPhase: 'start',
      activeUnitIndex: 0,
      battleLog: [],
      turnHistory: [],
      isFinished: false,
      startedAt: new Date(),
    };

    this.addLog(state, 'start', `전투 시작: ${attackerUnits.length}명 vs ${defenderUnits.length}명`);

    return state;
  }

  /**
   * 40x40 전투 맵 생성
   */
  private generateMap(template?: string): BattleMap {
    const map: BattleMap = [];

    for (let y = 0; y < GRID_SIZE; y++) {
      const row: BattleTile[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        let terrain: TerrainType = 'plain';
        let elevation = 0;

        // 기본 지형 생성 (템플릿 없을 경우)
        if (!template) {
          // 가장자리는 언덕/산
          if (y < 3 || y >= GRID_SIZE - 3 || x < 3 || x >= GRID_SIZE - 3) {
            terrain = Math.random() < 0.3 ? 'hill' : 'forest';
            elevation = terrain === 'hill' ? 2 : 1;
          }
          // 중앙은 평지
          else if (Math.random() < 0.1) {
            terrain = 'forest';
            elevation = 1;
          }
          // 도로 (중앙 가로세로)
          if ((y === Math.floor(GRID_SIZE / 2) || x === Math.floor(GRID_SIZE / 2)) && terrain === 'plain') {
            terrain = 'road';
          }
        }

        row.push({
          position: { x, y },
          terrain,
          elevation,
        });
      }
      map.push(row);
    }

    return map;
  }

  /**
   * 유닛 생성
   */
  private createUnits(
    inits: TurnBasedUnitInit[],
    side: 'attacker' | 'defender',
    playerId: number
  ): TurnBasedUnit[] {
    return inits.map((init, index) => {
      const category = getUnitCategory(init.crewTypeId);
      const baseSpeed = this.getBaseSpeed(category);
      const baseRange = this.getBaseAttackRange(category, init.crewTypeId);

      return {
        id: uuidv4(),
        name: `${init.generalName}`,
        generalId: init.generalId,
        generalName: init.generalName,
        side,
        playerId,
        position: { x: 0, y: 0 }, // 나중에 배치
        facing: side === 'attacker' ? 0 : 180,
        crewTypeId: init.crewTypeId,
        crewTypeName: this.getCrewTypeName(init.crewTypeId),
        category,
        troops: init.troops,
        maxTroops: init.troops,
        attack: init.attack,
        defense: init.defense,
        speed: baseSpeed,
        attackRange: baseRange,
        moveRange: Math.floor(baseSpeed / 2) + 3,
        morale: init.morale,
        training: init.training,
        hp: init.troops * 10,
        maxHp: init.troops * 10,
        formation: init.formation ?? 'square',
        hasActed: false,
        hasMoved: false,
        hasAttacked: false,
        isRouting: false,
        buffs: [],
        debuffs: [],
      };
    });
  }

  /**
   * 유닛 배치
   */
  private deployUnits(
    map: BattleMap,
    units: TurnBasedUnit[],
    side: 'attacker' | 'defender'
  ): void {
    const startY = side === 'attacker' ? GRID_SIZE - 5 : 4;
    const startX = Math.floor(GRID_SIZE / 2) - Math.floor(units.length / 2);

    units.forEach((unit, index) => {
      const x = Math.min(Math.max(startX + index * 2, 2), GRID_SIZE - 3);
      const y = startY;
      
      unit.position = { x, y };
      map[y][x].occupiedBy = unit.id;
    });
  }

  /**
   * 행동 순서 계산 (속도순, 높을수록 먼저)
   */
  private calculateActionOrder(units: Map<string, TurnBasedUnit>): string[] {
    const unitList = Array.from(units.values())
      .filter(u => !u.isRouting && u.troops > 0);
    
    // 속도 순 정렬 (높은 순) + 같으면 랜덤
    unitList.sort((a, b) => {
      if (b.speed !== a.speed) {
        return b.speed - a.speed;
      }
      return Math.random() - 0.5;
    });

    return unitList.map(u => u.id);
  }

  // ==========================================================================
  // 턴 처리
  // ==========================================================================

  /**
   * 다음 턴 시작
   */
  startNextTurn(state: TurnBasedBattleState): TurnResult {
    state.currentTurn++;
    state.currentPhase = 'start';
    state.activeUnitIndex = 0;

    this.addLog(state, 'start', `===== 턴 ${state.currentTurn} 시작 =====`);

    // 버프/디버프 감소
    this.processBuffsAndDebuffs(state);

    // 유닛 상태 초기화
    for (const unit of state.units.values()) {
      unit.hasActed = false;
      unit.hasMoved = false;
      unit.hasAttacked = false;
    }

    // 행동 순서 재계산
    state.unitOrder = this.calculateActionOrder(state.units);

    this.addLog(state, 'start', 
      `행동 순서: ${state.unitOrder.map(id => state.units.get(id)?.name).join(' → ')}`
    );

    // 턴 결과 초기화
    return {
      turnNumber: state.currentTurn,
      actionOrder: [...state.unitOrder],
      actions: [],
      eliminatedUnits: [],
      routingUnits: [],
    };
  }

  /**
   * 버프/디버프 처리
   */
  private processBuffsAndDebuffs(state: TurnBasedBattleState): void {
    for (const unit of state.units.values()) {
      // 버프 지속시간 감소
      unit.buffs = unit.buffs
        .map(b => ({ ...b, duration: b.duration - 1 }))
        .filter(b => b.duration > 0);

      // 디버프 지속시간 감소
      unit.debuffs = unit.debuffs
        .map(d => ({ ...d, duration: d.duration - 1 }))
        .filter(d => d.duration > 0);
    }
  }

  /**
   * 현재 행동할 유닛 조회
   */
  getCurrentUnit(state: TurnBasedBattleState): TurnBasedUnit | null {
    if (state.activeUnitIndex >= state.unitOrder.length) {
      return null;
    }
    return state.units.get(state.unitOrder[state.activeUnitIndex]) ?? null;
  }

  /**
   * 액션 실행
   */
  executeAction(
    state: TurnBasedBattleState, 
    action: BattleAction
  ): ActionResult {
    const unit = state.units.get(action.unitId);
    if (!unit) {
      return {
        action,
        success: false,
        effects: ['유닛을 찾을 수 없습니다.'],
      };
    }

    let result: ActionResult;

    switch (action.type) {
      case 'move':
        result = this.executeMove(state, unit, action);
        break;
      case 'attack':
        result = this.executeAttack(state, unit, action);
        break;
      case 'defend':
        result = this.executeDefend(state, unit);
        break;
      case 'wait':
        result = this.executeWait(state, unit);
        break;
      case 'retreat':
        result = this.executeRetreat(state, unit);
        break;
      default:
        result = {
          action,
          success: false,
          effects: ['알 수 없는 액션 타입입니다.'],
        };
    }

    return result;
  }

  /**
   * 이동 실행
   */
  private executeMove(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit,
    action: BattleAction
  ): ActionResult {
    if (!action.targetPosition) {
      return {
        action,
        success: false,
        effects: ['이동 목표가 없습니다.'],
      };
    }

    if (unit.hasMoved) {
      return {
        action,
        success: false,
        effects: ['이미 이동했습니다.'],
      };
    }

    const target = action.targetPosition;
    
    // 이동 가능 여부 확인
    const canMove = this.canMoveTo(state, unit, target);
    if (!canMove.valid) {
      return {
        action,
        success: false,
        effects: [canMove.reason ?? '이동 불가'],
      };
    }

    // 이전 위치 비우기
    const oldTile = state.map[unit.position.y][unit.position.x];
    oldTile.occupiedBy = undefined;

    // 새 위치 설정
    unit.position = { ...target };
    state.map[target.y][target.x].occupiedBy = unit.id;
    unit.hasMoved = true;

    const effect = `${unit.name}이(가) (${target.x}, ${target.y})로 이동`;
    this.addLog(state, 'action', effect);

    return {
      action,
      success: true,
      effects: [effect],
    };
  }

  /**
   * 공격 실행
   */
  private executeAttack(
    state: TurnBasedBattleState,
    attacker: TurnBasedUnit,
    action: BattleAction
  ): ActionResult {
    if (!action.targetUnitId) {
      return {
        action,
        success: false,
        effects: ['공격 대상이 없습니다.'],
      };
    }

    if (attacker.hasAttacked) {
      return {
        action,
        success: false,
        effects: ['이미 공격했습니다.'],
      };
    }

    const defender = state.units.get(action.targetUnitId);
    if (!defender) {
      return {
        action,
        success: false,
        effects: ['대상 유닛을 찾을 수 없습니다.'],
      };
    }

    // 공격 가능 여부 확인
    const canAttack = this.canAttack(state, attacker, defender);
    if (!canAttack.valid) {
      return {
        action,
        success: false,
        effects: [canAttack.reason ?? '공격 불가'],
      };
    }

    // 데미지 계산
    const terrain = state.map[defender.position.y][defender.position.x].terrain;
    const damageResult = this.calculateDamage({
      attacker,
      defender,
      terrain,
      isCounter: false,
    });

    // 피해 적용
    defender.troops = Math.max(0, defender.troops - damageResult.casualties);
    defender.hp = Math.max(0, defender.hp - damageResult.finalDamage);
    
    // 사기 감소
    const moraleLoss = Math.floor(damageResult.casualties / 10);
    defender.morale = Math.max(0, defender.morale - moraleLoss);

    attacker.hasAttacked = true;
    attacker.hasActed = true;

    const effects: string[] = [
      `${attacker.name}이(가) ${defender.name}을(를) 공격!`,
      damageResult.description,
      `${defender.name}: ${damageResult.casualties}명 사상, 사기 -${moraleLoss}`,
    ];

    // 반격 처리
    let counterDamage = 0;
    let counterCasualties = 0;

    if (this.config.counterAttackEnabled && defender.troops > 0 && !defender.isRouting) {
      const canCounter = this.canCounterAttack(state, defender, attacker);
      if (canCounter) {
        const counterResult = this.calculateDamage({
          attacker: defender,
          defender: attacker,
          terrain: state.map[attacker.position.y][attacker.position.x].terrain,
          isCounter: true,
        });

        counterDamage = counterResult.finalDamage;
        counterCasualties = counterResult.casualties;

        attacker.troops = Math.max(0, attacker.troops - counterCasualties);
        attacker.hp = Math.max(0, attacker.hp - counterDamage);
        
        const attackerMoraleLoss = Math.floor(counterCasualties / 15);
        attacker.morale = Math.max(0, attacker.morale - attackerMoraleLoss);

        effects.push(
          `${defender.name}의 반격!`,
          counterResult.description,
          `${attacker.name}: ${counterCasualties}명 사상, 사기 -${attackerMoraleLoss}`,
        );
      }
    }

    // 전멸 체크
    if (defender.troops <= 0) {
      effects.push(`${defender.name} 전멸!`);
      state.map[defender.position.y][defender.position.x].occupiedBy = undefined;
    }
    if (attacker.troops <= 0) {
      effects.push(`${attacker.name} 전멸!`);
      state.map[attacker.position.y][attacker.position.x].occupiedBy = undefined;
    }

    // 로그
    this.addLog(state, 'action', effects.join(' | '));

    return {
      action,
      success: true,
      damage: damageResult.finalDamage,
      counterDamage,
      casualties: damageResult.casualties,
      counterCasualties,
      moraleLoss,
      critical: damageResult.isCritical,
      evaded: damageResult.isEvaded,
      effects,
    };
  }

  /**
   * 방어 실행
   */
  private executeDefend(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit
  ): ActionResult {
    unit.hasActed = true;
    
    // 방어 버프 추가
    unit.buffs.push({
      type: 'defense',
      value: 30,
      duration: 1,
    });

    const effect = `${unit.name}이(가) 방어 태세`;
    this.addLog(state, 'action', effect);

    return {
      action: { unitId: unit.id, type: 'defend' },
      success: true,
      effects: [effect, '방어력 +30% (1턴)'],
    };
  }

  /**
   * 대기 실행
   */
  private executeWait(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit
  ): ActionResult {
    unit.hasActed = true;
    
    const effect = `${unit.name}이(가) 대기`;
    this.addLog(state, 'action', effect);

    return {
      action: { unitId: unit.id, type: 'wait' },
      success: true,
      effects: [effect],
    };
  }

  /**
   * 후퇴 실행
   */
  private executeRetreat(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit
  ): ActionResult {
    unit.hasActed = true;
    unit.isRouting = true;
    
    // 맵에서 제거
    state.map[unit.position.y][unit.position.x].occupiedBy = undefined;
    
    const effect = `${unit.name}이(가) 후퇴!`;
    this.addLog(state, 'action', effect);

    return {
      action: { unitId: unit.id, type: 'retreat' },
      success: true,
      effects: [effect],
    };
  }

  /**
   * 다음 유닛으로 이동
   */
  nextUnit(state: TurnBasedBattleState): TurnBasedUnit | null {
    state.activeUnitIndex++;
    
    // 죽거나 패주 중인 유닛 스킵
    while (state.activeUnitIndex < state.unitOrder.length) {
      const unit = state.units.get(state.unitOrder[state.activeUnitIndex]);
      if (unit && unit.troops > 0 && !unit.isRouting) {
        return unit;
      }
      state.activeUnitIndex++;
    }
    
    return null;
  }

  /**
   * 턴 종료 처리
   */
  endTurn(state: TurnBasedBattleState, turnResult: TurnResult): VictoryCondition | null {
    state.currentPhase = 'end';
    
    // 사기 체크 및 패주 처리
    for (const unit of state.units.values()) {
      if (unit.troops <= 0) {
        turnResult.eliminatedUnits.push(unit.id);
        continue;
      }

      // 사기가 0이면 패주
      if (unit.morale <= this.config.moraleThreshold && !unit.isRouting) {
        unit.isRouting = true;
        turnResult.routingUnits.push(unit.id);
        state.map[unit.position.y][unit.position.x].occupiedBy = undefined;
        
        this.addLog(state, 'end', `${unit.name} 사기 붕괴로 패주!`);
      }
    }

    // 승리 조건 체크
    const victory = this.checkVictoryCondition(state);
    if (victory) {
      state.winner = victory.winner;
      state.victoryCondition = victory;
      state.isFinished = true;
      state.finishedAt = new Date();
      turnResult.victoryCondition = victory;
      
      this.addLog(state, 'end', `전투 종료: ${victory.reason}`);
    }

    // 턴 결과 기록
    state.turnHistory.push(turnResult);
    
    this.addLog(state, 'end', `===== 턴 ${state.currentTurn} 종료 =====`);

    return victory;
  }

  // ==========================================================================
  // 데미지 계산
  // ==========================================================================

  /**
   * 데미지 계산
   * 공식: 공격력 × 병사수비율 × 상성보정 × 진형보정 × 지형보정 - 방어력
   */
  calculateDamage(params: DamageCalculationParams): DamageResult {
    const { attacker, defender, terrain, isCounter } = params;
    
    // 기본 공격력
    let attackPower = attacker.attack;
    
    // 반격 시 공격력 감소
    if (isCounter) {
      attackPower *= 0.6;
    }

    // 병사수 비율 (현재/최대)
    const troopModifier = attacker.troops / attacker.maxTroops;

    // 상성 보정
    const compatibilityModifier = getCompatibilityModifier(
      attacker.crewTypeId,
      defender.crewTypeId
    );

    // 진형 보정
    let formationModifier = 1.0;
    if (this.config.formationEnabled) {
      const attackerFormation = getFormationStats(attacker.formation);
      const defenderFormation = getFormationStats(defender.formation);
      const formationCounter = getFormationCounter(attacker.formation, defender.formation);
      
      formationModifier = attackerFormation.attack * formationCounter;
    }

    // 지형 보정
    let terrainModifier = 1.0;
    if (this.config.terrainEnabled) {
      terrainModifier = getTerrainAttackModifier(terrain);
    }

    // 특수 능력 보정
    const specialModifier = applySpecialAbilities(attacker, defender);

    // 방어력 계산
    let defenseValue = defender.defense;
    
    // 방어 버프 적용
    const defenseBuff = defender.buffs.find(b => b.type === 'defense');
    if (defenseBuff) {
      defenseValue *= (1 + defenseBuff.value / 100);
    }

    // 진형 방어 보정
    if (this.config.formationEnabled) {
      const defenderFormation = getFormationStats(defender.formation);
      defenseValue *= defenderFormation.defense;
    }

    // 지형 방어 보정
    if (this.config.terrainEnabled) {
      defenseValue *= getTerrainDefenseModifier(terrain);
    }

    // 기본 피해량
    const baseDamage = attackPower * troopModifier * compatibilityModifier * 
                       formationModifier * terrainModifier * specialModifier;

    // 방어력 적용
    const defenseReduction = defenseValue * 0.5;
    let finalDamage = Math.max(1, Math.floor(baseDamage - defenseReduction));

    // 치명타 체크
    let isCritical = false;
    if (Math.random() * 100 < this.config.criticalChance) {
      isCritical = true;
      finalDamage = Math.floor(finalDamage * 1.5);
    }

    // 회피 체크
    let isEvaded = false;
    if (Math.random() * 100 < this.config.evasionChance) {
      isEvaded = true;
      finalDamage = Math.floor(finalDamage * 0.3);
    }

    // 사상자 계산
    const casualties = Math.floor(finalDamage / 10);

    // 설명 생성
    const compatInfo = getCompatibilityInfo(attacker.crewTypeId, defender.crewTypeId);
    let description = `피해: ${finalDamage}`;
    if (compatInfo.isAdvantage) {
      description += ` (${compatInfo.description})`;
    } else if (compatInfo.isDisadvantage) {
      description += ` (${compatInfo.description})`;
    }
    if (isCritical) description += ' [치명타!]';
    if (isEvaded) description += ' [회피]';

    return {
      baseDamage: Math.floor(baseDamage),
      attackPower,
      troopModifier,
      compatibilityModifier,
      formationModifier,
      terrainModifier,
      defenseReduction,
      finalDamage,
      casualties,
      isCritical,
      isEvaded,
      description,
    };
  }

  // ==========================================================================
  // 유효성 검사
  // ==========================================================================

  /**
   * 이동 가능 여부 확인
   */
  canMoveTo(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit,
    target: GridPosition
  ): { valid: boolean; reason?: string } {
    // 범위 체크
    if (target.x < 0 || target.x >= GRID_SIZE || target.y < 0 || target.y >= GRID_SIZE) {
      return { valid: false, reason: '맵 범위를 벗어났습니다.' };
    }

    // 거리 체크
    const distance = this.getDistance(unit.position, target);
    if (distance > unit.moveRange) {
      return { valid: false, reason: '이동 범위를 벗어났습니다.' };
    }

    // 타일 확인
    const tile = state.map[target.y][target.x];
    
    // 점유 확인
    if (tile.occupiedBy) {
      return { valid: false, reason: '이미 점유된 위치입니다.' };
    }

    // 지형 통과 가능 확인
    if (!canPassTerrain(unit, tile.terrain)) {
      return { valid: false, reason: '통과할 수 없는 지형입니다.' };
    }

    return { valid: true };
  }

  /**
   * 공격 가능 여부 확인
   */
  canAttack(
    state: TurnBasedBattleState,
    attacker: TurnBasedUnit,
    defender: TurnBasedUnit
  ): { valid: boolean; reason?: string } {
    // 같은 진영 체크
    if (attacker.side === defender.side) {
      return { valid: false, reason: '아군을 공격할 수 없습니다.' };
    }

    // 사거리 체크
    const distance = this.getDistance(attacker.position, defender.position);
    if (distance > attacker.attackRange) {
      return { valid: false, reason: '공격 사거리를 벗어났습니다.' };
    }

    // 패주 중인 유닛 체크
    if (defender.isRouting) {
      return { valid: false, reason: '패주 중인 적입니다.' };
    }

    return { valid: true };
  }

  /**
   * 반격 가능 여부 확인
   */
  private canCounterAttack(
    state: TurnBasedBattleState,
    defender: TurnBasedUnit,
    attacker: TurnBasedUnit
  ): boolean {
    // 패주 중이면 반격 불가
    if (defender.isRouting) return false;

    // 사거리 내에 있어야 반격 가능
    const distance = this.getDistance(defender.position, attacker.position);
    return distance <= defender.attackRange;
  }

  /**
   * 승리 조건 체크
   */
  checkVictoryCondition(state: TurnBasedBattleState): VictoryCondition | null {
    // 생존 유닛 집계
    const attackerUnits = Array.from(state.units.values())
      .filter(u => u.side === 'attacker' && u.troops > 0 && !u.isRouting);
    const defenderUnits = Array.from(state.units.values())
      .filter(u => u.side === 'defender' && u.troops > 0 && !u.isRouting);

    // 공격자 전멸
    if (attackerUnits.length === 0) {
      return {
        type: 'elimination',
        winner: 'defender',
        reason: '공격군 전멸',
      };
    }

    // 방어자 전멸
    if (defenderUnits.length === 0) {
      return {
        type: 'elimination',
        winner: 'attacker',
        reason: '방어군 전멸',
      };
    }

    // 턴 제한 도달
    if (state.currentTurn >= state.maxTurns) {
      // 남은 병력 비교
      const attackerTroops = attackerUnits.reduce((sum, u) => sum + u.troops, 0);
      const defenderTroops = defenderUnits.reduce((sum, u) => sum + u.troops, 0);

      if (attackerTroops > defenderTroops * 1.5) {
        return {
          type: 'time_limit',
          winner: 'attacker',
          reason: '턴 제한 종료 (병력 우세)',
        };
      } else if (defenderTroops > attackerTroops * 1.5) {
        return {
          type: 'time_limit',
          winner: 'defender',
          reason: '턴 제한 종료 (병력 우세)',
        };
      } else {
        return {
          type: 'time_limit',
          winner: 'defender',
          reason: '턴 제한 종료 (방어 성공)',
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // 유틸리티
  // ==========================================================================

  /**
   * 두 위치 간 거리 계산 (맨해튼 거리)
   */
  private getDistance(from: GridPosition, to: GridPosition): number {
    return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  }

  /**
   * 이동 가능한 위치 목록 조회
   */
  getMovablePositions(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit
  ): GridPosition[] {
    const positions: GridPosition[] = [];
    const range = unit.moveRange;

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > range) continue;
        
        const target: GridPosition = {
          x: unit.position.x + dx,
          y: unit.position.y + dy,
        };

        const canMove = this.canMoveTo(state, unit, target);
        if (canMove.valid) {
          positions.push(target);
        }
      }
    }

    return positions;
  }

  /**
   * 공격 가능한 대상 목록 조회
   */
  getAttackableTargets(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit
  ): TurnBasedUnit[] {
    const targets: TurnBasedUnit[] = [];

    for (const target of state.units.values()) {
      const canAttackResult = this.canAttack(state, unit, target);
      if (canAttackResult.valid) {
        targets.push(target);
      }
    }

    return targets;
  }

  /**
   * 로그 추가
   */
  private addLog(
    state: TurnBasedBattleState,
    phase: TurnPhase,
    message: string,
    details?: Record<string, unknown>
  ): void {
    state.battleLog.push({
      turn: state.currentTurn,
      phase,
      timestamp: new Date(),
      message,
      details,
    });
  }

  /**
   * 병종 기본 속도
   */
  private getBaseSpeed(category: UnitCategory): number {
    const speeds: Record<UnitCategory, number> = {
      infantry: 6,
      cavalry: 10,
      archer: 7,
      wizard: 5,
      siege: 4,
      navy: 8,
    };
    return speeds[category] ?? 6;
  }

  /**
   * 병종 기본 공격 사거리
   */
  private getBaseAttackRange(category: UnitCategory, crewTypeId: number): number {
    // 궁병은 사거리가 길다
    if (category === 'archer') {
      return 5;
    }
    // 공성은 더 길다
    if (category === 'siege') {
      return 7;
    }
    // 기병/보병은 근접
    return 1;
  }

  /**
   * 병종 이름 조회
   */
  private getCrewTypeName(crewTypeId: number): string {
    // 실제로는 units.json에서 조회
    const names: Record<number, string> = {
      1100: '도민병',
      1101: '창민병',
      1102: '정규보병',
      1200: '단궁병',
      1201: '장궁병',
      1202: '노병',
      1300: '경기병',
      1301: '중기병',
      1302: '창기병',
    };
    return names[crewTypeId] ?? `병종#${crewTypeId}`;
  }

  // ==========================================================================
  // 전체 전투 시뮬레이션 (자동 전투용)
  // ==========================================================================

  /**
   * 자동 전투 시뮬레이션
   */
  simulateBattle(state: TurnBasedBattleState): TurnBasedBattleState {
    while (!state.isFinished) {
      // 턴 시작
      const turnResult = this.startNextTurn(state);
      
      // 각 유닛 행동
      let currentUnit = this.getCurrentUnit(state);
      while (currentUnit) {
        // AI 액션 결정
        const action = this.decideAIAction(state, currentUnit);
        
        // 액션 실행
        const result = this.executeAction(state, action);
        turnResult.actions.push(result);
        
        // 다음 유닛
        currentUnit = this.nextUnit(state);
      }
      
      // 턴 종료
      this.endTurn(state, turnResult);
      
      // 최대 턴 제한
      if (state.currentTurn >= state.maxTurns) {
        break;
      }
    }
    
    return state;
  }

  /**
   * AI 액션 결정
   */
  private decideAIAction(
    state: TurnBasedBattleState,
    unit: TurnBasedUnit
  ): BattleAction {
    // 공격 가능한 대상 찾기
    const targets = this.getAttackableTargets(state, unit);
    
    if (targets.length > 0) {
      // 가장 약한 적 공격
      const weakestTarget = targets.reduce((a, b) => 
        a.troops < b.troops ? a : b
      );
      
      return {
        unitId: unit.id,
        type: 'attack',
        targetUnitId: weakestTarget.id,
      };
    }
    
    // 이동 가능한 위치 중 적에게 가까운 곳으로
    const movable = this.getMovablePositions(state, unit);
    if (movable.length > 0 && !unit.hasMoved) {
      // 가장 가까운 적 찾기
      const enemies = Array.from(state.units.values())
        .filter(u => u.side !== unit.side && u.troops > 0 && !u.isRouting);
      
      if (enemies.length > 0) {
        const closestEnemy = enemies.reduce((a, b) =>
          this.getDistance(unit.position, a.position) < this.getDistance(unit.position, b.position) ? a : b
        );
        
        // 적에게 가장 가까운 이동 가능 위치
        const bestMove = movable.reduce((a, b) =>
          this.getDistance(a, closestEnemy.position) < this.getDistance(b, closestEnemy.position) ? a : b
        );
        
        return {
          unitId: unit.id,
          type: 'move',
          targetPosition: bestMove,
        };
      }
    }
    
    // 대기
    return {
      unitId: unit.id,
      type: 'wait',
    };
  }
}

// 싱글톤 인스턴스
export const turnBasedBattleService = new TurnBasedBattleService();




