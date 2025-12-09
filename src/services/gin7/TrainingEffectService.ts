/**
 * TrainingEffectService - 훈련 효과 시스템
 * 
 * 기능:
 * - 훈련 유형 (BASIC, COMBAT, TACTICAL, SPECIALIZED)
 * - 훈련 시작 (startTraining)
 * - 효과 계산 (calculateTrainingEffect)
 * - 훈련도 감소 (decayTraining)
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload, DayStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Enums & Types
// ============================================================

/**
 * 훈련 효과 유형
 */
export enum EffectTrainingType {
  BASIC = 'BASIC',               // 기본 훈련
  COMBAT = 'COMBAT',             // 전투 훈련
  TACTICAL = 'TACTICAL',         // 전술 훈련
  SPECIALIZED = 'SPECIALIZED',   // 특수 훈련
}

/**
 * 특수 훈련 세부 유형
 */
export enum SpecializedEffectTrainingType {
  GUNNERY = 'GUNNERY',           // 포술
  NAVIGATION = 'NAVIGATION',     // 항법
  ENGINEERING = 'ENGINEERING',   // 정비
  MEDICAL = 'MEDICAL',           // 의무
  ELECTRONIC_WARFARE = 'ELECTRONIC_WARFARE', // 전자전
  BOARDING = 'BOARDING',         // 승선 전투
  FIGHTER_OPS = 'FIGHTER_OPS',   // 전투정 운용
}

/**
 * 훈련 강도
 */
export enum TrainingIntensity {
  LIGHT = 'LIGHT',               // 경훈련
  NORMAL = 'NORMAL',             // 일반
  INTENSIVE = 'INTENSIVE',       // 집중
  EXTREME = 'EXTREME',           // 극한
}

/**
 * 훈련 상태
 */
export interface TrainingState {
  trainingId: string;
  sessionId: string;
  fleetId: string;
  unitId?: string;
  
  type: EffectTrainingType;
  specializedType?: SpecializedEffectTrainingType;
  intensity: TrainingIntensity;
  
  startedAt: Date;
  scheduledDuration: number;     // 예정 일수
  elapsedDays: number;
  
  instructor?: {
    characterId: string;
    skill: number;
  };
  
  progress: number;              // 0-100
  isActive: boolean;
  
  results: {
    totalGain: number;
    events: TrainingEventRecord[];
    accidents: number;
    breakthroughs: number;
  };
}

/**
 * 훈련 이벤트 기록
 */
export interface TrainingEventRecord {
  timestamp: Date;
  type: 'ACCIDENT' | 'BREAKTHROUGH' | 'MORALE_CHANGE' | 'SKILL_LEARNED';
  description: string;
  effect: number;
}

/**
 * 훈련 효과
 */
export interface TrainingEffect {
  trainingGain: number;          // 훈련도 증가량
  experienceGain: number;        // 경험치 증가량
  moraleChange: number;          // 사기 변화
  skillChance: number;           // 스킬 습득 확률 (%)
  accidentRisk: number;          // 사고 위험 (%)
  fatigueIncrease: number;       // 피로도 증가
  bonuses: {
    combat: number;
    navigation: number;
    repair: number;
  };
}

// ============================================================
// 훈련 유형별 정의
// ============================================================

interface TrainingDefinition {
  name: string;
  nameKo: string;
  baseGainPerDay: number;
  moraleImpact: number;
  accidentBaseRate: number;
  breakthroughRate: number;
  skillCategories: string[];
  fatigueRate: number;
  effects: {
    combatMod: number;
    navigationMod: number;
    repairMod: number;
    moraleMod: number;
  };
}

