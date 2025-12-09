/**
 * DropOperationService - 강하 작전 서비스
 * 
 * 강하 계획 수립, 강하 저항 계산, 상륙 성공/실패 판정, 교두보 확보
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  GroundBattle,
  IGroundBattle,
  IGroundUnit,
  IDropQueueItem,
  GroundUnitType,
  GROUND_UNIT_SPECS,
} from '../../models/gin7/GroundBattle';
import { Planet, IPlanet, PlanetType } from '../../models/gin7/Planet';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Fortress, IFortress } from '../../models/gin7/Fortress';
import { logger } from '../../common/logger';
import { groundBattleExtension, PLANET_BATTLE_MODIFIERS } from './GroundBattleExtension';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 강하 작전 계획
 */
export interface DropOperation {
  operationId: string;
  sessionId: string;
  targetPlanetId: string;
  targetSystemId: string;
  
  // 작전 정보
  operationName: string;
  operationType: DropOperationType;
  
  // 참여 부대
  fleetIds: string[];
  units: DropUnitAssignment[];
  
  // 강하 지점
  landingZones: LandingZone[];
  primaryLandingZone: string;
  
  // 저항 정보
  resistanceLevel: ResistanceLevel;
  estimatedResistance: number;
  actualResistance?: number;
  
  // 상태
  status: DropOperationStatus;
  phase: DropOperationPhase;
  
  // 결과
  beachheads: Beachhead[];
  casualties: {
    inTransit: number;    // 강하 중 손실
    onLanding: number;    // 착륙 시 손실
    afterLanding: number; // 착륙 후 손실
  };
  
  // 타이밍
  plannedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // 메타데이터
  data: Record<string, unknown>;
}

/**
 * 강하 작전 유형
 */
export type DropOperationType = 
  | 'STANDARD_DROP'       // 표준 강하
  | 'COMBAT_DROP'         // 전투 강하 (적 존재)
  | 'ORBITAL_INSERTION'   // 궤도 삽입 (은밀)
  | 'MASS_DROP'           // 대규모 강하
  | 'PRECISION_DROP';     // 정밀 강하 (특수부대)

/**
 * 강하 작전 상태
 */
export type DropOperationStatus =
  | 'PLANNING'            // 계획 중
  | 'READY'               // 준비 완료
  | 'IN_PROGRESS'         // 진행 중
  | 'COMPLETED'           // 완료
  | 'ABORTED'             // 중단
  | 'FAILED';             // 실패

/**
 * 강하 작전 단계
 */
export type DropOperationPhase =
  | 'APPROACH'            // 접근
  | 'ORBITAL_ENTRY'       // 궤도 진입
  | 'DESCENT'             // 강하
  | 'LANDING'             // 착륙
  | 'CONSOLIDATION'       // 집결
  | 'EXPANSION';          // 확장

/**
 * 저항 수준
 */
export type ResistanceLevel = 
  | 'NONE'                // 저항 없음
  | 'LIGHT'               // 경미
  | 'MODERATE'            // 보통
  | 'HEAVY'               // 강함
  | 'EXTREME';            // 극심

/**
 * 강하 유닛 배정
 */
export interface DropUnitAssignment {
  unitId: string;
  fleetId: string;
  unitType: GroundUnitType;
  count: number;
  targetZoneId: string;
  priority: number;       // 강하 순서 (낮을수록 먼저)
  specialization?: string; // 특수화 (정찰, 공병 등)
}

/**
 * 착륙 지점
 */
export interface LandingZone {
  zoneId: string;
  name: string;
  coordinates: { x: number; y: number };
  terrainType: string;
  
  // 적합도
  suitability: number;    // 0-100
  coverAvailable: number; // 0-100
  
  // 위험도
  aaDefenseLevel: number; // 대공 방어 수준
  groundDefenseLevel: number; // 지상 방어 수준
  
  // 상태
  isSecured: boolean;
  controllingFaction?: string;
}

/**
 * 교두보
 */
export interface Beachhead {
  beachheadId: string;
  zoneId: string;
  position: { x: number; y: number };
  
  // 상태
  isEstablished: boolean;
  stabilityLevel: number;   // 0-100
  supplyLevel: number;      // 0-100
  
  // 방어
  defensivePerimeter: number;
  reinforcementCapacity: number;
  
  // 유닛
  garrisonedUnits: string[];
  maxCapacity: number;
  
  // 건설
  fortificationLevel: number;
  hasSupplyDepot: boolean;
  hasFieldHospital: boolean;
  hasCommunicationsPost: boolean;
  
  // 타이밍
  establishedAt: Date;
  lastUpdatedAt: Date;
}

/**
 * 강하 저항 계산 결과
 */
export interface ResistanceCalculation {
  level: ResistanceLevel;
  totalResistance: number;
  components: {
    aaDefense: number;
    groundForces: number;
    fortifications: number;
    terrain: number;
    weather: number;
  };
  expectedCasualtyRate: number;
  recommendedApproach: string;
}

/**
 * 상륙 판정 결과
 */
export interface LandingJudgment {
  success: boolean;
  partialSuccess: boolean;
  
  unitsLanded: number;
  unitsLost: number;
  unitsDiverted: number;
  
  landedAt: LandingZone;
  divertedTo?: LandingZone;
  
  beachheadEstablished: boolean;
  beachhead?: Beachhead;
  
