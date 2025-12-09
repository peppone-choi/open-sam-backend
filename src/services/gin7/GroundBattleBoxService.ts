/**
 * GroundBattleBoxService - 지상전 전투 박스 관리 서비스
 * 
 * 그리드 기반 전술 지상전, 턴 처리, 유닛 이동/공격, 목표 점령을 담당합니다.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  IGroundUnit,
  GroundUnitType,
  GROUND_UNIT_SPECS,
} from '../../models/gin7/GroundBattle';
import { logger } from '../../common/logger';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 지형 타입
 */
export type BoxTerrainType = 
  | 'OPEN'              // 개활지 - 이동 쉬움, 엄폐 없음
  | 'FOREST'            // 숲 - 보통 이동, 보통 엄폐
  | 'URBAN'             // 도시 - 느린 이동, 높은 엄폐
  | 'MOUNTAIN'          // 산악 - 매우 느린 이동, 높은 엄폐
  | 'WATER'             // 수역 - 특수 유닛만 통과
  | 'FORTIFICATION';    // 요새 - 매우 느린 이동, 최고 엄폐

/**
 * 지형 셀
 */
export interface TerrainCell {
  cellId: string;
  x: number;
  y: number;
  
  // 지형 정보
  terrainType: BoxTerrainType;
  elevation: number;        // 고도 (0-100)
  
  // 수치
  coverValue: number;       // 엄폐도 (0-100)
  movementCost: number;     // 이동 비용 (1-4)
  visibilityRange: number;  // 시야 범위 수정자
  
  // 상태
  isPassable: boolean;
  isObjective: boolean;     // 점령 목표 여부
  controllingFaction?: string;
  
  // 효과
  effects: BoxTerrainEffect[];
  
  // 유닛
  occupyingUnitIds: string[];
  maxOccupancy: number;
}

/**
 * 지형 효과
 */
export interface BoxTerrainEffect {
  effectType: 'DAMAGE_REDUCTION' | 'ACCURACY_PENALTY' | 'MORALE_BONUS' | 'SUPPLY_DRAIN';
  value: number;
  affectedSide: 'ATTACKER' | 'DEFENDER' | 'BOTH';
}

/**
 * 전투 박스
 */
export interface BattleBox {
  boxId: string;
  sessionId: string;
  planetId: string;
  
  // 그리드
  width: number;
  height: number;
  grid: TerrainCell[][];
  
  // 참여 진영
  attackerFactionId: string;
  defenderFactionId: string;
  
  // 유닛 목록
  attackerUnits: BoxUnit[];
  defenderUnits: BoxUnit[];
  
  // 목표
  objectives: Objective[];
  
  // 턴 관리
  currentTurn: number;
  maxTurns: number;
  currentPhase: TurnPhase;
  activePlayer: 'ATTACKER' | 'DEFENDER';
  
  // 상태
  status: BattleBoxStatus;
  result?: BattleBoxResult;
  
  // 통계
  statistics: BattleStatistics;
  
  // 타이밍
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

/**
 * 전투 박스 유닛
 */
export interface BoxUnit {
  unitId: string;
  baseUnit: IGroundUnit;
  
  // 위치
  position: { x: number; y: number };
  facing: Direction;
  
  // 상태
  hasActed: boolean;
  hasMoved: boolean;
  hasAttacked: boolean;
  
  // 수정자
  coverBonus: number;
  elevationBonus: number;
  
  // 특수 상태
  isSupplied: boolean;
  isEntrenched: boolean;
  isSuppressed: boolean;
  isRouted: boolean;
  
  // 행동 포인트
  actionPoints: number;
  maxActionPoints: number;
}

/**
 * 방향
 */
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * 목표 지점
 */
export interface Objective {
  objectiveId: string;
  name: string;
  position: { x: number; y: number };
  
  // 점수
  capturePoints: number;
  victoryPoints: number;
  
  // 상태
  controllingFaction?: string;
  captureProgress: number;     // 0-100
  contestedBy?: string;
  
  // 요구 사항
  requiredUnitsToCapture: number;
  captureRate: number;         // 턴당 점령 진행도
}

/**
 * 턴 단계
 */
export type TurnPhase = 
  | 'INITIATIVE'          // 선공 결정
  | 'MOVEMENT'            // 이동 단계
  | 'COMBAT'              // 전투 단계
  | 'MORALE'              // 사기 단계
  | 'SUPPLY'              // 보급 단계
  | 'CAPTURE'             // 점령 단계
  | 'END';                // 턴 종료

/**
 * 전투 박스 상태
 */
export type BattleBoxStatus = 
  | 'SETUP'               // 배치 단계
  | 'IN_PROGRESS'         // 진행 중
  | 'PAUSED'              // 일시 정지
  | 'COMPLETED';          // 완료

/**
 * 전투 결과
 */
export type BattleBoxResult = 
  | 'ATTACKER_VICTORY'    // 공격측 승리
  | 'DEFENDER_VICTORY'    // 방어측 승리
  | 'DRAW'                // 무승부
  | 'TIME_LIMIT';         // 턴 제한 종료

/**
 * 전투 통계
 */
export interface BattleStatistics {
  turnsElapsed: number;
  
  attackerStats: {
    unitsLost: number;
    casualtiesInflicted: number;
    objectivesCaptured: number;
    totalDamageDealt: number;
  };
  
  defenderStats: {
    unitsLost: number;
    casualtiesInflicted: number;
    objectivesHeld: number;
    totalDamageDealt: number;
  };
}

/**
 * 이동 결과
 */
export interface MoveResult {
  success: boolean;
  unitId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  actionPointsUsed: number;
  message: string;
  triggeredEffects: string[];
}

/**
 * 공격 결과
 */
export interface AttackResult {
  success: boolean;
  attackerId: string;
  targetId: string;
  
  // 데미지
  damageDealt: number;
  casualtiesCaused: number;
  
  // 수정자
  accuracyRoll: number;
  coverModifier: number;
  elevationModifier: number;
  flanking: boolean;
  
  // 결과
  targetDestroyed: boolean;
  targetRouted: boolean;
  
  combatLog: string[];
}

/**
 * 점령 결과
 */
export interface CaptureResult {
  success: boolean;
  objectiveId: string;
  previousOwner?: string;
  newOwner?: string;
  