const TRAINING_TYPE_DEFINITIONS: Record<EffectTrainingType, TrainingDefinition> = {
  [EffectTrainingType.BASIC]: {
    name: 'Basic Training',
    nameKo: '기본 훈련',
    baseGainPerDay: 0.5,
    moraleImpact: -1,
    accidentBaseRate: 1,
    breakthroughRate: 3,
    skillCategories: ['BASIC'],
    fatigueRate: 5,
    effects: {
      combatMod: 0.05,
      navigationMod: 0.05,
      repairMod: 0.05,
      moraleMod: 0.1,
    },
  },
  [EffectTrainingType.COMBAT]: {
    name: 'Combat Training',
    nameKo: '전투 훈련',
    baseGainPerDay: 0.8,
    moraleImpact: -2,
    accidentBaseRate: 4,
    breakthroughRate: 5,
    skillCategories: ['COMBAT', 'WEAPON'],
    fatigueRate: 10,
    effects: {
      combatMod: 0.20,
      navigationMod: 0.02,
      repairMod: 0.0,
      moraleMod: 0.05,
    },
  },
  [EffectTrainingType.TACTICAL]: {
    name: 'Tactical Training',
    nameKo: '전술 훈련',
    baseGainPerDay: 0.4,
    moraleImpact: -1,
    accidentBaseRate: 2,
    breakthroughRate: 8,
    skillCategories: ['TACTICS', 'COMMAND'],
    fatigueRate: 7,
    effects: {
      combatMod: 0.10,
      navigationMod: 0.10,
      repairMod: 0.0,
      moraleMod: 0.08,
    },
  },
  [EffectTrainingType.SPECIALIZED]: {
    name: 'Specialized Training',
    nameKo: '특수 훈련',
    baseGainPerDay: 0.3,
    moraleImpact: -3,
    accidentBaseRate: 6,
    breakthroughRate: 10,
    skillCategories: ['SPECIAL'],
    fatigueRate: 15,
    effects: {
      combatMod: 0.15,
      navigationMod: 0.15,
      repairMod: 0.10,
      moraleMod: 0.0,
    },
  },
};

// 특수 훈련 세부 정의
const SPECIALIZED_DEFINITIONS: Record<SpecializedEffectTrainingType, {
  name: string;
  nameKo: string;
  bonusMultiplier: number;
  skills: string[];
}> = {
  [SpecializedEffectTrainingType.GUNNERY]: {
    name: 'Gunnery',
    nameKo: '포술 훈련',
    bonusMultiplier: 1.2,
    skills: ['PRECISION_FIRE', 'RAPID_FIRE', 'ANTI_FIGHTER'],
  },
  [SpecializedEffectTrainingType.NAVIGATION]: {
    name: 'Navigation',
    nameKo: '항법 훈련',
    bonusMultiplier: 1.1,
    skills: ['EVASIVE_MANEUVER', 'WARP_PRECISION', 'DRIFT_CONTROL'],
  },
  [SpecializedEffectTrainingType.ENGINEERING]: {
    name: 'Engineering',
    nameKo: '정비 훈련',
    bonusMultiplier: 1.0,
    skills: ['DAMAGE_CONTROL', 'SYSTEM_BYPASS', 'FIELD_REPAIR'],
  },
  [SpecializedEffectTrainingType.MEDICAL]: {
    name: 'Medical',
    nameKo: '의무 훈련',
    bonusMultiplier: 0.8,
    skills: ['EMERGENCY_TREATMENT', 'TRIAGE', 'MORALE_SUPPORT'],
  },
  [SpecializedEffectTrainingType.ELECTRONIC_WARFARE]: {
    name: 'Electronic Warfare',
    nameKo: '전자전 훈련',
    bonusMultiplier: 1.3,
    skills: ['JAMMING', 'SIGNAL_INTERCEPT', 'COUNTER_ECM'],
  },
  [SpecializedEffectTrainingType.BOARDING]: {
    name: 'Boarding',
    nameKo: '승선 전투 훈련',
    bonusMultiplier: 1.4,
    skills: ['ZERO_G_COMBAT', 'BREACH_ENTRY', 'CQB'],
  },
  [SpecializedEffectTrainingType.FIGHTER_OPS]: {
    name: 'Fighter Operations',
    nameKo: '전투정 운용 훈련',
    bonusMultiplier: 1.5,
    skills: ['DOGFIGHT', 'CARRIER_LANDING', 'FORMATION_FLIGHT'],
  },
};