  combatLog: string[];
}

/**
 * 강하 웨이브
 */
export interface DropWave {
  waveId: string;
  operationId: string;
  waveNumber: number;
  
  // 웨이브 구성
  units: DropUnitAssignment[];
  targetZoneId: string;
  
  // 타이밍
  scheduledTime: Date;
  launchTime?: Date;
  arrivalTime?: Date;
  
  // 상태
  status: DropWaveStatus;
  
  // 결과
  casualties: number;
  successfulLandings: number;
  diversions: number;
  
  // 지원
  coveringFire: boolean;
  orbitalSupport: boolean;
  electronicWarfare: boolean;
  
  // 로그
  eventLog: string[];
}

/**
 * 강하 웨이브 상태
 */
export type DropWaveStatus =
  | 'PENDING'            // 대기
  | 'LAUNCHING'          // 발진 중
  | 'IN_TRANSIT'         // 이동 중
  | 'LANDING'            // 착륙 중
  | 'COMPLETED'          // 완료
  | 'ABORTED'            // 중단
  | 'FAILED';            // 실패

/**
 * 강하 손실 계산 결과
 */
export interface DropCasualtyResult {
  totalCasualties: number;
  phases: {
    launchPhase: number;      // 발진 중 손실
    transitPhase: number;     // 이동 중 손실
    descentPhase: number;     // 강하 중 손실
    landingPhase: number;     // 착륙 중 손실
  };
  causeBreakdown: {
    aaFire: number;           // 대공포 화력
    groundFire: number;       // 지상포 화력
    collision: number;        // 충돌/사고
    missedLZ: number;         // 착륙 지점 이탈
  };
  survivors: number;
  effectiveStrength: number;  // 전투 가능 유효 병력
}

// ============================================================
// Constants
// ============================================================

const DROP_OPERATION_CONSTANTS = {
  // 강하 시간 (틱)
  APPROACH_DURATION: 2,
  ORBITAL_ENTRY_DURATION: 1,
  DESCENT_DURATION: 2,
  LANDING_DURATION: 1,
  CONSOLIDATION_DURATION: 3,
  
  // 손실률 기준
  CASUALTY_RATE_NONE: 0,
  CASUALTY_RATE_LIGHT: 0.05,
  CASUALTY_RATE_MODERATE: 0.15,
  CASUALTY_RATE_HEAVY: 0.30,
  CASUALTY_RATE_EXTREME: 0.50,
  
  // 교두보 기준값
  BEACHHEAD_MIN_UNITS: 3,
  BEACHHEAD_STABILITY_THRESHOLD: 30,
  BEACHHEAD_MAX_CAPACITY: 20,
  
  // 저항 임계값
  RESISTANCE_LIGHT_MAX: 30,
  RESISTANCE_MODERATE_MAX: 60,
  RESISTANCE_HEAVY_MAX: 85,
  
  // 성공 판정
  SUCCESS_THRESHOLD: 0.6,
  PARTIAL_SUCCESS_THRESHOLD: 0.3,
};

// ============================================================
// DropOperationService Class
// ============================================================

export class DropOperationService extends EventEmitter {
  private static instance: DropOperationService;
  private activeOperations: Map<string, DropOperation> = new Map();
  
  private constructor() {
    super();
    logger.info('[DropOperationService] Initialized');
  }
  
  public static getInstance(): DropOperationService {
    if (!DropOperationService.instance) {
      DropOperationService.instance = new DropOperationService();
    }
    return DropOperationService.instance;
  }
  
  // ============================================================
  // Operation Planning
  // ============================================================
  
  /**
   * 강하 작전 계획 수립
   */
  async planDropOperation(params: {
    sessionId: string;
    targetPlanetId: string;
    fleetIds: string[];
    units: Omit<DropUnitAssignment, 'targetZoneId' | 'priority'>[];
    operationName?: string;
    operationType?: DropOperationType;
  }): Promise<DropOperation> {
    const { sessionId, targetPlanetId, fleetIds, units, operationName, operationType } = params;
    
    // 행성 정보 조회
    const planet = await Planet.findOne({ sessionId, planetId: targetPlanetId });
    if (!planet) {
      throw new Error(`Planet not found: ${targetPlanetId}`);
    }
    
    // 행성 타입 지상전 가능 여부 확인
    if (!groundBattleExtension.canConductGroundBattle(planet.type)) {
      throw new Error(`Ground combat not possible on ${planet.type} planets`);
    }
    
    // 착륙 지점 분석
    const landingZones = await this.analyzeLandingZones(sessionId, planet);
    if (landingZones.length === 0) {
      throw new Error('No suitable landing zones found');
    }
    
    // 저항 수준 계산
    const resistanceCalc = await this.calculateResistance(sessionId, planet);
    
    // 유닛 배정 최적화
    const unitAssignments = this.optimizeUnitAssignments(units, landingZones, planet.type);
    
    const operationId = `DROP-${uuidv4().slice(0, 8)}`;
    const operation: DropOperation = {
      operationId,
      sessionId,
      targetPlanetId,
      targetSystemId: planet.systemId,
      
      operationName: operationName || `Operation ${planet.name}`,
      operationType: operationType || this.determineOperationType(units.length, resistanceCalc.level),
      
      fleetIds,
      units: unitAssignments,
      
      landingZones,
      primaryLandingZone: landingZones[0].zoneId,
      
      resistanceLevel: resistanceCalc.level,
      estimatedResistance: resistanceCalc.totalResistance,
      
      status: 'PLANNING',
      phase: 'APPROACH',
      
      beachheads: [],
      casualties: {
        inTransit: 0,
        onLanding: 0,
        afterLanding: 0,
      },
      
      plannedAt: new Date(),
      data: {},
    };
    
    this.activeOperations.set(operationId, operation);
    
    logger.info('[DropOperationService] Operation planned', {
      operationId,
      targetPlanet: planet.name,
      unitCount: units.length,
      resistanceLevel: resistanceCalc.level,
    });
    
    this.emit('operation:planned', {
      operationId,
      sessionId,
      targetPlanetId,
      resistanceLevel: resistanceCalc.level,
      recommendedApproach: resistanceCalc.recommendedApproach,
    });
    
    return operation;
  }
  