  progressMade: number;
  totalProgress: number;
  isContested: boolean;
  
  message: string;
}

// ============================================================
// Constants
// ============================================================

const GROUND_BATTLE_BOX_CONSTANTS = {
  // 기본 설정
  DEFAULT_GRID_WIDTH: 20,
  DEFAULT_GRID_HEIGHT: 15,
  DEFAULT_MAX_TURNS: 30,
  DEFAULT_ACTION_POINTS: 3,
  
  // 이동 비용
  MOVEMENT_COST: {
    OPEN: 1,
    FOREST: 2,
    URBAN: 2,
    MOUNTAIN: 3,
    WATER: 4,
    FORTIFICATION: 2,
  } as Record<BoxTerrainType, number>,
  
  // 엄폐도
  COVER_VALUE: {
    OPEN: 0,
    FOREST: 40,
    URBAN: 60,
    MOUNTAIN: 50,
    WATER: 0,
    FORTIFICATION: 80,
  } as Record<BoxTerrainType, number>,
  
  // 최대 수용
  MAX_OCCUPANCY: {
    OPEN: 5,
    FOREST: 3,
    URBAN: 4,
    MOUNTAIN: 2,
    WATER: 1,
    FORTIFICATION: 6,
  } as Record<BoxTerrainType, number>,
  
  // 전투 수정자
  FLANKING_BONUS: 1.5,
  HIGH_GROUND_BONUS: 1.2,
  ENTRENCHMENT_BONUS: 1.3,
  SUPPRESSION_PENALTY: 0.5,
  
  // 점령
  BASE_CAPTURE_RATE: 10,
  CONTESTED_CAPTURE_RATE: 5,
  
  // 승리 조건
  OBJECTIVE_VICTORY_THRESHOLD: 0.6,   // 목표 60% 점령 시 승리
  ANNIHILATION_THRESHOLD: 0.1,        // 적 10% 미만 시 섬멸 승리
};

/**
 * 지형별 기본 효과
 */
const TERRAIN_EFFECTS: Record<BoxTerrainType, BoxTerrainEffect[]> = {
  OPEN: [],
  FOREST: [
    { effectType: 'ACCURACY_PENALTY', value: 10, affectedSide: 'ATTACKER' },
    { effectType: 'DAMAGE_REDUCTION', value: 15, affectedSide: 'DEFENDER' },
  ],
  URBAN: [
    { effectType: 'ACCURACY_PENALTY', value: 15, affectedSide: 'ATTACKER' },
    { effectType: 'DAMAGE_REDUCTION', value: 25, affectedSide: 'DEFENDER' },
    { effectType: 'MORALE_BONUS', value: 10, affectedSide: 'DEFENDER' },
  ],
  MOUNTAIN: [
    { effectType: 'ACCURACY_PENALTY', value: 20, affectedSide: 'ATTACKER' },
    { effectType: 'DAMAGE_REDUCTION', value: 20, affectedSide: 'DEFENDER' },
    { effectType: 'SUPPLY_DRAIN', value: 5, affectedSide: 'BOTH' },
  ],
  WATER: [
    { effectType: 'ACCURACY_PENALTY', value: 30, affectedSide: 'BOTH' },
    { effectType: 'SUPPLY_DRAIN', value: 10, affectedSide: 'BOTH' },
  ],
  FORTIFICATION: [
    { effectType: 'DAMAGE_REDUCTION', value: 40, affectedSide: 'DEFENDER' },
    { effectType: 'MORALE_BONUS', value: 20, affectedSide: 'DEFENDER' },
  ],
};

// ============================================================
// GroundBattleBoxService Class
// ============================================================

export class GroundBattleBoxService extends EventEmitter {
  private static instance: GroundBattleBoxService;
  private activeBattles: Map<string, BattleBox> = new Map();
  
  private constructor() {
    super();
    logger.info('[GroundBattleBoxService] Initialized');
  }
  
  public static getInstance(): GroundBattleBoxService {
    if (!GroundBattleBoxService.instance) {
      GroundBattleBoxService.instance = new GroundBattleBoxService();
    }
    return GroundBattleBoxService.instance;
  }
  
  // ============================================================
  // Battle Creation
  // ============================================================
  
  /**
   * 전투 생성
   */
  createBattle(params: {
    sessionId: string;
    planetId: string;
    attackerFactionId: string;
    defenderFactionId: string;
    width?: number;
    height?: number;
    maxTurns?: number;
    terrainPreset?: 'DEFAULT' | 'URBAN' | 'MOUNTAIN' | 'COASTAL' | 'FORTRESS';
  }): BattleBox {
    const {
      sessionId,
      planetId,
      attackerFactionId,
      defenderFactionId,
      width = GROUND_BATTLE_BOX_CONSTANTS.DEFAULT_GRID_WIDTH,
      height = GROUND_BATTLE_BOX_CONSTANTS.DEFAULT_GRID_HEIGHT,
      maxTurns = GROUND_BATTLE_BOX_CONSTANTS.DEFAULT_MAX_TURNS,
      terrainPreset = 'DEFAULT',
    } = params;
    
    // 그리드 생성
    const grid = this.generateGrid(width, height, terrainPreset);
    
    // 목표 지점 생성
    const objectives = this.generateObjectives(grid, width, height);
    
    const boxId = `BBOX-${uuidv4().slice(0, 8)}`;
    const battle: BattleBox = {
      boxId,
      sessionId,
      planetId,
      
      width,
      height,
      grid,
      
      attackerFactionId,
      defenderFactionId,
      
      attackerUnits: [],
      defenderUnits: [],
      
      objectives,
      
      currentTurn: 0,
      maxTurns,
      currentPhase: 'INITIATIVE',
      activePlayer: 'ATTACKER',
      
      status: 'SETUP',
      
      statistics: {
        turnsElapsed: 0,
        attackerStats: {
          unitsLost: 0,
          casualtiesInflicted: 0,
          objectivesCaptured: 0,
          totalDamageDealt: 0,
        },
        defenderStats: {
          unitsLost: 0,
          casualtiesInflicted: 0,
          objectivesHeld: objectives.length,
          totalDamageDealt: 0,
        },
      },
      
      createdAt: new Date(),
    };
    
    this.activeBattles.set(boxId, battle);
    
    logger.info('[GroundBattleBoxService] Battle created', {
      boxId,
      planetId,
      gridSize: `${width}x${height}`,
      objectives: objectives.length,
    });
    
    this.emit('battle:created', {
      boxId,
      sessionId,
      planetId,
    });
    
    return battle;
  }
  
