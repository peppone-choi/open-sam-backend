/**
 * CrewTypeService - 승조원 특기 시스템
 * 
 * 기능:
 * - 승조원 특기 (GENERAL, ENGINEERING, MEDICAL, COMMUNICATIONS, WEAPONS, NAVIGATION, FLIGHT)
 * - 승조원 배치 (assignCrew)
 * - 특기 보너스 계산 (getSpecialtyBonus)
 * - 승조원 훈련 (trainCrew)
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet, IShipUnit } from '../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Enums & Types
// ============================================================

/**
 * 승조원 특기
 */
export enum CrewSpecialty {
  GENERAL = 'GENERAL',               // 일반 승조원
  ENGINEERING = 'ENGINEERING',       // 기관/정비
  MEDICAL = 'MEDICAL',               // 의료
  COMMUNICATIONS = 'COMMUNICATIONS', // 통신
  WEAPONS = 'WEAPONS',               // 무기/포술
  NAVIGATION = 'NAVIGATION',         // 항법
  FLIGHT = 'FLIGHT',                 // 전투정 조종
}

/**
 * 승조원 경험 등급
 */
export enum CrewExperienceGrade {
  NOVICE = 'NOVICE',           // 신병 (0-20)
  TRAINED = 'TRAINED',         // 훈련병 (21-40)
  REGULAR = 'REGULAR',         // 일반 (41-60)
  VETERAN = 'VETERAN',         // 베테랑 (61-80)
  ELITE = 'ELITE',             // 정예 (81-100)
}

/**
 * 승조원 상세 정보
 */
export interface CrewSpecialist {
  crewId: string;
  specialty: CrewSpecialty;
  experienceLevel: number;     // 0-100
  grade: CrewExperienceGrade;
  efficiency: number;          // 0-100 (작업 효율)
  health: number;              // 0-100
  morale: number;              // 0-100
  skills: string[];            // 습득 스킬
  assignedTo: {
    fleetId?: string;
    unitId?: string;
    stationId?: string;        // 배치 위치 (bridge, engine, medical 등)
  };
  metadata?: Record<string, unknown>;
}

/**
 * 함선 내 배치 위치
 */
export enum CrewStation {
  BRIDGE = 'BRIDGE',             // 함교
  WEAPONS_BAY = 'WEAPONS_BAY',   // 포술실
  ENGINE_ROOM = 'ENGINE_ROOM',   // 기관실
  MEDICAL_BAY = 'MEDICAL_BAY',   // 의무실
  COMM_CENTER = 'COMM_CENTER',   // 통신실
  NAVIGATION = 'NAVIGATION',     // 항법실
  HANGAR = 'HANGAR',             // 격납고
}

/**
 * 특기별 정의
 */
interface SpecialtyDefinition {
  name: string;
  nameKo: string;
  primaryStation: CrewStation;
  bonuses: {
    combat: number;
    repair: number;
    medical: number;
    communication: number;
    navigation: number;
    fighterOps: number;
  };
  trainingCost: number;
  trainingTime: number;         // 일 단위
  requiredSkills: string[];
}

// ============================================================
// 특기별 정의
// ============================================================