  /**
   * 착륙 지점 분석
   */
  private async analyzeLandingZones(
    sessionId: string,
    planet: IPlanet
  ): Promise<LandingZone[]> {
    const zones: LandingZone[] = [];
    
    // 기본 착륙 지점 생성 (실제로는 맵 데이터에서 로드)
    const baseZones = [
      { name: '해안 평원', terrain: 'plains', x: 100, y: 200, cover: 20 },
      { name: '도시 외곽', terrain: 'urban', x: 300, y: 150, cover: 60 },
      { name: '산악 계곡', terrain: 'mountains', x: 200, y: 400, cover: 80 },
      { name: '사막 지대', terrain: 'desert', x: 450, y: 300, cover: 10 },
    ];
    
    for (const base of baseZones) {
      // 행성 방어 수준 기반 대공/지상 방어 계산
      const defenseRating = planet.defenseRating || 0;
      
      const zone: LandingZone = {
        zoneId: `LZ-${uuidv4().slice(0, 6)}`,
        name: base.name,
        coordinates: { x: base.x, y: base.y },
        terrainType: base.terrain,
        
        suitability: this.calculateZoneSuitability(base.terrain, planet.type),
        coverAvailable: base.cover,
        
        aaDefenseLevel: Math.floor(defenseRating * 0.4 + Math.random() * 20),
        groundDefenseLevel: Math.floor(defenseRating * 0.6 + Math.random() * 15),
        
        isSecured: false,
        controllingFaction: planet.ownerId,
      };
      
      zones.push(zone);
    }
    
    // 적합도 순으로 정렬
    zones.sort((a, b) => b.suitability - a.suitability);
    
    return zones;
  }
  
  /**
   * 지역 적합도 계산
   */
  private calculateZoneSuitability(terrainType: string, planetType: PlanetType): number {
    let suitability = 50; // 기본값
    
    // 지형별 기본 적합도
    const terrainSuitability: Record<string, number> = {
      plains: 80,
      desert: 70,
      urban: 40,
      jungle: 30,
      mountains: 20,
      swamp: 15,
    };
    
    suitability = terrainSuitability[terrainType] || 50;
    
    // 행성 타입 보정
    const planetMod = PLANET_BATTLE_MODIFIERS[planetType];
    if (planetMod) {
      suitability *= planetMod.conquestSpeedModifier;
    }
    
    return Math.min(100, Math.max(0, Math.floor(suitability)));
  }
  
  /**
   * 유닛 배정 최적화
   */
  private optimizeUnitAssignments(
    units: Omit<DropUnitAssignment, 'targetZoneId' | 'priority'>[],
    zones: LandingZone[],
    planetType: PlanetType
  ): DropUnitAssignment[] {
    const assignments: DropUnitAssignment[] = [];
    const planetMod = PLANET_BATTLE_MODIFIERS[planetType];
    
    // 허용된 유닛만 필터링
    const allowedUnits = units.filter(u => 
      planetMod.allowedUnitTypes.includes(u.unitType)
    );
    
    // 최적 지역에 유닛 배정
    let priority = 1;
    for (const unit of allowedUnits) {
      // 유닛 타입에 따른 최적 지역 선택
      const bestZone = this.selectBestZoneForUnit(unit.unitType, zones);
      
      assignments.push({
        ...unit,
        targetZoneId: bestZone.zoneId,
        priority: priority++,
      });
    }
    
    return assignments;
  }
  
  /**
   * 유닛에 최적 지역 선택
   */
  private selectBestZoneForUnit(unitType: GroundUnitType, zones: LandingZone[]): LandingZone {
    // 유닛 타입별 선호 지형
    const preferredTerrain: Record<GroundUnitType, string[]> = {
      armored: ['plains', 'desert'],
      infantry: ['urban', 'jungle', 'mountains'],
      grenadier: ['plains', 'urban'],
    };
    
    const preferred = preferredTerrain[unitType] || [];
    
    // 선호 지형이 있는 지역 우선
    for (const zone of zones) {
      if (preferred.includes(zone.terrainType)) {
        return zone;
      }
    }
    
    // 없으면 가장 적합한 지역
    return zones[0];
  }
  
  /**
   * 작전 유형 결정
   */
  private determineOperationType(unitCount: number, resistanceLevel: ResistanceLevel): DropOperationType {
    if (resistanceLevel === 'NONE') {
      return 'STANDARD_DROP';
    }
    
    if (unitCount >= 20) {
      return 'MASS_DROP';
    }
    
    if (resistanceLevel === 'EXTREME' || resistanceLevel === 'HEAVY') {
      return 'COMBAT_DROP';
    }
    
    if (unitCount <= 5) {
      return 'PRECISION_DROP';
    }
    
    return 'ORBITAL_INSERTION';
  }
  