  /**
   * 그리드 생성
   */
  private generateGrid(
    width: number,
    height: number,
    preset: 'DEFAULT' | 'URBAN' | 'MOUNTAIN' | 'COASTAL' | 'FORTRESS'
  ): TerrainCell[][] {
    const grid: TerrainCell[][] = [];
    
    for (let y = 0; y < height; y++) {
      const row: TerrainCell[] = [];
      for (let x = 0; x < width; x++) {
        const terrainType = this.getTerrainForPreset(x, y, width, height, preset);
        
        const cell: TerrainCell = {
          cellId: `CELL-${x}-${y}`,
          x,
          y,
          
          terrainType,
          elevation: this.calculateElevation(x, y, width, height, preset),
          
          coverValue: GROUND_BATTLE_BOX_CONSTANTS.COVER_VALUE[terrainType],
          movementCost: GROUND_BATTLE_BOX_CONSTANTS.MOVEMENT_COST[terrainType],
          visibilityRange: terrainType === 'FOREST' || terrainType === 'URBAN' ? 3 : 5,
          
          isPassable: terrainType !== 'WATER' || preset === 'COASTAL',
          isObjective: false,
          
          effects: TERRAIN_EFFECTS[terrainType],
          
          occupyingUnitIds: [],
          maxOccupancy: GROUND_BATTLE_BOX_CONSTANTS.MAX_OCCUPANCY[terrainType],
        };
        
        row.push(cell);
      }
      grid.push(row);
    }
    
    return grid;
  }
  
  /**
   * 프리셋에 따른 지형 결정
   */
  private getTerrainForPreset(
    x: number,
    y: number,
    width: number,
    height: number,
    preset: string
  ): BoxTerrainType {
    const rand = Math.random();
    
    switch (preset) {
      case 'URBAN':
        if (rand < 0.5) return 'URBAN';
        if (rand < 0.7) return 'OPEN';
        return 'FORTIFICATION';
        
      case 'MOUNTAIN':
        if (rand < 0.4) return 'MOUNTAIN';
        if (rand < 0.7) return 'FOREST';
        return 'OPEN';
        
      case 'COASTAL':
        if (x < width * 0.3) return 'WATER';
        if (rand < 0.3) return 'OPEN';
        if (rand < 0.5) return 'FOREST';
        return 'URBAN';
        
      case 'FORTRESS':
        if (y > height * 0.7 && rand < 0.6) return 'FORTIFICATION';
        if (rand < 0.4) return 'URBAN';
        return 'OPEN';
        
      default: // DEFAULT
        if (rand < 0.5) return 'OPEN';
        if (rand < 0.7) return 'FOREST';
        if (rand < 0.85) return 'URBAN';
        return 'MOUNTAIN';
    }
  }
  
  /**
   * 고도 계산
   */
  private calculateElevation(
    x: number,
    y: number,
    width: number,
    height: number,
    preset: string
  ): number {
    if (preset === 'MOUNTAIN') {
      // 중앙으로 갈수록 높음
      const centerX = width / 2;
      const centerY = height / 2;
      const distFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
      return Math.floor(80 * (1 - distFromCenter / maxDist) + Math.random() * 20);
    }
    
    if (preset === 'COASTAL') {
      // 해안에서 멀수록 높음
      return Math.min(100, Math.floor(x / width * 60 + Math.random() * 20));
    }
    
    // 기본: 랜덤
    return Math.floor(Math.random() * 30);
  }
  
  /**
   * 목표 지점 생성
   */
  private generateObjectives(
    grid: TerrainCell[][],
    width: number,
    height: number
  ): Objective[] {
    const objectives: Objective[] = [];
    
    // 중앙 목표
    const centerObj: Objective = {
      objectiveId: `OBJ-CENTER`,
      name: '중앙 거점',
      position: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
      capturePoints: 100,
      victoryPoints: 30,
      captureProgress: 0,
      requiredUnitsToCapture: 3,
      captureRate: GROUND_BATTLE_BOX_CONSTANTS.BASE_CAPTURE_RATE,
    };
    objectives.push(centerObj);
    
    // 방어측 거점 (상단)
    const defenderObj: Objective = {
      objectiveId: `OBJ-DEFENDER`,
      name: '방어 거점',
      position: { x: Math.floor(width / 2), y: Math.floor(height * 0.8) },
      capturePoints: 80,
      victoryPoints: 40,
      controllingFaction: 'defender', // 초기 방어측 소유
      captureProgress: 100,
      requiredUnitsToCapture: 2,
      captureRate: GROUND_BATTLE_BOX_CONSTANTS.BASE_CAPTURE_RATE,
    };
    objectives.push(defenderObj);
    
    // 측면 목표들
    const leftObj: Objective = {
      objectiveId: `OBJ-LEFT`,
      name: '좌측 고지',
      position: { x: Math.floor(width * 0.2), y: Math.floor(height * 0.5) },
      capturePoints: 60,
      victoryPoints: 15,
      captureProgress: 0,
      requiredUnitsToCapture: 2,
      captureRate: GROUND_BATTLE_BOX_CONSTANTS.BASE_CAPTURE_RATE,
    };
    objectives.push(leftObj);
    
    const rightObj: Objective = {
      objectiveId: `OBJ-RIGHT`,
      name: '우측 고지',
      position: { x: Math.floor(width * 0.8), y: Math.floor(height * 0.5) },
      capturePoints: 60,
      victoryPoints: 15,
      captureProgress: 0,
      requiredUnitsToCapture: 2,
      captureRate: GROUND_BATTLE_BOX_CONSTANTS.BASE_CAPTURE_RATE,
    };
    objectives.push(rightObj);
    
    // 목표 지점 셀 마킹
    for (const obj of objectives) {
      if (grid[obj.position.y] && grid[obj.position.y][obj.position.x]) {
        grid[obj.position.y][obj.position.x].isObjective = true;
        grid[obj.position.y][obj.position.x].controllingFaction = obj.controllingFaction;
      }
    }
    
    return objectives;
  }
  