const SPECIALTY_DEFINITIONS: Record<CrewSpecialty, SpecialtyDefinition> = {
  [CrewSpecialty.GENERAL]: {
    name: 'General Crew',
    nameKo: '일반 승조원',
    primaryStation: CrewStation.BRIDGE,
    bonuses: {
      combat: 1.0,
      repair: 0.5,
      medical: 0.3,
      communication: 0.5,
      navigation: 0.5,
      fighterOps: 0.3,
    },
    trainingCost: 100,
    trainingTime: 30,
    requiredSkills: [],
  },
  [CrewSpecialty.ENGINEERING]: {
    name: 'Engineering',
    nameKo: '기관 승조원',
    primaryStation: CrewStation.ENGINE_ROOM,
    bonuses: {
      combat: 0.5,
      repair: 2.0,
      medical: 0.3,
      communication: 0.5,
      navigation: 0.8,
      fighterOps: 0.5,
    },
    trainingCost: 200,
    trainingTime: 60,
    requiredSkills: ['BASIC_REPAIR'],
  },
  [CrewSpecialty.MEDICAL]: {
    name: 'Medical Corps',
    nameKo: '의료 승조원',
    primaryStation: CrewStation.MEDICAL_BAY,
    bonuses: {
      combat: 0.3,
      repair: 0.5,
      medical: 2.0,
      communication: 0.5,
      navigation: 0.3,
      fighterOps: 0.2,
    },
    trainingCost: 250,
    trainingTime: 90,
    requiredSkills: ['FIRST_AID'],
  },
  [CrewSpecialty.COMMUNICATIONS]: {
    name: 'Communications',
    nameKo: '통신 승조원',
    primaryStation: CrewStation.COMM_CENTER,
    bonuses: {
      combat: 0.5,
      repair: 0.5,
      medical: 0.3,
      communication: 2.0,
      navigation: 0.8,
      fighterOps: 0.3,
    },
    trainingCost: 180,
    trainingTime: 45,
    requiredSkills: ['BASIC_COMMS'],
  },
  [CrewSpecialty.WEAPONS]: {
    name: 'Weapons Specialist',
    nameKo: '포술 승조원',
    primaryStation: CrewStation.WEAPONS_BAY,
    bonuses: {
      combat: 2.0,
      repair: 0.8,
      medical: 0.2,
      communication: 0.5,
      navigation: 0.5,
      fighterOps: 0.5,
    },
    trainingCost: 220,
    trainingTime: 75,
    requiredSkills: ['GUNNERY_BASIC'],
  },
  [CrewSpecialty.NAVIGATION]: {
    name: 'Navigation',
    nameKo: '항법 승조원',
    primaryStation: CrewStation.NAVIGATION,
    bonuses: {
      combat: 0.5,
      repair: 0.5,
      medical: 0.2,
      communication: 0.8,
      navigation: 2.0,
      fighterOps: 0.5,
    },
    trainingCost: 200,
    trainingTime: 60,
    requiredSkills: ['BASIC_NAV'],
  },
  [CrewSpecialty.FLIGHT]: {
    name: 'Flight Crew',
    nameKo: '전투정 승조원',
    primaryStation: CrewStation.HANGAR,
    bonuses: {
      combat: 1.5,
      repair: 0.5,
      medical: 0.2,
      communication: 0.5,
      navigation: 1.2,
      fighterOps: 2.5,
    },
    trainingCost: 300,
    trainingTime: 120,
    requiredSkills: ['PILOT_BASIC'],
  },
};

// 경험 등급 범위
const EXPERIENCE_GRADE_RANGES: Record<CrewExperienceGrade, { min: number; max: number; modifier: number }> = {
  [CrewExperienceGrade.NOVICE]: { min: 0, max: 20, modifier: 0.7 },
  [CrewExperienceGrade.TRAINED]: { min: 21, max: 40, modifier: 0.85 },
  [CrewExperienceGrade.REGULAR]: { min: 41, max: 60, modifier: 1.0 },
  [CrewExperienceGrade.VETERAN]: { min: 61, max: 80, modifier: 1.2 },
  [CrewExperienceGrade.ELITE]: { min: 81, max: 100, modifier: 1.5 },
};

// ============================================================
// Request/Response Types
// ============================================================

export interface AssignCrewToUnitRequest {
  sessionId: string;
  fleetId: string;
  unitId: string;
  specialty: CrewSpecialty;
  quantity: number;
  station?: CrewStation;
}

export interface CrewTypeAssignResult {
  success: boolean;
  assigned: number;
  specialty: CrewSpecialty;
  station?: CrewStation;
  bonusApplied: {
    combat: number;
    repair: number;
    navigation: number;
  };
  error?: string;
}