  // ============================================================
  // Resistance Calculation
  // ============================================================
  
  /**
   * 강하 저항 계산
   */
  async calculateResistance(
    sessionId: string,
    planet: IPlanet
  ): Promise<ResistanceCalculation> {
    const components = {
      aaDefense: 0,
      groundForces: 0,
      fortifications: 0,
      terrain: 0,
      weather: 0,
    };
    
    // 대공 방어 (방어 등급 기반)
    components.aaDefense = (planet.defenseRating || 0) * 0.5;
    
    // 지상군 (수비대 기반)
    const garrisonCount = planet.garrisonIds?.length || 0;
    components.groundForces = garrisonCount * 10;
    
    // 요새화 수준
    const defenseFacilities = planet.facilities?.filter(
      f => f.type === 'defense_grid' && f.isOperational
    ) || [];
    components.fortifications = defenseFacilities.length * 15;
    
    // 지형 난이도
    const terrainDifficulty: Record<PlanetType, number> = {
      terran: 20,
      ocean: 40,
      desert: 30,
      ice: 35,
      gas_giant: 100, // 불가능
      volcanic: 45,
      artificial: 50,
      barren: 15,
    };
    components.terrain = terrainDifficulty[planet.type] || 20;
    
    // 기상 (랜덤 요소)
    components.weather = Math.floor(Math.random() * 20);
    
    // 총 저항
    const totalResistance = Object.values(components).reduce((sum, val) => sum + val, 0);
    
    // 저항 수준 결정
    let level: ResistanceLevel;
    if (totalResistance <= DROP_OPERATION_CONSTANTS.RESISTANCE_LIGHT_MAX) {
      level = 'LIGHT';
    } else if (totalResistance <= DROP_OPERATION_CONSTANTS.RESISTANCE_MODERATE_MAX) {
      level = 'MODERATE';
    } else if (totalResistance <= DROP_OPERATION_CONSTANTS.RESISTANCE_HEAVY_MAX) {
      level = 'HEAVY';
    } else {
      level = 'EXTREME';
    }
    
    // 저항이 0이면 NONE
    if (totalResistance <= 10) {
      level = 'NONE';
    }
    
    // 예상 손실률
    const expectedCasualtyRate = this.getCasualtyRateForLevel(level);
    
    // 권장 접근법
    const recommendedApproach = this.getRecommendedApproach(level, components);
    
    return {
      level,
      totalResistance,
      components,
      expectedCasualtyRate,
      recommendedApproach,
    };
  }
  
  /**
   * 저항 수준별 손실률
   */
  private getCasualtyRateForLevel(level: ResistanceLevel): number {
    switch (level) {
      case 'NONE': return DROP_OPERATION_CONSTANTS.CASUALTY_RATE_NONE;
      case 'LIGHT': return DROP_OPERATION_CONSTANTS.CASUALTY_RATE_LIGHT;
      case 'MODERATE': return DROP_OPERATION_CONSTANTS.CASUALTY_RATE_MODERATE;
      case 'HEAVY': return DROP_OPERATION_CONSTANTS.CASUALTY_RATE_HEAVY;
      case 'EXTREME': return DROP_OPERATION_CONSTANTS.CASUALTY_RATE_EXTREME;
    }
  }
  
  /**
   * 권장 접근법 결정
   */
  private getRecommendedApproach(
    level: ResistanceLevel,
    components: ResistanceCalculation['components']
  ): string {
    if (level === 'NONE' || level === 'LIGHT') {
      return '표준 강하 작전으로 진행 가능';
    }
    
    if (components.aaDefense > 40) {
      return '궤도 폭격으로 대공 방어 제거 후 강하 권장';
    }
    
    if (components.groundForces > 50) {
      return '지상군 약화를 위한 사전 포격 권장';
    }
    
    if (components.fortifications > 30) {
      return '요새 우회 또는 포위전 권장';
    }
    
    if (level === 'EXTREME') {
      return '다단계 작전 또는 대규모 병력 투입 필요';
    }
    
    return '전투 강하로 신속히 교두보 확보 권장';
  }
  
  // ============================================================
  // Landing Judgment
  // ============================================================
  