  // ============================================================
  // Unit Placement
  // ============================================================
  
  /**
   * 유닛 배치
   */
  placeUnit(
    boxId: string,
    groundUnit: IGroundUnit,
    position: { x: number; y: number },
    side: 'ATTACKER' | 'DEFENDER'
  ): BoxUnit | null {
    const battle = this.activeBattles.get(boxId);
    if (!battle) {
      throw new Error(`Battle not found: ${boxId}`);
    }
    
    if (battle.status !== 'SETUP') {
      throw new Error('Cannot place units after battle has started');
    }
    
    const cell = battle.grid[position.y]?.[position.x];
    if (!cell) {
      throw new Error(`Invalid position: ${position.x}, ${position.y}`);
    }
    
    if (!cell.isPassable) {
      throw new Error('Cannot place unit on impassable terrain');
    }
    
    if (cell.occupyingUnitIds.length >= cell.maxOccupancy) {
      throw new Error('Cell is at max occupancy');
    }
    
    // 배치 구역 검증 (공격측: 하단, 방어측: 상단)
    const validZone = side === 'ATTACKER' 
      ? position.y < battle.height * 0.3
      : position.y > battle.height * 0.7;
    
    if (!validZone) {
      throw new Error(`Invalid placement zone for ${side}`);
    }
    
    const boxUnit: BoxUnit = {
      unitId: groundUnit.unitId,
      baseUnit: groundUnit,
      
      position,
      facing: side === 'ATTACKER' ? 'N' : 'S',
      
      hasActed: false,
      hasMoved: false,
      hasAttacked: false,
      
      coverBonus: cell.coverValue,
      elevationBonus: cell.elevation > 50 ? 10 : 0,
      
      isSupplied: true,
      isEntrenched: false,
      isSuppressed: false,
      isRouted: false,
      
      actionPoints: GROUND_BATTLE_BOX_CONSTANTS.DEFAULT_ACTION_POINTS,
      maxActionPoints: GROUND_BATTLE_BOX_CONSTANTS.DEFAULT_ACTION_POINTS,
    };
    
    // 유닛 목록에 추가
    if (side === 'ATTACKER') {
      battle.attackerUnits.push(boxUnit);
    } else {
      battle.defenderUnits.push(boxUnit);
    }
    
    // 셀에 유닛 ID 추가
    cell.occupyingUnitIds.push(groundUnit.unitId);
    
    logger.info('[GroundBattleBoxService] Unit placed', {
      boxId,
      unitId: groundUnit.unitId,
      position,
      side,
    });
    
    return boxUnit;
  }
  
  // ============================================================
  // Turn Resolution
  // ============================================================
  
  /**
   * 전투 시작
   */
  startBattle(boxId: string): BattleBox {
    const battle = this.activeBattles.get(boxId);
    if (!battle) {
      throw new Error(`Battle not found: ${boxId}`);
    }
    
    if (battle.status !== 'SETUP') {
      throw new Error('Battle has already started');
    }
    
    if (battle.attackerUnits.length === 0 || battle.defenderUnits.length === 0) {
      throw new Error('Both sides must have units');
    }
    
    battle.status = 'IN_PROGRESS';
    battle.currentTurn = 1;
    battle.currentPhase = 'INITIATIVE';
    battle.startedAt = new Date();
    
    // 선공 결정
    battle.activePlayer = Math.random() < 0.5 ? 'ATTACKER' : 'DEFENDER';
    
    logger.info('[GroundBattleBoxService] Battle started', {
      boxId,
      firstPlayer: battle.activePlayer,
    });
    
    this.emit('battle:started', {
      boxId,
      sessionId: battle.sessionId,
      firstPlayer: battle.activePlayer,
    });
    
    return battle;
  }
  
  /**
   * 턴 처리 (resolveTurn)
   */
  resolveTurn(boxId: string): BattleBox {
    const battle = this.activeBattles.get(boxId);
    if (!battle) {
      throw new Error(`Battle not found: ${boxId}`);
    }
    
    if (battle.status !== 'IN_PROGRESS') {
      throw new Error('Battle is not in progress');
    }
    
    // 단계별 처리
    const phases: TurnPhase[] = ['INITIATIVE', 'MOVEMENT', 'COMBAT', 'MORALE', 'SUPPLY', 'CAPTURE', 'END'];
    
    for (const phase of phases) {
      battle.currentPhase = phase;
      
      switch (phase) {
        case 'INITIATIVE':
          this.resolveInitiative(battle);
          break;
        case 'MOVEMENT':
          // 플레이어 행동 대기 (수동 이동)
          break;
        case 'COMBAT':
          // 플레이어 행동 대기 (수동 공격)
          break;
        case 'MORALE':
          this.resolveMorale(battle);
          break;
        case 'SUPPLY':
          this.resolveSupply(battle);
          break;
        case 'CAPTURE':
          this.resolveCapture(battle);
          break;
        case 'END':
          this.resolveEndPhase(battle);
          break;
      }
    }
    
    // 승리 조건 확인
    const victoryCheck = this.checkVictoryConditions(battle);
    if (victoryCheck.ended) {
      this.endBattle(battle, victoryCheck.result!);
    } else {
      // 턴 종료 후 다음 턴 준비
      battle.currentTurn++;
      battle.statistics.turnsElapsed++;
      
      // 턴 제한 확인
      if (battle.currentTurn > battle.maxTurns) {
        this.endBattle(battle, 'TIME_LIMIT');
      } else {
        // 모든 유닛 행동 리셋
        this.resetUnitActions(battle);
        
        // 플레이어 교대
        battle.activePlayer = battle.activePlayer === 'ATTACKER' ? 'DEFENDER' : 'ATTACKER';
        battle.currentPhase = 'INITIATIVE';
      }
    }
    
    logger.info('[GroundBattleBoxService] Turn resolved', {
      boxId,
      turn: battle.currentTurn,
      status: battle.status,
    });
    
    this.emit('turn:resolved', {
      boxId,
      turn: battle.currentTurn,
      activePlayer: battle.activePlayer,
    });
    
    return battle;
  }
  