// 강도별 배율
const INTENSITY_MULTIPLIERS: Record<TrainingIntensity, {
  gainMod: number;
  moraleMod: number;
  accidentMod: number;
  breakthroughMod: number;
  fatigueMod: number;
}> = {
  [TrainingIntensity.LIGHT]: {
    gainMod: 0.5,
    moraleMod: 0.3,
    accidentMod: 0.3,
    breakthroughMod: 0.5,
    fatigueMod: 0.3,
  },
  [TrainingIntensity.NORMAL]: {
    gainMod: 1.0,
    moraleMod: 1.0,
    accidentMod: 1.0,
    breakthroughMod: 1.0,
    fatigueMod: 1.0,
  },
  [TrainingIntensity.INTENSIVE]: {
    gainMod: 1.5,
    moraleMod: 2.0,
    accidentMod: 1.8,
    breakthroughMod: 1.5,
    fatigueMod: 2.0,
  },
  [TrainingIntensity.EXTREME]: {
    gainMod: 2.0,
    moraleMod: 3.0,
    accidentMod: 3.0,
    breakthroughMod: 2.0,
    fatigueMod: 3.0,
  },
};

// 훈련도 감소율 (월당)
const DECAY_RATES: Record<EffectTrainingType, number> = {
  [EffectTrainingType.BASIC]: 1.0,
  [EffectTrainingType.COMBAT]: 2.0,
  [EffectTrainingType.TACTICAL]: 1.5,
  [EffectTrainingType.SPECIALIZED]: 2.5,
};

// 최소/최대 훈련도
const MIN_TRAINING_LEVEL = 0;
const MAX_TRAINING_LEVEL = 100;

// ============================================================
// Request/Response Types
// ============================================================

export interface EffectTrainingRequest {
  sessionId: string;
  fleetId: string;
  unitId?: string;
  type: EffectTrainingType;
  specializedType?: SpecializedEffectTrainingType;
  intensity: TrainingIntensity;
  duration: number;              // 예정 훈련 일수
  instructorId?: string;
}

export interface EffectTrainingResult {
  success: boolean;
  trainingState?: TrainingState;
  estimatedEffect: TrainingEffect;
  error?: string;
}

export interface CalculateEffectRequest {
  type: EffectTrainingType;
  specializedType?: SpecializedEffectTrainingType;
  intensity: TrainingIntensity;
  duration: number;
  currentLevel: number;
  instructorSkill?: number;
}

// ============================================================
// TrainingEffectService Class
// ============================================================

export class TrainingEffectService extends EventEmitter {
  private static instance: TrainingEffectService;
  
  // 활성 훈련 상태
  private activeTrainings: Map<string, TrainingState> = new Map();
  