  /**
   * 상륙 성공/실패 판정
   */
  async judgeLanding(
    operation: DropOperation,
    unitAssignment: DropUnitAssignment,
    targetZone: LandingZone
  ): Promise<LandingJudgment> {
    const combatLog: string[] = [];
    
    // 기본 성공 확률
    let successChance = 1.0 - this.getCasualtyRateForLevel(operation.resistanceLevel);
    
    // 지역 방어에 따른 수정
    successChance -= (targetZone.aaDefenseLevel / 200);
    successChance -= (targetZone.groundDefenseLevel / 300);
    
    // 지역 적합도 보너스
    successChance += (targetZone.suitability / 500);
    
    // 엄폐 가용성 보너스
    successChance += (targetZone.coverAvailable / 400);
    
    // 작전 유형 수정자
    const operationBonus = this.getOperationTypeBonus(operation.operationType);
    successChance += operationBonus;
    
    // 최종 판정
    const roll = Math.random();
    const success = roll < successChance;
    const partialSuccess = !success && roll < successChance + 0.2;
    
    // 손실 계산
    let unitsLost = 0;
    let unitsDiverted = 0;
    const unitsLanded = unitAssignment.count;
    
    if (success) {
      // 성공 시 경미한 손실
      unitsLost = Math.floor(unitsLanded * this.getCasualtyRateForLevel(operation.resistanceLevel) * 0.5);
      combatLog.push(`[강하 성공] ${unitsLanded - unitsLost}명 착륙 완료`);
    } else if (partialSuccess) {
      // 부분 성공 시 중간 손실
      unitsLost = Math.floor(unitsLanded * this.getCasualtyRateForLevel(operation.resistanceLevel));
      unitsDiverted = Math.floor((unitsLanded - unitsLost) * 0.3);
      combatLog.push(`[부분 성공] ${unitsLanded - unitsLost - unitsDiverted}명 착륙, ${unitsDiverted}명 분산`);
    } else {
      // 실패 시 큰 손실
      unitsLost = Math.floor(unitsLanded * this.getCasualtyRateForLevel(operation.resistanceLevel) * 1.5);
      unitsDiverted = Math.floor((unitsLanded - unitsLost) * 0.5);
      combatLog.push(`[강하 실패] 심각한 손실 발생: ${unitsLost}명 전사, ${unitsDiverted}명 분산`);
    }
    
    // 교두보 확보 판정
    const landedUnits = unitsLanded - unitsLost - unitsDiverted;
    const beachheadEstablished = landedUnits >= DROP_OPERATION_CONSTANTS.BEACHHEAD_MIN_UNITS && success;
    
    let beachhead: Beachhead | undefined;
    if (beachheadEstablished) {
      beachhead = this.establishBeachhead(targetZone, [unitAssignment.unitId]);
      combatLog.push(`[교두보 확보] ${targetZone.name}에 교두보 설정 완료`);
    }
    
    logger.info('[DropOperationService] Landing judged', {
      operationId: operation.operationId,
      unitId: unitAssignment.unitId,
      success,
      partialSuccess,
      unitsLanded: landedUnits,
      unitsLost,
    });
    
    return {
      success,
      partialSuccess,
      unitsLanded: landedUnits,
      unitsLost,
      unitsDiverted,
      landedAt: targetZone,
      beachheadEstablished,
      beachhead,
      combatLog,
    };
  }
  
  /**
   * 작전 유형별 보너스
   */
  private getOperationTypeBonus(type: DropOperationType): number {
    switch (type) {
      case 'STANDARD_DROP': return 0;
      case 'COMBAT_DROP': return 0.1;
      case 'ORBITAL_INSERTION': return 0.15;
      case 'MASS_DROP': return 0.05;
      case 'PRECISION_DROP': return 0.2;
    }
  }
  
  // ============================================================
  // Beachhead Management
  // ============================================================
  