export interface TrainCrewRequest {
  sessionId: string;
  fleetId: string;
  unitId?: string;
  targetSpecialty: CrewSpecialty;
  quantity: number;
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TrainCrewResult {
  success: boolean;
  trained: number;
  experienceGained: number;
  specialtyChanged: number;
  cost: number;
  duration: number;
  error?: string;
}

export interface SpecialtyBonus {
  combat: number;
  repair: number;
  medical: number;
  communication: number;
  navigation: number;
  fighterOps: number;
  total: number;
}

// ============================================================
// CrewTypeService Class
// ============================================================

export class CrewTypeService extends EventEmitter {
  private static instance: CrewTypeService;
  
  // 세션별 승조원 특기 분포 (fleetId-unitId -> specialty -> count)
  private specialtyDistribution: Map<string, Map<CrewSpecialty, number>> = new Map();
  
  // 훈련 진행 상태
  private trainingInProgress: Map<string, {
    specialty: CrewSpecialty;
    remaining: number;
    quantity: number;
  }> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[CrewTypeService] Initialized');
  }

  public static getInstance(): CrewTypeService {
    if (!CrewTypeService.instance) {
      CrewTypeService.instance = new CrewTypeService();
    }
    return CrewTypeService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.processMonthlyUpdate(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[CrewTypeService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 승조원 배치 (assignCrew)
  // ============================================================

  /**
   * 유닛에 특기 승조원 배치
   */
  public async assignCrew(request: AssignCrewToUnitRequest): Promise<CrewTypeAssignResult> {
    const { sessionId, fleetId, unitId, specialty, quantity, station } = request;

    // 1. 함대 및 유닛 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return {
        success: false,
        assigned: 0,
        specialty,
        bonusApplied: { combat: 0, repair: 0, navigation: 0 },
        error: '함대를 찾을 수 없습니다.',
      };
    }

    const unit = fleet.units?.find(u => u.unitId === unitId);
    if (!unit) {
      return {
        success: false,
        assigned: 0,
        specialty,
        bonusApplied: { combat: 0, repair: 0, navigation: 0 },
        error: '유닛을 찾을 수 없습니다.',
      };
    }

    // 2. 배치 가능 인원 확인
    const availableSlots = unit.maxCrew - unit.crewCount;
    if (availableSlots <= 0) {
      return {
        success: false,
        assigned: 0,
        specialty,
        bonusApplied: { combat: 0, repair: 0, navigation: 0 },
        error: '승조원 배치 공간이 부족합니다.',
      };
    }

    // 3. 배치 실행
    const toAssign = Math.min(quantity, availableSlots);
    unit.crewCount += toAssign;

    // 4. 특기 분포 업데이트
    const key = `${sessionId}-${fleetId}-${unitId}`;
    let distribution = this.specialtyDistribution.get(key);
    if (!distribution) {
      distribution = new Map<CrewSpecialty, number>();
    }
    const currentCount = distribution.get(specialty) || 0;
    distribution.set(specialty, currentCount + toAssign);
    this.specialtyDistribution.set(key, distribution);

    // 5. 보너스 계산 및 적용
    const bonuses = this.calculateUnitBonus(key);
    this.applyBonusToUnit(unit, bonuses);

    await fleet.save();

    // 6. 이벤트 발생
    this.emit('crew:assigned', {
      sessionId,
      fleetId,
      unitId,
      specialty,
      quantity: toAssign,
      station: station || SPECIALTY_DEFINITIONS[specialty].primaryStation,
    });

    logger.info(`[CrewTypeService] Assigned ${toAssign} ${specialty} crew to unit ${unitId}`);

    return {
      success: true,
      assigned: toAssign,
      specialty,
      station: station || SPECIALTY_DEFINITIONS[specialty].primaryStation,
      bonusApplied: {
        combat: bonuses.combat,
        repair: bonuses.repair,
        navigation: bonuses.navigation,
      },
    };
  }

  /**
   * 유닛 보너스 계산
   */
  private calculateUnitBonus(key: string): SpecialtyBonus {
    const distribution = this.specialtyDistribution.get(key);
    if (!distribution) {
      return {
        combat: 1.0,
        repair: 1.0,
        medical: 1.0,
        communication: 1.0,
        navigation: 1.0,
        fighterOps: 1.0,
        total: 1.0,
      };
    }

    let totalCrew = 0;
    const weightedBonuses = {
      combat: 0,
      repair: 0,
      medical: 0,
      communication: 0,
      navigation: 0,
      fighterOps: 0,
    };

    for (const [specialty, count] of distribution) {
      const def = SPECIALTY_DEFINITIONS[specialty];
      totalCrew += count;
      
      weightedBonuses.combat += def.bonuses.combat * count;
      weightedBonuses.repair += def.bonuses.repair * count;
      weightedBonuses.medical += def.bonuses.medical * count;
      weightedBonuses.communication += def.bonuses.communication * count;
      weightedBonuses.navigation += def.bonuses.navigation * count;
      weightedBonuses.fighterOps += def.bonuses.fighterOps * count;
    }

    if (totalCrew === 0) {
      return {
        combat: 1.0,
        repair: 1.0,
        medical: 1.0,
        communication: 1.0,
        navigation: 1.0,
        fighterOps: 1.0,
        total: 1.0,
      };
    }

    const avgCombat = weightedBonuses.combat / totalCrew;
    const avgRepair = weightedBonuses.repair / totalCrew;
    const avgMedical = weightedBonuses.medical / totalCrew;
    const avgComm = weightedBonuses.communication / totalCrew;
    const avgNav = weightedBonuses.navigation / totalCrew;
    const avgFighter = weightedBonuses.fighterOps / totalCrew;

    return {
      combat: avgCombat,
      repair: avgRepair,
      medical: avgMedical,
      communication: avgComm,
      navigation: avgNav,
      fighterOps: avgFighter,
      total: (avgCombat + avgRepair + avgMedical + avgComm + avgNav + avgFighter) / 6,
    };
  }

  /**
   * 유닛에 보너스 적용
   */
  private applyBonusToUnit(unit: IShipUnit, bonuses: SpecialtyBonus): void {
    // 유닛 데이터에 보너스 저장
    if (!unit.data) unit.data = {};
    (unit.data as Record<string, unknown>).crewBonus = {
      combat: bonuses.combat,
      repair: bonuses.repair,
      navigation: bonuses.navigation,
      fighterOps: bonuses.fighterOps,
    };
  }

  // ============================================================
  // 특기 보너스 (getSpecialtyBonus)
  // ============================================================

  /**
   * 특기별 보너스 조회
   */
  public getSpecialtyBonus(specialty: CrewSpecialty): SpecialtyDefinition['bonuses'] {
    return SPECIALTY_DEFINITIONS[specialty].bonuses;
  }

  /**
   * 유닛의 현재 특기 보너스 조회
   */
  public getUnitSpecialtyBonus(sessionId: string, fleetId: string, unitId: string): SpecialtyBonus {
    const key = `${sessionId}-${fleetId}-${unitId}`;
    return this.calculateUnitBonus(key);
  }

  /**
   * 특기별 전투 보너스 계산
   */
  public getCombatBonus(specialty: CrewSpecialty, experienceLevel: number): number {
    const def = SPECIALTY_DEFINITIONS[specialty];
    const grade = this.getExperienceGrade(experienceLevel);
    const gradeData = EXPERIENCE_GRADE_RANGES[grade];
    
    return def.bonuses.combat * gradeData.modifier;
  }

  /**
   * 특기별 수리 보너스 계산
   */
  public getRepairBonus(specialty: CrewSpecialty, experienceLevel: number): number {
    const def = SPECIALTY_DEFINITIONS[specialty];
    const grade = this.getExperienceGrade(experienceLevel);
    const gradeData = EXPERIENCE_GRADE_RANGES[grade];
    
    return def.bonuses.repair * gradeData.modifier;
  }

  /**
   * 경험 등급 결정
   */
  private getExperienceGrade(level: number): CrewExperienceGrade {
    for (const [grade, range] of Object.entries(EXPERIENCE_GRADE_RANGES)) {
      if (level >= range.min && level <= range.max) {
        return grade as CrewExperienceGrade;
      }
    }
    return CrewExperienceGrade.REGULAR;
  }

  // ============================================================
  // 승조원 훈련 (trainCrew)
  // ============================================================

  /**
   * 승조원 특기 훈련 시작
   */
  public async trainCrew(request: TrainCrewRequest): Promise<TrainCrewResult> {
    const { sessionId, fleetId, unitId, targetSpecialty, quantity, intensity } = request;

    // 1. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return {
        success: false,
        trained: 0,
        experienceGained: 0,
        specialtyChanged: 0,
        cost: 0,
        duration: 0,
        error: '함대를 찾을 수 없습니다.',
      };
    }