  /**
   * 선공 결정
   */
  private resolveInitiative(battle: BattleBox): void {
    // 간단한 선공 결정 (실제로는 지휘관 능력치 등 반영)
    // 현재는 턴마다 교대
  }
  
  /**
   * 사기 단계 처리
   */
  private resolveMorale(battle: BattleBox): void {
    for (const unit of [...battle.attackerUnits, ...battle.defenderUnits]) {
      if (unit.baseUnit.isDestroyed) continue;
      
      // 사기 회복 (억압되지 않은 경우)
      if (!unit.isSuppressed) {
        unit.baseUnit.stats.morale = Math.min(100, unit.baseUnit.stats.morale + 3);
      }
      
      // 패주 확인
      if (unit.baseUnit.stats.morale <= 10) {
        unit.isRouted = true;
      }
      
      // 패주 유닛 회복 확인
      if (unit.isRouted && unit.baseUnit.stats.morale >= 30) {
        unit.isRouted = false;
      }
    }
  }
  
  /**
   * 보급 단계 처리
   */
  private resolveSupply(battle: BattleBox): void {
    for (const unit of [...battle.attackerUnits, ...battle.defenderUnits]) {
      if (unit.baseUnit.isDestroyed) continue;
      
      const cell = battle.grid[unit.position.y]?.[unit.position.x];
      if (!cell) continue;
      
      // 보급 드레인 효과 적용
      for (const effect of cell.effects) {
        if (effect.effectType === 'SUPPLY_DRAIN') {
          unit.isSupplied = false;
        }
      }
    }
  }
  
  /**
   * 점령 단계 처리
   */
  private resolveCapture(battle: BattleBox): void {
    for (const objective of battle.objectives) {
      const cell = battle.grid[objective.position.y]?.[objective.position.x];
      if (!cell) continue;
      
      // 목표 지점의 유닛 수 계산
      let attackerUnits = 0;
      let defenderUnits = 0;
      
      for (const unitId of cell.occupyingUnitIds) {
        if (battle.attackerUnits.find(u => u.unitId === unitId)) {
          attackerUnits++;
        }
        if (battle.defenderUnits.find(u => u.unitId === unitId)) {
          defenderUnits++;
        }
      }
      
      // 점령 진행
      if (attackerUnits >= objective.requiredUnitsToCapture && defenderUnits === 0) {
        // 공격측 점령 진행
        if (objective.controllingFaction !== battle.attackerFactionId) {
          objective.captureProgress -= objective.captureRate;
          
          if (objective.captureProgress <= 0) {
            objective.captureProgress = 0;
            objective.controllingFaction = battle.attackerFactionId;
            cell.controllingFaction = battle.attackerFactionId;
            battle.statistics.attackerStats.objectivesCaptured++;
            battle.statistics.defenderStats.objectivesHeld--;
            
            this.emit('objective:captured', {
              boxId: battle.boxId,
              objectiveId: objective.objectiveId,
              newOwner: battle.attackerFactionId,
            });
          }
        } else {
          // 이미 소유 중 - 강화
          objective.captureProgress = Math.min(100, objective.captureProgress + objective.captureRate);
        }
      } else if (defenderUnits >= objective.requiredUnitsToCapture && attackerUnits === 0) {
        // 방어측 점령/유지
        if (objective.controllingFaction !== battle.defenderFactionId) {
          objective.captureProgress -= objective.captureRate;
          
          if (objective.captureProgress <= 0) {
            objective.captureProgress = 0;
            objective.controllingFaction = battle.defenderFactionId;
            cell.controllingFaction = battle.defenderFactionId;
            battle.statistics.defenderStats.objectivesHeld++;
            battle.statistics.attackerStats.objectivesCaptured--;
          }
        } else {
          objective.captureProgress = Math.min(100, objective.captureProgress + objective.captureRate);
        }
      } else if (attackerUnits > 0 && defenderUnits > 0) {
        // 교전 중 - 점령 진행 없음
        objective.contestedBy = 'BOTH';
      }
    }
  }
  
  /**
   * 턴 종료 단계 처리
   */
  private resolveEndPhase(battle: BattleBox): void {
    // 파괴된 유닛 정리
    for (const unit of battle.attackerUnits) {
      if (unit.baseUnit.count <= 0 && !unit.baseUnit.isDestroyed) {
        unit.baseUnit.isDestroyed = true;
        this.removeUnitFromCell(battle, unit);
      }
    }
    
    for (const unit of battle.defenderUnits) {
      if (unit.baseUnit.count <= 0 && !unit.baseUnit.isDestroyed) {
        unit.baseUnit.isDestroyed = true;
        this.removeUnitFromCell(battle, unit);
      }
    }
  }
  
  /**
   * 유닛 행동 리셋
   */
  private resetUnitActions(battle: BattleBox): void {
    for (const unit of [...battle.attackerUnits, ...battle.defenderUnits]) {
      if (!unit.baseUnit.isDestroyed) {
        unit.hasActed = false;
        unit.hasMoved = false;
        unit.hasAttacked = false;
        unit.actionPoints = unit.maxActionPoints;
        unit.isSuppressed = false;
      }
    }
  }
  
  /**
   * 셀에서 유닛 제거
   */
  private removeUnitFromCell(battle: BattleBox, unit: BoxUnit): void {
    const cell = battle.grid[unit.position.y]?.[unit.position.x];
    if (cell) {
      cell.occupyingUnitIds = cell.occupyingUnitIds.filter(id => id !== unit.unitId);
    }
  }
  
  // ============================================================
  // Unit Movement
  // ============================================================
  