  /**
   * 교두보 확보
   */
  establishBeachhead(
    zone: LandingZone,
    unitIds: string[]
  ): Beachhead {
    const beachhead: Beachhead = {
      beachheadId: `BH-${uuidv4().slice(0, 8)}`,
      zoneId: zone.zoneId,
      position: zone.coordinates,
      
      isEstablished: true,
      stabilityLevel: DROP_OPERATION_CONSTANTS.BEACHHEAD_STABILITY_THRESHOLD + 10,
      supplyLevel: 50,
      
      defensivePerimeter: 20,
      reinforcementCapacity: DROP_OPERATION_CONSTANTS.BEACHHEAD_MAX_CAPACITY,
      
      garrisonedUnits: unitIds,
      maxCapacity: DROP_OPERATION_CONSTANTS.BEACHHEAD_MAX_CAPACITY,
      
      fortificationLevel: 0,
      hasSupplyDepot: false,
      hasFieldHospital: false,
      hasCommunicationsPost: false,
      
      establishedAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    
    logger.info('[DropOperationService] Beachhead established', {
      beachheadId: beachhead.beachheadId,
      zoneId: zone.zoneId,
      unitCount: unitIds.length,
    });
    
    this.emit('beachhead:established', {
      beachheadId: beachhead.beachheadId,
      zoneId: zone.zoneId,
      zoneName: zone.name,
    });
    
    return beachhead;
  }
  
  /**
   * 교두보 강화
   */
  reinforceBeachhead(
    beachhead: Beachhead,
    additionalUnits: string[]
  ): Beachhead {
    // 수용 한계 확인
    const availableCapacity = beachhead.maxCapacity - beachhead.garrisonedUnits.length;
    const unitsToAdd = additionalUnits.slice(0, availableCapacity);
    
    const updated: Beachhead = {
      ...beachhead,
      garrisonedUnits: [...beachhead.garrisonedUnits, ...unitsToAdd],
      stabilityLevel: Math.min(100, beachhead.stabilityLevel + unitsToAdd.length * 5),
      defensivePerimeter: Math.min(100, beachhead.defensivePerimeter + unitsToAdd.length * 3),
      lastUpdatedAt: new Date(),
    };
    
    logger.info('[DropOperationService] Beachhead reinforced', {
      beachheadId: beachhead.beachheadId,
      addedUnits: unitsToAdd.length,
      totalUnits: updated.garrisonedUnits.length,
    });
    
    return updated;
  }
  
  /**
   * 교두보 업그레이드
   */
  upgradeBeachhead(
    beachhead: Beachhead,
    upgrade: 'fortification' | 'supply_depot' | 'field_hospital' | 'communications'
  ): Beachhead {
    const updated = { ...beachhead };
    
    switch (upgrade) {
      case 'fortification':
        updated.fortificationLevel = Math.min(100, updated.fortificationLevel + 20);
        updated.defensivePerimeter = Math.min(100, updated.defensivePerimeter + 15);
        break;
      case 'supply_depot':
        updated.hasSupplyDepot = true;
        updated.supplyLevel = Math.min(100, updated.supplyLevel + 30);
        updated.reinforcementCapacity += 5;
        break;
      case 'field_hospital':
        updated.hasFieldHospital = true;
        updated.stabilityLevel = Math.min(100, updated.stabilityLevel + 10);
        break;
      case 'communications':
        updated.hasCommunicationsPost = true;
        updated.maxCapacity += 5;
        break;
    }
    
    updated.lastUpdatedAt = new Date();
    
    logger.info('[DropOperationService] Beachhead upgraded', {
      beachheadId: beachhead.beachheadId,
      upgrade,
    });
    
    return updated;
  }
  
  /**
   * 교두보 보급 처리
   */
  processBeachheadSupply(beachhead: Beachhead): Beachhead {
    const supplyDrain = beachhead.garrisonedUnits.length * 2;
    const supplyGain = beachhead.hasSupplyDepot ? 10 : 0;
    
    const newSupplyLevel = Math.max(0, Math.min(100, 
      beachhead.supplyLevel - supplyDrain + supplyGain
    ));
    
    // 보급 부족 시 안정도 감소
    let stabilityChange = 0;
    if (newSupplyLevel < 20) {
      stabilityChange = -10;
    } else if (newSupplyLevel < 50) {
      stabilityChange = -5;
    } else if (beachhead.hasSupplyDepot) {
      stabilityChange = 2;
    }
    
    return {
      ...beachhead,
      supplyLevel: newSupplyLevel,
      stabilityLevel: Math.max(0, Math.min(100, beachhead.stabilityLevel + stabilityChange)),
      lastUpdatedAt: new Date(),
    };
  }
  
  // ============================================================
  // Wave Execution
  // ============================================================
  
  /**
   * 강하 웨이브 생성
   */
  createWave(params: {
    operationId: string;
    units: DropUnitAssignment[];
    targetZoneId: string;
    waveNumber: number;
    scheduledTime: Date;
    options?: {
      coveringFire?: boolean;
      orbitalSupport?: boolean;
      electronicWarfare?: boolean;
    };
  }): DropWave {
    const { operationId, units, targetZoneId, waveNumber, scheduledTime, options } = params;
    
    const wave: DropWave = {
      waveId: `WAVE-${uuidv4().slice(0, 8)}`,
      operationId,
      waveNumber,
      
      units,
      targetZoneId,
      
      scheduledTime,
      
      status: 'PENDING',
      
      casualties: 0,
      successfulLandings: 0,
      diversions: 0,
      
      coveringFire: options?.coveringFire ?? false,
      orbitalSupport: options?.orbitalSupport ?? false,
      electronicWarfare: options?.electronicWarfare ?? false,
      
      eventLog: [`[웨이브 생성] 제${waveNumber}차 강하 웨이브 편성 완료`],
    };
    
    logger.info('[DropOperationService] Wave created', {
      waveId: wave.waveId,
      operationId,
      waveNumber,
      unitCount: units.length,
    });
    
    return wave;
  }
  
  /**
   * 강하 웨이브 실행
   */
  async executeWave(
    wave: DropWave,
    operation: DropOperation
  ): Promise<DropWave> {
    if (wave.status !== 'PENDING') {
      throw new Error(`Wave ${wave.waveId} is not in PENDING status`);
    }
    
    const targetZone = operation.landingZones.find(z => z.zoneId === wave.targetZoneId);
    if (!targetZone) {
      throw new Error(`Target zone ${wave.targetZoneId} not found`);
    }
    
    // 발진 단계
    wave.status = 'LAUNCHING';
    wave.launchTime = new Date();
    wave.eventLog.push(`[발진] 제${wave.waveNumber}차 웨이브 발진 개시`);
    
    // 지원 효과 적용
    let supportBonus = 0;
    if (wave.coveringFire) {
      supportBonus += 0.1;
      wave.eventLog.push('[지원] 엄호 사격 개시');
    }
    if (wave.orbitalSupport) {
      supportBonus += 0.15;
      wave.eventLog.push('[지원] 궤도 화력 지원 개시');
    }
    if (wave.electronicWarfare) {
      supportBonus += 0.1;
      wave.eventLog.push('[지원] 전자전 교란 개시');
    }
    
    // 이동 단계
    wave.status = 'IN_TRANSIT';
    wave.eventLog.push('[강하 중] 대기권 진입 중...');
    
    // 손실 계산
    const totalUnits = wave.units.reduce((sum, u) => sum + u.count, 0);
    const casualtyResult = this.calculateDropCasualties({
      totalUnits,
      resistanceLevel: operation.resistanceLevel,
      targetZone,
      supportBonus,
      operationType: operation.operationType,
    });
    
    wave.casualties = casualtyResult.totalCasualties;
    wave.eventLog.push(`[손실] 강하 중 손실: ${casualtyResult.totalCasualties}명`);
    
    // 착륙 단계
    wave.status = 'LANDING';
    wave.arrivalTime = new Date();
    
    // 각 유닛별 착륙 판정
    let successfulLandings = 0;
    let diversions = 0;
    
    for (const unitAssignment of wave.units) {
      const judgment = await this.judgeLanding(operation, unitAssignment, targetZone);
      
      if (judgment.success) {
        successfulLandings += judgment.unitsLanded;
        wave.eventLog.push(`[착륙 성공] ${unitAssignment.unitType} ${judgment.unitsLanded}명 착륙`);
      } else if (judgment.partialSuccess) {
        successfulLandings += judgment.unitsLanded;
        diversions += judgment.unitsDiverted;
        wave.eventLog.push(`[부분 성공] ${judgment.unitsLanded}명 착륙, ${judgment.unitsDiverted}명 분산`);
      } else {
        diversions += judgment.unitsDiverted;
        wave.eventLog.push(`[착륙 실패] ${judgment.unitsLost}명 손실, ${judgment.unitsDiverted}명 분산`);
      }
      
      // 교두보 추가
      if (judgment.beachhead && !operation.beachheads.find(b => b.zoneId === targetZone.zoneId)) {
        operation.beachheads.push(judgment.beachhead);
      }
    }
    
    wave.successfulLandings = successfulLandings;
    wave.diversions = diversions;
    
    // 완료
    wave.status = 'COMPLETED';
    wave.eventLog.push(`[완료] 제${wave.waveNumber}차 웨이브 완료: ${successfulLandings}명 성공, ${wave.casualties}명 손실`);
    
    // 작전 손실 갱신
    operation.casualties.inTransit += casualtyResult.phases.transitPhase;
    operation.casualties.onLanding += casualtyResult.phases.landingPhase;
    
    logger.info('[DropOperationService] Wave executed', {
      waveId: wave.waveId,
      successfulLandings,
      casualties: wave.casualties,
      diversions,
    });
    
    this.emit('wave:completed', {
      waveId: wave.waveId,
      operationId: operation.operationId,
      successfulLandings,
      casualties: wave.casualties,
    });
    
    return wave;
  }
  
  /**
   * 강하 손실 계산
   */
  calculateDropCasualties(params: {
    totalUnits: number;
    resistanceLevel: ResistanceLevel;
    targetZone: LandingZone;
    supportBonus: number;
    operationType: DropOperationType;
  }): DropCasualtyResult {
    const { totalUnits, resistanceLevel, targetZone, supportBonus, operationType } = params;
    
    // 기본 손실률
    const baseCasualtyRate = this.getCasualtyRateForLevel(resistanceLevel);
    
    // 지역 방어에 따른 추가 손실
    const aaModifier = targetZone.aaDefenseLevel / 200;
    const groundModifier = targetZone.groundDefenseLevel / 300;
    
    // 작전 유형별 수정자
    const operationModifier = this.getOperationTypeCasualtyModifier(operationType);
    
    // 지원 효과로 손실 감소
    const effectiveCasualtyRate = Math.max(0, 
      (baseCasualtyRate + aaModifier + groundModifier) * operationModifier - supportBonus
    );
    
    // 단계별 손실 분배
    const totalCasualties = Math.floor(totalUnits * effectiveCasualtyRate);
    
    const phases = {
      launchPhase: Math.floor(totalCasualties * 0.05),    // 발진 중 5%
      transitPhase: Math.floor(totalCasualties * 0.25),   // 이동 중 25%
      descentPhase: Math.floor(totalCasualties * 0.40),   // 강하 중 40%
      landingPhase: Math.floor(totalCasualties * 0.30),   // 착륙 중 30%
    };
    
    // 원인별 분류
    const causeBreakdown = {
      aaFire: Math.floor(totalCasualties * 0.45),
      groundFire: Math.floor(totalCasualties * 0.35),
      collision: Math.floor(totalCasualties * 0.10),
      missedLZ: Math.floor(totalCasualties * 0.10),
    };
    
    const survivors = totalUnits - totalCasualties;
    const effectiveStrength = Math.floor(survivors * 0.9); // 부상자 등 고려
    
    return {
      totalCasualties,
      phases,
      causeBreakdown,
      survivors,
      effectiveStrength,
    };
  }
  
  /**
   * 작전 유형별 손실 수정자
   */
  private getOperationTypeCasualtyModifier(type: DropOperationType): number {
    switch (type) {
      case 'STANDARD_DROP': return 1.0;
      case 'COMBAT_DROP': return 0.9;       // 전투 준비로 손실 감소
      case 'ORBITAL_INSERTION': return 0.7;  // 은밀 접근으로 손실 감소
      case 'MASS_DROP': return 1.2;          // 대규모 작전으로 손실 증가
      case 'PRECISION_DROP': return 0.6;     // 정밀 작전으로 손실 감소
    }
  }
  
  /**
   * 착륙 지점 선택 (자동)
   */
  async selectLandingZones(params: {
    sessionId: string;
    planetId: string;
    unitCount: number;
    preferences?: {
      preferredTerrain?: string[];
      avoidHighDefense?: boolean;
      prioritizeCover?: boolean;
    };
  }): Promise<LandingZone[]> {
    const { sessionId, planetId, unitCount, preferences } = params;
    
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      throw new Error(`Planet not found: ${planetId}`);
    }
    
    // 기본 착륙 지점 분석
    const allZones = await this.analyzeLandingZones(sessionId, planet);
    
    // 필터링 및 정렬
    let filteredZones = [...allZones];
    
    if (preferences?.avoidHighDefense) {
      filteredZones = filteredZones.filter(z => 
        z.aaDefenseLevel < 50 && z.groundDefenseLevel < 50
      );
    }
    
    if (preferences?.preferredTerrain?.length) {
      filteredZones.sort((a, b) => {
        const aPreferred = preferences.preferredTerrain!.includes(a.terrainType) ? 1 : 0;
        const bPreferred = preferences.preferredTerrain!.includes(b.terrainType) ? 1 : 0;
        return bPreferred - aPreferred;
      });
    }
    
    if (preferences?.prioritizeCover) {
      filteredZones.sort((a, b) => b.coverAvailable - a.coverAvailable);
    }
    
    // 유닛 수에 따라 필요한 착륙 지점 수 결정
    const zonesNeeded = Math.ceil(unitCount / 10); // 10유닛당 1개 지역
    
    return filteredZones.slice(0, Math.min(zonesNeeded, filteredZones.length));
  }
  