    // 2. 함대 상태 확인
    if (fleet.status !== 'IDLE' && fleet.status !== 'DOCKED') {
      return {
        success: false,
        trained: 0,
        experienceGained: 0,
        specialtyChanged: 0,
        cost: 0,
        duration: 0,
        error: '함대가 대기 또는 정박 상태여야 합니다.',
      };
    }

    // 3. 훈련 비용 및 기간 계산
    const def = SPECIALTY_DEFINITIONS[targetSpecialty];
    const intensityMultiplier = intensity === 'HIGH' ? 1.5 : intensity === 'MEDIUM' ? 1.0 : 0.7;
    const cost = Math.floor(def.trainingCost * quantity * intensityMultiplier);
    const duration = Math.floor(def.trainingTime / (intensityMultiplier + 0.5));

    // 4. 훈련 시작
    const trainingKey = `${sessionId}-${fleetId}-${unitId || 'all'}`;
    this.trainingInProgress.set(trainingKey, {
      specialty: targetSpecialty,
      remaining: duration,
      quantity,
    });

    // 5. 경험치 증가 예상
    const experienceGained = Math.floor(20 * intensityMultiplier);

    // 6. 이벤트 발생
    this.emit('crew:trainingStarted', {
      sessionId,
      fleetId,
      unitId,
      targetSpecialty,
      quantity,
      intensity,
      cost,
      duration,
    });