  /**
   * 유닛 이동
   */
  moveUnit(
    boxId: string,
    unitId: string,
    targetPosition: { x: number; y: number }
  ): MoveResult {
    const battle = this.activeBattles.get(boxId);
    if (!battle) {
      throw new Error(`Battle not found: ${boxId}`);
    }
    
    const unit = this.findUnit(battle, unitId);
    if (!unit) {
      throw new Error(`Unit not found: ${unitId}`);
    }
    
    if (unit.hasMoved) {
      return {
        success: false,
        unitId,
        from: unit.position,
        to: targetPosition,
        actionPointsUsed: 0,
        message: '이미 이동한 유닛입니다',
        triggeredEffects: [],
      };
    }
    
    if (unit.isRouted) {
      return {
        success: false,
        unitId,
        from: unit.position,
        to: targetPosition,
        actionPointsUsed: 0,
        message: '패주 중인 유닛은 이동할 수 없습니다',
        triggeredEffects: [],
      };
    }
    
    const targetCell = battle.grid[targetPosition.y]?.[targetPosition.x];
    if (!targetCell) {
      return {
        success: false,
        unitId,
        from: unit.position,
        to: targetPosition,
        actionPointsUsed: 0,
        message: '유효하지 않은 위치입니다',
        triggeredEffects: [],
      };
    }
    
    if (!targetCell.isPassable) {
      return {
        success: false,
        unitId,
        from: unit.position,
        to: targetPosition,
        actionPointsUsed: 0,
        message: '통과할 수 없는 지형입니다',
        triggeredEffects: [],
      };
    }
    
    if (targetCell.occupyingUnitIds.length >= targetCell.maxOccupancy) {
      return {
        success: false,
        unitId,
        from: unit.position,
        to: targetPosition,
        actionPointsUsed: 0,
        message: '대상 셀에 공간이 없습니다',
        triggeredEffects: [],
      };
    }
    
    // 이동 비용 계산
    const distance = Math.abs(targetPosition.x - unit.position.x) + 
                     Math.abs(targetPosition.y - unit.position.y);
    const movementCost = distance * targetCell.movementCost;
    
    if (unit.actionPoints < movementCost) {
      return {
        success: false,
        unitId,
        from: unit.position,
        to: targetPosition,
        actionPointsUsed: 0,
        message: `행동 포인트 부족 (필요: ${movementCost}, 보유: ${unit.actionPoints})`,
        triggeredEffects: [],
      };
    }
    
    // 이동 실행
    const oldCell = battle.grid[unit.position.y]?.[unit.position.x];
    if (oldCell) {
      oldCell.occupyingUnitIds = oldCell.occupyingUnitIds.filter(id => id !== unitId);
    }
    
    const oldPosition = { ...unit.position };
    unit.position = targetPosition;
    unit.hasMoved = true;
    unit.actionPoints -= movementCost;
    unit.isEntrenched = false; // 이동 시 참호 해제
    
    targetCell.occupyingUnitIds.push(unitId);
    
    // 엄폐/고도 보너스 갱신
    unit.coverBonus = targetCell.coverValue;
    unit.elevationBonus = targetCell.elevation > 50 ? 10 : 0;
    
    // 방향 갱신
    unit.facing = this.calculateFacing(oldPosition, targetPosition);
    
    const triggeredEffects: string[] = [];
    for (const effect of targetCell.effects) {
      triggeredEffects.push(`${effect.effectType}: ${effect.value}`);
    }
    
    logger.info('[GroundBattleBoxService] Unit moved', {
      boxId,
      unitId,
      from: oldPosition,
      to: targetPosition,
      cost: movementCost,
    });
    
    return {
      success: true,
      unitId,
      from: oldPosition,
      to: targetPosition,
      actionPointsUsed: movementCost,
      message: `이동 완료 (${movementCost} AP 소모)`,
      triggeredEffects,
    };
  }
  
  /**
   * 방향 계산
   */
  private calculateFacing(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    if (dy < 0 && dx === 0) return 'N';
    if (dy < 0 && dx > 0) return 'NE';
    if (dy === 0 && dx > 0) return 'E';
    if (dy > 0 && dx > 0) return 'SE';
    if (dy > 0 && dx === 0) return 'S';
    if (dy > 0 && dx < 0) return 'SW';
    if (dy === 0 && dx < 0) return 'W';
    return 'NW';
  }
  
  // ============================================================
  // Unit Combat
  // ============================================================
  