  // ============================================================
  // Operation Execution
  // ============================================================
  
  /**
   * 작전 시작
   */
  async startOperation(operationId: string): Promise<DropOperation> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }
    
    if (operation.status !== 'PLANNING' && operation.status !== 'READY') {
      throw new Error(`Operation cannot be started in ${operation.status} status`);
    }
    
    operation.status = 'IN_PROGRESS';
    operation.phase = 'APPROACH';
    operation.startedAt = new Date();
    
    logger.info('[DropOperationService] Operation started', { operationId });
    
    this.emit('operation:started', {
      operationId,
      sessionId: operation.sessionId,
      targetPlanetId: operation.targetPlanetId,
    });
    
    return operation;
  }
  
  /**
   * 작전 단계 진행
   */
  async advancePhase(operationId: string): Promise<DropOperation> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }
    
    if (operation.status !== 'IN_PROGRESS') {
      throw new Error('Operation is not in progress');
    }
    
    const phaseOrder: DropOperationPhase[] = [
      'APPROACH',
      'ORBITAL_ENTRY',
      'DESCENT',
      'LANDING',
      'CONSOLIDATION',
      'EXPANSION',
    ];
    
    const currentIndex = phaseOrder.indexOf(operation.phase);
    if (currentIndex === phaseOrder.length - 1) {
      // 마지막 단계 완료
      operation.status = 'COMPLETED';
      operation.completedAt = new Date();
      
      logger.info('[DropOperationService] Operation completed', { operationId });
      
      this.emit('operation:completed', {
        operationId,
        sessionId: operation.sessionId,
        beachheads: operation.beachheads.length,
        totalCasualties: operation.casualties.inTransit + 
                        operation.casualties.onLanding + 
                        operation.casualties.afterLanding,
      });
    } else {
      operation.phase = phaseOrder[currentIndex + 1];
      
      logger.info('[DropOperationService] Phase advanced', {
        operationId,
        newPhase: operation.phase,
      });
      
      this.emit('operation:phaseAdvanced', {
        operationId,
        phase: operation.phase,
      });
    }
    
    return operation;
  }
  
  /**
   * 작전 중단
   */
  async abortOperation(operationId: string, reason: string): Promise<DropOperation> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation not found: ${operationId}`);
    }
    
    operation.status = 'ABORTED';
    operation.completedAt = new Date();
    operation.data.abortReason = reason;
    
    logger.info('[DropOperationService] Operation aborted', { operationId, reason });
    
    this.emit('operation:aborted', {
      operationId,
      sessionId: operation.sessionId,
      reason,
    });
    
    return operation;
  }
  
  // ============================================================
  // Query Methods
  // ============================================================
  
  /**
   * 작전 조회
   */
  getOperation(operationId: string): DropOperation | undefined {
    return this.activeOperations.get(operationId);
  }
  
  /**
   * 세션의 모든 작전 조회
   */
  getSessionOperations(sessionId: string): DropOperation[] {
    return Array.from(this.activeOperations.values())
      .filter(op => op.sessionId === sessionId);
  }
  
  /**
   * 행성의 활성 작전 조회
   */
  getActiveOperationsForPlanet(sessionId: string, planetId: string): DropOperation[] {
    return Array.from(this.activeOperations.values())
      .filter(op => 
        op.sessionId === sessionId && 
        op.targetPlanetId === planetId &&
        op.status === 'IN_PROGRESS'
      );
  }
  
  /**
   * 작전 삭제 (완료/중단된 작전 정리)
   */
  removeOperation(operationId: string): boolean {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return false;
    
    if (operation.status === 'IN_PROGRESS') {
      throw new Error('Cannot remove operation in progress');
    }
    
    return this.activeOperations.delete(operationId);
  }
  
  /**
   * 정리 (완료된 작전 모두 제거)
   */
  cleanup(): number {
    let removed = 0;
    for (const [id, op] of this.activeOperations) {
      if (op.status === 'COMPLETED' || op.status === 'ABORTED' || op.status === 'FAILED') {
        this.activeOperations.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const dropOperationService = DropOperationService.getInstance();