  // 유닛별 훈련도 저장
  private trainingLevels: Map<string, Record<EffectTrainingType, number>> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[TrainingEffectService] Initialized');
  }

  public static getInstance(): TrainingEffectService {
    if (!TrainingEffectService.instance) {
      TrainingEffectService.instance = new TrainingEffectService();
    }
    return TrainingEffectService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 일일 훈련 진행
      timeEngine.on(GIN7_EVENTS.DAY_START, async (payload: DayStartPayload) => {
        await this.processDailyTraining(payload.sessionId);
      });
      
      // 월간 훈련도 감소
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.processMonthlyDecay(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[TrainingEffectService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 훈련 시작 (startTraining)
  // ============================================================

  /**
   * 훈련 시작
   */
  public async startTraining(request: EffectTrainingRequest): Promise<EffectTrainingResult> {
    const { sessionId, fleetId, unitId, type, specializedType, intensity, duration, instructorId } = request;

    // 1. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return {
        success: false,
        estimatedEffect: this.getEmptyEffect(),
        error: '함대를 찾을 수 없습니다.',
      };
    }

    // 2. 함대 상태 확인
    if (fleet.status !== 'IDLE' && fleet.status !== 'DOCKED') {
      return {
        success: false,
        estimatedEffect: this.getEmptyEffect(),
        error: '함대가 대기 또는 정박 상태여야 합니다.',
      };
    }

    // 3. 이미 훈련 중인지 확인
    const trainingKey = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    if (this.activeTrainings.has(trainingKey)) {
      return {
        success: false,
        estimatedEffect: this.getEmptyEffect(),
        error: '이미 훈련 중입니다.',
      };
    }

    // 4. 교관 확인
    let instructorSkill = 0;
    if (instructorId) {
      const instructor = await Gin7Character.findOne({ sessionId, characterId: instructorId });
      if (instructor) {
        instructorSkill = this.calculateInstructorSkill(instructor, type);
      }
    }

    // 5. 현재 훈련도 가져오기
    const currentLevel = this.getTrainingLevel(sessionId, fleetId, unitId, type);

    // 6. 예상 효과 계산
    const estimatedEffect = this.calculateTrainingEffect({
      type,
      specializedType,
      intensity,
      duration,
      currentLevel,
      instructorSkill,
    });

    // 7. 훈련 상태 생성
    const trainingId = `TRAIN-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const trainingState: TrainingState = {
      trainingId,
      sessionId,
      fleetId,
      unitId,
      type,
      specializedType,
      intensity,
      startedAt: new Date(),
      scheduledDuration: duration,
      elapsedDays: 0,
      instructor: instructorId ? { characterId: instructorId, skill: instructorSkill } : undefined,
      progress: 0,
      isActive: true,
      results: {
        totalGain: 0,
        events: [],
        accidents: 0,
        breakthroughs: 0,
      },
    };

    // 8. 저장 및 함대 상태 변경
    this.activeTrainings.set(trainingKey, trainingState);
    
    fleet.status = 'REORG';
    fleet.statusData = { training: true, trainingType: type };
    await fleet.save();

    // 9. 이벤트 발생
    this.emit('training:started', {
      sessionId,
      fleetId,
      unitId,
      type,
      specializedType,
      intensity,
      duration,
      estimatedEffect,
    });

    logger.info(`[TrainingEffectService] Started ${type} training for fleet ${fleetId}`);

    return {
      success: true,
      trainingState,
      estimatedEffect,
    };
  }

  /**
   * 훈련 종료
   */
  public async stopTraining(sessionId: string, fleetId: string, unitId?: string): Promise<{
    success: boolean;
    finalResults?: TrainingState['results'];
    error?: string;
  }> {
    const trainingKey = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    const training = this.activeTrainings.get(trainingKey);
    
    if (!training) {
      return { success: false, error: '활성 훈련이 없습니다.' };
    }

    // 훈련 종료 처리
    training.isActive = false;
    this.activeTrainings.delete(trainingKey);

    // 함대 상태 복원
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (fleet) {
      fleet.status = 'IDLE';
      fleet.statusData = {};
      await fleet.save();
    }

    // 이벤트 발생
    this.emit('training:completed', {
      sessionId,
      fleetId,
      unitId,
      type: training.type,
      results: training.results,
    });

    logger.info(`[TrainingEffectService] Completed training for fleet ${fleetId}`);

    return {
      success: true,
      finalResults: training.results,
    };
  }

  // ============================================================
  // 효과 계산 (calculateTrainingEffect)
  // ============================================================

  /**
   * 훈련 효과 계산
   */
  public calculateTrainingEffect(request: CalculateEffectRequest): TrainingEffect {
    const { type, specializedType, intensity, duration, currentLevel, instructorSkill = 0 } = request;

    const typeDef = TRAINING_TYPE_DEFINITIONS[type];
    const intensityMod = INTENSITY_MULTIPLIERS[intensity];

    // 1. 기본 훈련도 증가량
    let baseGain = typeDef.baseGainPerDay * intensityMod.gainMod * duration;
    
    // 교관 보너스
    baseGain *= (1 + instructorSkill / 100);
    
    // 현재 레벨에 따른 효율 감소
    if (currentLevel > 80) {
      baseGain *= 0.5;
    } else if (currentLevel > 60) {
      baseGain *= 0.75;
    }

    // 특수 훈련 보너스
    if (type === EffectTrainingType.SPECIALIZED && specializedType) {
      const specDef = SPECIALIZED_DEFINITIONS[specializedType];
      baseGain *= specDef.bonusMultiplier;
    }

    // 2. 경험치 증가량
    const experienceGain = baseGain * 0.5;

    // 3. 사기 변화
    const moraleChange = typeDef.moraleImpact * intensityMod.moraleMod * (duration / 7);

    // 4. 스킬 습득 확률
    const skillChance = typeDef.breakthroughRate * intensityMod.breakthroughMod * (1 + instructorSkill / 200);

    // 5. 사고 위험
    const accidentRisk = typeDef.accidentBaseRate * intensityMod.accidentMod;

    // 6. 피로도 증가
    const fatigueIncrease = typeDef.fatigueRate * intensityMod.fatigueMod * (duration / 7);

    // 7. 전투 보너스
    const bonuses = {
      combat: typeDef.effects.combatMod * (baseGain / 10),
      navigation: typeDef.effects.navigationMod * (baseGain / 10),
      repair: typeDef.effects.repairMod * (baseGain / 10),
    };

    return {
      trainingGain: Math.round(baseGain * 10) / 10,
      experienceGain: Math.round(experienceGain * 10) / 10,
      moraleChange: Math.round(moraleChange),
      skillChance: Math.round(skillChance * 10) / 10,
      accidentRisk: Math.round(accidentRisk * 10) / 10,
      fatigueIncrease: Math.round(fatigueIncrease),
      bonuses,
    };
  }

  /**
   * 교관 스킬 계산
   */
  private calculateInstructorSkill(instructor: IGin7Character, type: EffectTrainingType): number {
    let relevantStat = 50;
    
    switch (type) {
      case EffectTrainingType.COMBAT:
        relevantStat = instructor.stats.might || 50;
        break;
      case EffectTrainingType.TACTICAL:
        relevantStat = instructor.stats.command || 50;
        break;
      case EffectTrainingType.SPECIALIZED:
        relevantStat = instructor.stats.intellect || 50;
        break;
      default:
        relevantStat = (instructor.stats.command + instructor.stats.intellect) / 2;
    }
    
    const charm = instructor.stats.charm || 50;
    return Math.floor((relevantStat * 0.6 + charm * 0.4) / 2);
  }

  // ============================================================
  // 훈련도 감소 (decayTraining)
  // ============================================================

  /**
   * 월간 훈련도 감소 처리
   */
  private async processMonthlyDecay(sessionId: string): Promise<void> {
    for (const [key, levels] of this.trainingLevels) {
      if (!key.startsWith(sessionId)) continue;

      // 활성 훈련 중이면 감소 스킵
      const [, fleetId, unitId] = key.split('-');
      const trainingKey = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
      if (this.activeTrainings.has(trainingKey)) continue;

      // 각 훈련 유형별 감소
      for (const type of Object.values(EffectTrainingType)) {
        const current = levels[type] || 50;
        const decayRate = DECAY_RATES[type];
        
        // 기본 레벨(50) 이하로는 감소하지 않음
        if (current > 50) {
          const decay = Math.min(decayRate, current - 50);
          levels[type] = current - decay;
        }
      }

      this.trainingLevels.set(key, levels);
    }

    logger.debug(`[TrainingEffectService] Monthly decay processed for session ${sessionId}`);
  }

  /**
   * 특정 유닛의 훈련도 감소
   */
  public decayTraining(
    sessionId: string,
    fleetId: string,
    unitId: string | undefined,
    type: EffectTrainingType,
    amount: number,
  ): number {
    const key = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    const levels = this.trainingLevels.get(key) || this.getDefaultLevels();
    
    const current = levels[type] || 50;
    const newLevel = Math.max(MIN_TRAINING_LEVEL, current - amount);
    levels[type] = newLevel;
    
    this.trainingLevels.set(key, levels);
    
    return newLevel;
  }

  // ============================================================
  // 일일 훈련 진행
  // ============================================================

  /**
   * 일일 훈련 진행 처리
   */
  private async processDailyTraining(sessionId: string): Promise<void> {
    for (const [key, training] of this.activeTrainings) {
      if (!key.startsWith(sessionId) || !training.isActive) continue;

      training.elapsedDays++;
      training.progress = Math.min(100, (training.elapsedDays / training.scheduledDuration) * 100);

      const typeDef = TRAINING_TYPE_DEFINITIONS[training.type];
      const intensityMod = INTENSITY_MULTIPLIERS[training.intensity];

      // 1. 훈련도 증가
      let dailyGain = typeDef.baseGainPerDay * intensityMod.gainMod;
      if (training.instructor) {
        dailyGain *= (1 + training.instructor.skill / 100);
      }

      // 현재 레벨 확인 및 효율 조정
      const currentLevel = this.getTrainingLevel(
        training.sessionId,
        training.fleetId,
        training.unitId,
        training.type,
      );
      
      if (currentLevel > 80) dailyGain *= 0.5;
      else if (currentLevel > 60) dailyGain *= 0.75;

      // 특수 훈련 보너스
      if (training.type === EffectTrainingType.SPECIALIZED && training.specializedType) {
        const specDef = SPECIALIZED_DEFINITIONS[training.specializedType];
        dailyGain *= specDef.bonusMultiplier;
      }

      training.results.totalGain += dailyGain;

      // 2. 이벤트 체크
      // 사고 체크
      if (this.rollChance(typeDef.accidentBaseRate * intensityMod.accidentMod)) {
        training.results.accidents++;
        training.results.events.push({
          timestamp: new Date(),
          type: 'ACCIDENT',
          description: '훈련 중 사고 발생',
          effect: -dailyGain * 0.5,
        });
        dailyGain *= 0.5;
      }

      // 돌파 체크
      if (this.rollChance(typeDef.breakthroughRate * intensityMod.breakthroughMod)) {
        training.results.breakthroughs++;
        training.results.events.push({
          timestamp: new Date(),
          type: 'BREAKTHROUGH',
          description: '훈련 돌파!',
          effect: dailyGain,
        });
        dailyGain *= 2;
      }

      // 3. 훈련도 적용
      this.setTrainingLevel(
        training.sessionId,
        training.fleetId,
        training.unitId,
        training.type,
        currentLevel + dailyGain,
      );

      // 4. 훈련 완료 체크
      if (training.elapsedDays >= training.scheduledDuration) {
        await this.stopTraining(training.sessionId, training.fleetId, training.unitId);
      } else {
        this.activeTrainings.set(key, training);
      }
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private rollChance(percentage: number): boolean {
    return Math.random() * 100 < percentage;
  }

  private getDefaultLevels(): Record<EffectTrainingType, number> {
    return {
      [EffectTrainingType.BASIC]: 50,
      [EffectTrainingType.COMBAT]: 50,
      [EffectTrainingType.TACTICAL]: 50,
      [EffectTrainingType.SPECIALIZED]: 50,
    };
  }

  private getEmptyEffect(): TrainingEffect {
    return {
      trainingGain: 0,
      experienceGain: 0,
      moraleChange: 0,
      skillChance: 0,
      accidentRisk: 0,
      fatigueIncrease: 0,
      bonuses: { combat: 0, navigation: 0, repair: 0 },
    };
  }

  // ============================================================
  // 훈련도 관리
  // ============================================================

  /**
   * 훈련도 조회
   */
  public getTrainingLevel(
    sessionId: string,
    fleetId: string,
    unitId: string | undefined,
    type: EffectTrainingType,
  ): number {
    const key = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    const levels = this.trainingLevels.get(key);
    return levels?.[type] || 50;
  }

  /**
   * 훈련도 설정
   */
  public setTrainingLevel(
    sessionId: string,
    fleetId: string,
    unitId: string | undefined,
    type: EffectTrainingType,
    level: number,
  ): void {
    const key = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    let levels = this.trainingLevels.get(key);
    
    if (!levels) {
      levels = this.getDefaultLevels();
    }
    
    levels[type] = Math.max(MIN_TRAINING_LEVEL, Math.min(MAX_TRAINING_LEVEL, level));
    this.trainingLevels.set(key, levels);
  }

  /**
   * 전체 훈련도 조회
   */
  public getAllTrainingLevels(
    sessionId: string,
    fleetId: string,
    unitId?: string,
  ): Record<EffectTrainingType, number> {
    const key = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    return this.trainingLevels.get(key) || this.getDefaultLevels();
  }

  // ============================================================
  // 전투력 보너스 계산
  // ============================================================

  /**
   * 훈련도에 따른 전투 보너스 계산
   */
  public getCombatBonus(sessionId: string, fleetId: string, unitId?: string): number {
    const combatLevel = this.getTrainingLevel(sessionId, fleetId, unitId, EffectTrainingType.COMBAT);
    const tacticalLevel = this.getTrainingLevel(sessionId, fleetId, unitId, EffectTrainingType.TACTICAL);
    
    const combatMod = (combatLevel - 50) * 0.01;
    const tacticalMod = (tacticalLevel - 50) * 0.005;
    
    return combatMod + tacticalMod;
  }

  /**
   * 훈련도에 따른 항해 보너스 계산
   */
  public getNavigationBonus(sessionId: string, fleetId: string, unitId?: string): number {
    const basicLevel = this.getTrainingLevel(sessionId, fleetId, unitId, EffectTrainingType.BASIC);
    const tacticalLevel = this.getTrainingLevel(sessionId, fleetId, unitId, EffectTrainingType.TACTICAL);
    
    return ((basicLevel + tacticalLevel) / 2 - 50) * 0.01;
  }

  /**
   * 훈련도에 따른 종합 효율 계산
   */
  public getOverallEfficiency(sessionId: string, fleetId: string, unitId?: string): number {
    const levels = this.getAllTrainingLevels(sessionId, fleetId, unitId);
    const avg = Object.values(levels).reduce((sum, v) => sum + v, 0) / Object.keys(levels).length;
    
    return avg / 100;
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 훈련 유형 정의 조회
   */
  public getEffectTrainingTypeDefinition(type: EffectTrainingType): TrainingDefinition {
    return TRAINING_TYPE_DEFINITIONS[type];
  }

  /**
   * 전체 훈련 유형 목록
   */
  public getAllEffectTrainingTypes(): typeof TRAINING_TYPE_DEFINITIONS {
    return TRAINING_TYPE_DEFINITIONS;
  }

  /**
   * 특수 훈련 정의 조회
   */
  public getSpecializedDefinition(type: SpecializedEffectTrainingType): typeof SPECIALIZED_DEFINITIONS[SpecializedEffectTrainingType] {
    return SPECIALIZED_DEFINITIONS[type];
  }

  /**
   * 전체 특수 훈련 목록
   */
  public getAllSpecializedTypes(): typeof SPECIALIZED_DEFINITIONS {
    return SPECIALIZED_DEFINITIONS;
  }

  /**
   * 활성 훈련 조회
   */
  public getActiveTraining(sessionId: string, fleetId: string, unitId?: string): TrainingState | undefined {
    const key = `${sessionId}-${fleetId}${unitId ? `-${unitId}` : ''}`;
    return this.activeTrainings.get(key);
  }

  /**
   * 강도 배율 조회
   */
  public getIntensityMultipliers(intensity: TrainingIntensity): typeof INTENSITY_MULTIPLIERS[TrainingIntensity] {
    return INTENSITY_MULTIPLIERS[intensity];
  }
}

export const trainingEffectService = TrainingEffectService.getInstance();
export default TrainingEffectService;