  /**
   * 유닛 공격
   */
  attackUnit(
    boxId: string,
    attackerId: string,
    targetId: string
  ): AttackResult {
    const battle = this.activeBattles.get(boxId);
    if (!battle) {
      throw new Error(`Battle not found: ${boxId}`);
    }
    
    const attacker = this.findUnit(battle, attackerId);
    const target = this.findUnit(battle, targetId);
    
    if (!attacker || !target) {
      throw new Error('Attacker or target not found');
    }
    
    if (attacker.hasAttacked) {
      return {
        success: false,
        attackerId,
        targetId,
        damageDealt: 0,
        casualtiesCaused: 0,
        accuracyRoll: 0,
        coverModifier: 0,
        elevationModifier: 0,
        flanking: false,
        targetDestroyed: false,
        targetRouted: false,
        combatLog: ['이미 공격한 유닛입니다'],
      };
    }
    
    if (attacker.actionPoints < 1) {
      return {
        success: false,
        attackerId,
        targetId,
        damageDealt: 0,
        casualtiesCaused: 0,
        accuracyRoll: 0,
        coverModifier: 0,
        elevationModifier: 0,
        flanking: false,
        targetDestroyed: false,
        targetRouted: false,
        combatLog: ['행동 포인트가 부족합니다'],
      };
    }
    
    const combatLog: string[] = [];
    
    // 사거리 확인
    const distance = Math.abs(attacker.position.x - target.position.x) + 
                     Math.abs(attacker.position.y - target.position.y);
    const attackerSpec = GROUND_UNIT_SPECS[attacker.baseUnit.type];
    
    // 기본 공격력
    let baseDamage = attacker.baseUnit.stats.attack * attacker.baseUnit.count * 0.1;
    
    // 측면 공격 확인
    const flanking = this.isFlanking(attacker, target);
    if (flanking) {
      baseDamage *= GROUND_BATTLE_BOX_CONSTANTS.FLANKING_BONUS;
      combatLog.push('[측면 공격] 측면 공격 보너스 적용');
    }
    
    // 고지대 보너스
    const attackerCell = battle.grid[attacker.position.y]?.[attacker.position.x];
    const targetCell = battle.grid[target.position.y]?.[target.position.x];
    let elevationModifier = 0;
    
    if (attackerCell && targetCell && attackerCell.elevation > targetCell.elevation + 20) {
      baseDamage *= GROUND_BATTLE_BOX_CONSTANTS.HIGH_GROUND_BONUS;
      elevationModifier = 20;
      combatLog.push('[고지대] 고지대 공격 보너스 적용');
    }
    
    // 참호 보너스 (방어측)
    if (target.isEntrenched) {
      baseDamage /= GROUND_BATTLE_BOX_CONSTANTS.ENTRENCHMENT_BONUS;
      combatLog.push('[참호] 방어측 참호 보너스 적용');
    }
    
    // 억압 페널티 (공격측)
    if (attacker.isSuppressed) {
      baseDamage *= GROUND_BATTLE_BOX_CONSTANTS.SUPPRESSION_PENALTY;
      combatLog.push('[억압] 억압 페널티 적용');
    }
    
    // 엄폐 수정자
    const coverModifier = target.coverBonus;
    baseDamage *= (1 - coverModifier / 200);
    
    // 명중 굴림
    const accuracyRoll = Math.random() * 100;
    const hitChance = 70 - coverModifier / 2 + elevationModifier;
    
    let finalDamage = 0;
    let casualtiesCaused = 0;
    
    if (accuracyRoll <= hitChance) {
      finalDamage = Math.floor(baseDamage);
      
      // 데미지 적용
      target.baseUnit.stats.hp -= finalDamage;
      
      // 병력 손실
      if (target.baseUnit.stats.hp <= 0) {
        casualtiesCaused = Math.ceil(target.baseUnit.count * 0.2);
        target.baseUnit.count -= casualtiesCaused;
        target.baseUnit.stats.hp = target.baseUnit.stats.maxHp;
        
        combatLog.push(`[피해] ${casualtiesCaused}명 손실`);
      }
      
      // 사기 저하
      target.baseUnit.stats.morale -= 5;
      
      combatLog.push(`[명중] ${finalDamage} 데미지`);
    } else {
      combatLog.push('[빗나감] 공격 빗나감');
    }
    
    // 공격 완료 처리
    attacker.hasAttacked = true;
    attacker.actionPoints -= 1;
    
    // 파괴/패주 확인
    const targetDestroyed = target.baseUnit.count <= 0;
    const targetRouted = target.baseUnit.stats.morale <= 10;
    
    if (targetDestroyed) {
      target.baseUnit.isDestroyed = true;
      this.removeUnitFromCell(battle, target);
      combatLog.push('[전멸] 적 부대 전멸');
      
      // 통계 업데이트
      const isAttackerSide = battle.attackerUnits.includes(attacker);
      if (isAttackerSide) {
        battle.statistics.attackerStats.casualtiesInflicted += casualtiesCaused;
        battle.statistics.defenderStats.unitsLost++;
      } else {
        battle.statistics.defenderStats.casualtiesInflicted += casualtiesCaused;
        battle.statistics.attackerStats.unitsLost++;
      }
    }
    
    if (targetRouted && !targetDestroyed) {
      target.isRouted = true;
      combatLog.push('[패주] 적 부대 패주');
    }
    
    // 데미지 통계 업데이트
    const isAttackerSide = battle.attackerUnits.includes(attacker);
    if (isAttackerSide) {
      battle.statistics.attackerStats.totalDamageDealt += finalDamage;
    } else {
      battle.statistics.defenderStats.totalDamageDealt += finalDamage;
    }
    
    logger.info('[GroundBattleBoxService] Attack executed', {
      boxId,
      attackerId,
      targetId,
      damage: finalDamage,
      casualties: casualtiesCaused,
    });
    
    this.emit('combat:attack', {
      boxId,
      attackerId,
      targetId,
      damage: finalDamage,
      casualties: casualtiesCaused,
    });
    
    return {
      success: true,
      attackerId,
      targetId,
      damageDealt: finalDamage,
      casualtiesCaused,
      accuracyRoll,
      coverModifier,
      elevationModifier,
      flanking,
      targetDestroyed,
      targetRouted,
      combatLog,
    };
  }
  
  /**
   * 측면 공격 확인
   */
  private isFlanking(attacker: BoxUnit, target: BoxUnit): boolean {
    const dx = attacker.position.x - target.position.x;
    const dy = attacker.position.y - target.position.y;
    
    // 대상의 방향 벡터
    const facingVectors: Record<Direction, { x: number; y: number }> = {
      'N': { x: 0, y: -1 },
      'NE': { x: 1, y: -1 },
      'E': { x: 1, y: 0 },
      'SE': { x: 1, y: 1 },
      'S': { x: 0, y: 1 },
      'SW': { x: -1, y: 1 },
      'W': { x: -1, y: 0 },
      'NW': { x: -1, y: -1 },
    };
    
    const facing = facingVectors[target.facing];
    
    // 공격 방향과 방어 방향의 내적
    // 음수면 측면/후방 공격
    const dot = dx * facing.x + dy * facing.y;
    
    return dot > 0;
  }
  
  // ============================================================
  // Objective Capture
  // ============================================================
  