    logger.info(`[CrewTypeService] Started training ${quantity} crew to ${targetSpecialty} for fleet ${fleetId}`);

    return {
      success: true,
      trained: quantity,
      experienceGained,
      specialtyChanged: 0, // 훈련 완료 시 변경됨
      cost,
      duration,
    };
  }

  /**
   * 훈련 진행 처리 (일일)
   */
  public async processTrainingProgress(sessionId: string): Promise<void> {
    for (const [key, training] of this.trainingInProgress) {
      if (!key.startsWith(sessionId)) continue;

      training.remaining -= 1;

      if (training.remaining <= 0) {
        // 훈련 완료
        await this.completeTraining(key, training);
        this.trainingInProgress.delete(key);
      } else {
        this.trainingInProgress.set(key, training);
      }
    }
  }

  /**
   * 훈련 완료 처리
   */
  private async completeTraining(
    key: string,
    training: { specialty: CrewSpecialty; remaining: number; quantity: number },
  ): Promise<void> {
    const [sessionId, fleetId, unitId] = key.split('-');

    // 특기 분포 업데이트
    const distKey = `${sessionId}-${fleetId}-${unitId === 'all' ? '' : unitId}`;
    let distribution = this.specialtyDistribution.get(distKey);
    if (!distribution) {
      distribution = new Map<CrewSpecialty, number>();
    }

    // GENERAL에서 targetSpecialty로 전환
    const generalCount = distribution.get(CrewSpecialty.GENERAL) || 0;
    const converted = Math.min(training.quantity, generalCount);
    
    if (converted > 0) {
      distribution.set(CrewSpecialty.GENERAL, generalCount - converted);
      const targetCount = distribution.get(training.specialty) || 0;
      distribution.set(training.specialty, targetCount + converted);
      this.specialtyDistribution.set(distKey, distribution);
    }

    // 이벤트 발생
    this.emit('crew:trainingCompleted', {
      sessionId,
      fleetId,
      unitId: unitId === 'all' ? undefined : unitId,
      specialty: training.specialty,
      converted,
    });

    logger.info(`[CrewTypeService] Training completed: ${converted} crew converted to ${training.specialty}`);
  }

  /**
   * 승조원 경험치 증가
   */
  public async grantCrewExperience(
    sessionId: string,
    fleetId: string,
    experienceGained: number,
    reason: string,
  ): Promise<{ levelUps: number }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return { levelUps: 0 };

    let levelUps = 0;

    for (const unit of fleet.units) {
      // 베테랑시 증가
      const currentVeterancy = unit.veterancy || 0;
      const newVeterancy = Math.min(100, currentVeterancy + experienceGained * 0.05);
      unit.veterancy = newVeterancy;

      // 등급 상승 체크
      const oldGrade = this.getExperienceGrade(currentVeterancy);
      const newGrade = this.getExperienceGrade(newVeterancy);
      if (oldGrade !== newGrade) levelUps++;
    }

    await fleet.save();

    if (levelUps > 0) {
      this.emit('crew:levelUp', {
        sessionId,
        fleetId,
        levelUps,
        reason,
      });
    }

    return { levelUps };
  }

  // ============================================================
  // 월간 업데이트
  // ============================================================

  private async processMonthlyUpdate(sessionId: string): Promise<void> {
    await this.processTrainingProgress(sessionId);
    logger.debug(`[CrewTypeService] Monthly update processed for session ${sessionId}`);
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 특기 정의 조회
   */
  public getSpecialtyDefinition(specialty: CrewSpecialty): SpecialtyDefinition {
    return SPECIALTY_DEFINITIONS[specialty];
  }

  /**
   * 전체 특기 목록 조회
   */
  public getAllSpecialties(): typeof SPECIALTY_DEFINITIONS {
    return SPECIALTY_DEFINITIONS;
  }

  /**
   * 유닛의 특기 분포 조회
   */
  public getUnitSpecialtyDistribution(
    sessionId: string,
    fleetId: string,
    unitId: string,
  ): Map<CrewSpecialty, number> | undefined {
    const key = `${sessionId}-${fleetId}-${unitId}`;
    return this.specialtyDistribution.get(key);
  }

  /**
   * 함대 전체 특기 분포 조회
   */
  public async getFleetSpecialtyDistribution(
    sessionId: string,
    fleetId: string,
  ): Promise<{
    total: Map<CrewSpecialty, number>;
    byUnit: Array<{ unitId: string; distribution: Map<CrewSpecialty, number> }>;
  }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return {
        total: new Map(),
        byUnit: [],
      };
    }

    const total = new Map<CrewSpecialty, number>();
    const byUnit: Array<{ unitId: string; distribution: Map<CrewSpecialty, number> }> = [];

    for (const unit of fleet.units) {
      const key = `${sessionId}-${fleetId}-${unit.unitId}`;
      const distribution = this.specialtyDistribution.get(key) || new Map();
      byUnit.push({ unitId: unit.unitId, distribution });

      for (const [specialty, count] of distribution) {
        const current = total.get(specialty) || 0;
        total.set(specialty, current + count);
      }
    }

    return { total, byUnit };
  }

  /**
   * 진행 중인 훈련 조회
   */
  public getTrainingInProgress(
    sessionId: string,
    fleetId: string,
  ): { specialty: CrewSpecialty; remaining: number; quantity: number } | undefined {
    const key = `${sessionId}-${fleetId}-all`;
    return this.trainingInProgress.get(key);
  }

  /**
   * 경험 등급 정보 조회
   */
  public getExperienceGradeInfo(grade: CrewExperienceGrade): typeof EXPERIENCE_GRADE_RANGES[CrewExperienceGrade] {
    return EXPERIENCE_GRADE_RANGES[grade];
  }
}

export const crewTypeService = CrewTypeService.getInstance();
export default CrewTypeService;