  /**
   * 목표 점령 시도
   */
  captureObjective(
    boxId: string,
    objectiveId: string,
    capturingFactionId: string
  ): CaptureResult {
    const battle = this.activeBattles.get(boxId);
    if (!battle) {
      throw new Error(`Battle not found: ${boxId}`);
    }
    
    const objective = battle.objectives.find(o => o.objectiveId === objectiveId);
    if (!objective) {
      throw new Error(`Objective not found: ${objectiveId}`);
    }
    
    const cell = battle.grid[objective.position.y]?.[objective.position.x];
    if (!cell) {
      throw new Error('Invalid objective position');
    }
    
    // 점령 진영의 유닛 수 확인
    let capturingUnits = 0;
    let opposingUnits = 0;
    
    for (const unitId of cell.occupyingUnitIds) {
      const attackerUnit = battle.attackerUnits.find(u => u.unitId === unitId);
      const defenderUnit = battle.defenderUnits.find(u => u.unitId === unitId);
      
      if (capturingFactionId === battle.attackerFactionId && attackerUnit) {
        capturingUnits++;
      } else if (capturingFactionId === battle.defenderFactionId && defenderUnit) {
        capturingUnits++;
      } else if (attackerUnit || defenderUnit) {
        opposingUnits++;
      }
    }
    
    if (capturingUnits < objective.requiredUnitsToCapture) {
      return {
        success: false,
        objectiveId,
        progressMade: 0,
        totalProgress: objective.captureProgress,
        isContested: opposingUnits > 0,
        message: `점령에 필요한 유닛이 부족합니다 (필요: ${objective.requiredUnitsToCapture}, 현재: ${capturingUnits})`,
      };
    }
    
    if (opposingUnits > 0) {
      return {
        success: false,
        objectiveId,
        progressMade: 0,
        totalProgress: objective.captureProgress,
        isContested: true,
        message: '적이 존재하여 점령할 수 없습니다',
      };
    }
    
    // 점령 진행
    const previousOwner = objective.controllingFaction;
    let progressMade = 0;
    
    if (objective.controllingFaction === capturingFactionId) {
      // 이미 소유 중 - 강화
      progressMade = Math.min(100 - objective.captureProgress, objective.captureRate);
      objective.captureProgress += progressMade;
    } else if (objective.controllingFaction) {
      // 적 소유 - 점령 진행도 감소
      progressMade = objective.captureRate;
      objective.captureProgress -= progressMade;
      
      if (objective.captureProgress <= 0) {
        objective.captureProgress = 0;
        objective.controllingFaction = capturingFactionId;
        cell.controllingFaction = capturingFactionId;
        
        this.emit('objective:captured', {
          boxId,
          objectiveId,
          previousOwner,
          newOwner: capturingFactionId,
        });
        
        return {
          success: true,
          objectiveId,
          previousOwner,
          newOwner: capturingFactionId,
          progressMade,
          totalProgress: 0,
          isContested: false,
          message: `목표 점령 완료: ${objective.name}`,
        };
      }
    } else {
      // 중립 - 점령 시작
      progressMade = objective.captureRate;
      objective.captureProgress = progressMade;
      
      if (objective.captureProgress >= 100) {
        objective.controllingFaction = capturingFactionId;
        cell.controllingFaction = capturingFactionId;
        
        return {
          success: true,
          objectiveId,
          newOwner: capturingFactionId,
          progressMade,
          totalProgress: 100,
          isContested: false,
          message: `목표 점령 완료: ${objective.name}`,
        };
      }
    }
    
    return {
      success: true,
      objectiveId,
      progressMade,
      totalProgress: objective.captureProgress,
      isContested: false,
      message: `점령 진행 중: ${objective.captureProgress.toFixed(1)}%`,
    };
  }
  
  // ============================================================
  // Victory Conditions
  // ============================================================
  
  /**
   * 승리 조건 확인
   */
  private checkVictoryConditions(battle: BattleBox): { ended: boolean; result?: BattleBoxResult } {
    // 목표 기반 승리
    const totalObjectives = battle.objectives.length;
    let attackerObjectives = 0;
    let defenderObjectives = 0;
    
    for (const obj of battle.objectives) {
      if (obj.controllingFaction === battle.attackerFactionId) {
        attackerObjectives++;
      } else if (obj.controllingFaction === battle.defenderFactionId) {
        defenderObjectives++;
      }
    }
    
    const attackerObjectiveRatio = attackerObjectives / totalObjectives;
    const defenderObjectiveRatio = defenderObjectives / totalObjectives;
    
    if (attackerObjectiveRatio >= GROUND_BATTLE_BOX_CONSTANTS.OBJECTIVE_VICTORY_THRESHOLD) {
      return { ended: true, result: 'ATTACKER_VICTORY' };
    }
    
    if (defenderObjectiveRatio >= GROUND_BATTLE_BOX_CONSTANTS.OBJECTIVE_VICTORY_THRESHOLD) {
      return { ended: true, result: 'DEFENDER_VICTORY' };
    }
    
    // 섬멸 승리
    const aliveAttackers = battle.attackerUnits.filter(u => !u.baseUnit.isDestroyed).length;
    const aliveDefenders = battle.defenderUnits.filter(u => !u.baseUnit.isDestroyed).length;
    
    if (aliveAttackers === 0) {
      return { ended: true, result: 'DEFENDER_VICTORY' };
    }
    
    if (aliveDefenders === 0) {
      return { ended: true, result: 'ATTACKER_VICTORY' };
    }
    
    // 섬멸 임계값
    const initialAttackers = battle.attackerUnits.length;
    const initialDefenders = battle.defenderUnits.length;
    
    if (aliveAttackers / initialAttackers < GROUND_BATTLE_BOX_CONSTANTS.ANNIHILATION_THRESHOLD) {
      return { ended: true, result: 'DEFENDER_VICTORY' };
    }
    
    if (aliveDefenders / initialDefenders < GROUND_BATTLE_BOX_CONSTANTS.ANNIHILATION_THRESHOLD) {
      return { ended: true, result: 'ATTACKER_VICTORY' };
    }
    
    return { ended: false };
  }
  
  /**
   * 전투 종료
   */
  private endBattle(battle: BattleBox, result: BattleBoxResult): void {
    battle.status = 'COMPLETED';
    battle.result = result;
    battle.endedAt = new Date();
    
    logger.info('[GroundBattleBoxService] Battle ended', {
      boxId: battle.boxId,
      result,
      turnsElapsed: battle.statistics.turnsElapsed,
    });
    
    this.emit('battle:ended', {
      boxId: battle.boxId,
      sessionId: battle.sessionId,
      result,
      statistics: battle.statistics,
    });
  }
  
  // ============================================================
  // Utility Methods
  // ============================================================
  
  /**
   * 유닛 찾기
   */
  private findUnit(battle: BattleBox, unitId: string): BoxUnit | undefined {
    return battle.attackerUnits.find(u => u.unitId === unitId) ||
           battle.defenderUnits.find(u => u.unitId === unitId);
  }
  
  /**
   * 전투 조회
   */
  getBattle(boxId: string): BattleBox | undefined {
    return this.activeBattles.get(boxId);
  }
  
  /**
   * 세션의 전투 목록 조회
   */
  getSessionBattles(sessionId: string): BattleBox[] {
    return Array.from(this.activeBattles.values())
      .filter(b => b.sessionId === sessionId);
  }
  
  /**
   * 전투 삭제
   */
  removeBattle(boxId: string): boolean {
    return this.activeBattles.delete(boxId);
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const groundBattleBoxService = GroundBattleBoxService.getInstance();





