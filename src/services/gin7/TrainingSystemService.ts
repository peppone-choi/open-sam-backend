/**
 * TrainingSystemService - 훈련 시스템
 * 
 * 기능:
 * - 훈련도 파라미터 (0-100)
 * - 훈련 효과 계산
 * - 전투 경험 → 훈련도 변환
 * - 훈련 이벤트 (사고, 돌파)
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

/**
 * 훈련 상태
 */
export interface TrainingStatus {
  level: number;              // 0-100 훈련도
  experience: number;         // 누적 경험치
  lastTrainedAt: Date;
  instructorBonus: number;    // 교관 보너스 (0-50)
}

/**
 * 훈련 유형
 */
export enum TrainingSkillType {
  BASIC = 'BASIC',             // 기본 훈련
  COMBAT = 'COMBAT',           // 전투 훈련
  NAVIGATION = 'NAVIGATION',   // 항해 훈련
  TACTICAL = 'TACTICAL',       // 전술 훈련
  ENGINEERING = 'ENGINEERING', // 정비 훈련
  MEDICAL = 'MEDICAL',         // 의무 훈련
  GROUND = 'GROUND',           // 육전 훈련
  SPECIAL_OPS = 'SPECIAL_OPS', // 특수작전 훈련
}

/**
 * 훈련 이벤트 유형
 */
export enum TrainingEventType {
  ACCIDENT = 'ACCIDENT',           // 사고
  BREAKTHROUGH = 'BREAKTHROUGH',   // 돌파
  EXCEPTIONAL = 'EXCEPTIONAL',     // 우수 성과
  INJURY = 'INJURY',               // 부상
  MORALE_BOOST = 'MORALE_BOOST',   // 사기 상승
  MORALE_DROP = 'MORALE_DROP',     // 사기 하락
}

/**
 * 훈련 이벤트
 */
export interface TrainingEvent {
  eventId: string;
  type: TrainingEventType;
  fleetId: string;
  unitId?: string;
  description: string;
  effects: {
    trainingChange?: number;
    moraleChange?: number;
    casualtyCount?: number;
    experienceBonus?: number;
  };
  timestamp: Date;
}

/**
 * 훈련 세션
 */
export interface TrainingSession {
  sessionId: string;
  fleetId: string;
  trainingType: TrainingSkillType;
  startedAt: Date;
  duration: number;             // 일 수
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  instructorId?: string;
  progress: number;             // 0-100
  events: TrainingEvent[];
  isActive: boolean;
}

// ============================================================
// 훈련 유형별 정의
// ============================================================

const TRAINING_DEFINITIONS: Record<TrainingSkillType, {
  name: string;
  nameKo: string;
  baseGain: number;           // 기본 훈련도 증가량 (일당)
  moraleChange: number;       // 기본 사기 변화
  accidentRate: number;       // 사고 확률 (%)
  breakthroughRate: number;   // 돌파 확률 (%)
  requiredFacility?: string;  // 필요 시설
  effects: {
    combatBonus: number;
    navigationBonus: number;
    repairBonus: number;
    moraleRecovery: number;
  };
}> = {
  [TrainingSkillType.BASIC]: {
    name: 'Basic Training',
    nameKo: '기본 훈련',
    baseGain: 0.5,
    moraleChange: -1,
    accidentRate: 1,
    breakthroughRate: 2,
    effects: {
      combatBonus: 0.05,
      navigationBonus: 0.05,
      repairBonus: 0.05,
      moraleRecovery: 0.1,
    },
  },
  [TrainingSkillType.COMBAT]: {
    name: 'Combat Training',
    nameKo: '전투 훈련',
    baseGain: 0.8,
    moraleChange: -2,
    accidentRate: 3,
    breakthroughRate: 5,
    effects: {
      combatBonus: 0.15,
      navigationBonus: 0.02,
      repairBonus: 0,
      moraleRecovery: 0.05,
    },
  },
  [TrainingSkillType.NAVIGATION]: {
    name: 'Navigation Training',
    nameKo: '항해 훈련',
    baseGain: 0.6,
    moraleChange: 0,
    accidentRate: 2,
    breakthroughRate: 3,
    effects: {
      combatBonus: 0,
      navigationBonus: 0.15,
      repairBonus: 0.05,
      moraleRecovery: 0.1,
    },
  },
  [TrainingSkillType.TACTICAL]: {
    name: 'Tactical Training',
    nameKo: '전술 훈련',
    baseGain: 0.4,
    moraleChange: -1,
    accidentRate: 2,
    breakthroughRate: 8,
    effects: {
      combatBonus: 0.1,
      navigationBonus: 0.05,
      repairBonus: 0,
      moraleRecovery: 0.05,
    },
  },
  [TrainingSkillType.ENGINEERING]: {
    name: 'Engineering Training',
    nameKo: '정비 훈련',
    baseGain: 0.5,
    moraleChange: 0,
    accidentRate: 4,
    breakthroughRate: 4,
    effects: {
      combatBonus: 0,
      navigationBonus: 0,
      repairBonus: 0.2,
      moraleRecovery: 0.1,
    },
  },
  [TrainingSkillType.MEDICAL]: {
    name: 'Medical Training',
    nameKo: '의무 훈련',
    baseGain: 0.4,
    moraleChange: 2,
    accidentRate: 1,
    breakthroughRate: 3,
    effects: {
      combatBonus: 0,
      navigationBonus: 0,
      repairBonus: 0,
      moraleRecovery: 0.2,
    },
  },
  [TrainingSkillType.GROUND]: {
    name: 'Ground Combat Training',
    nameKo: '육전 훈련',
    baseGain: 0.7,
    moraleChange: -2,
    accidentRate: 5,
    breakthroughRate: 4,
    effects: {
      combatBonus: 0.1,
      navigationBonus: 0,
      repairBonus: 0,
      moraleRecovery: 0.05,
    },
  },
  [TrainingSkillType.SPECIAL_OPS]: {
    name: 'Special Operations Training',
    nameKo: '특수작전 훈련',
    baseGain: 0.3,
    moraleChange: -3,
    accidentRate: 8,
    breakthroughRate: 10,
    effects: {
      combatBonus: 0.2,
      navigationBonus: 0.1,
      repairBonus: 0,
      moraleRecovery: 0,
    },
  },
};

// 강도별 배율
const INTENSITY_MULTIPLIER: Record<'LOW' | 'MEDIUM' | 'HIGH', {
  gainMultiplier: number;
  moraleMultiplier: number;
  accidentMultiplier: number;
  breakthroughMultiplier: number;
}> = {
  LOW: {
    gainMultiplier: 0.5,
    moraleMultiplier: 0.5,
    accidentMultiplier: 0.3,
    breakthroughMultiplier: 0.5,
  },
  MEDIUM: {
    gainMultiplier: 1.0,
    moraleMultiplier: 1.0,
    accidentMultiplier: 1.0,
    breakthroughMultiplier: 1.0,
  },
  HIGH: {
    gainMultiplier: 1.5,
    moraleMultiplier: 2.0,
    accidentMultiplier: 2.0,
    breakthroughMultiplier: 1.5,
  },
};

// 최대/최소 훈련도
const MIN_TRAINING = 0;
const MAX_TRAINING = 100;

// 훈련도 자연 감소율 (월당)
const NATURAL_DECAY_RATE = 2;

// ============================================================
// Request/Response Types
// ============================================================

export interface StartTrainingRequest {
  sessionId: string;
  fleetId: string;
  trainingType: TrainingSkillType;
  duration: number;             // 예정 훈련 일수
  intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  instructorId?: string;
}

export interface StartTrainingResult {
  success: boolean;
  trainingSession?: TrainingSession;
  estimatedGain: number;
  estimatedRisks: {
    accidentChance: number;
    moraleImpact: number;
  };
  error?: string;
}

export interface TrainingProgressResult {
  fleetId: string;
  currentLevel: number;
  previousLevel: number;
  gain: number;
  events: TrainingEvent[];
  isComplete: boolean;
}

// ============================================================
// TrainingSystemService Class
// ============================================================

export class TrainingSystemService extends EventEmitter {
  private static instance: TrainingSystemService;
  
  // 활성 훈련 세션
  private activeSessions: Map<string, TrainingSession> = new Map();
  
  // 훈련 히스토리
  private trainingHistory: Map<string, TrainingEvent[]> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[TrainingSystemService] Initialized');
  }

  public static getInstance(): TrainingSystemService {
    if (!TrainingSystemService.instance) {
      TrainingSystemService.instance = new TrainingSystemService();
    }
    return TrainingSystemService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 월 시작 시 훈련도 자연 감소
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.processMonthlyDecay(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[TrainingSystemService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 훈련 시작/종료
  // ============================================================

  /**
   * 훈련 시작
   */
  public async startTraining(request: StartTrainingRequest): Promise<StartTrainingResult> {
    const { sessionId, fleetId, trainingType, duration, intensity, instructorId } = request;

    // 1. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return {
        success: false,
        estimatedGain: 0,
        estimatedRisks: { accidentChance: 0, moraleImpact: 0 },
        error: '함대를 찾을 수 없습니다.',
      };
    }

    // 2. 이미 훈련 중인지 확인
    const sessionKey = `${sessionId}-${fleetId}`;
    if (this.activeSessions.has(sessionKey)) {
      return {
        success: false,
        estimatedGain: 0,
        estimatedRisks: { accidentChance: 0, moraleImpact: 0 },
        error: '이미 훈련 중입니다.',
      };
    }

    // 3. 함대 상태 확인
    if (fleet.status !== 'IDLE' && fleet.status !== 'DOCKED') {
      return {
        success: false,
        estimatedGain: 0,
        estimatedRisks: { accidentChance: 0, moraleImpact: 0 },
        error: '함대가 대기 또는 정박 상태여야 합니다.',
      };
    }

    // 4. 교관 보너스 계산
    let instructorBonus = 0;
    if (instructorId) {
      const instructor = await Gin7Character.findOne({ sessionId, characterId: instructorId });
      if (instructor) {
        instructorBonus = this.calculateInstructorBonus(instructor, trainingType);
      }
    }

    // 5. 예상 효과 계산
    const trainingDef = TRAINING_DEFINITIONS[trainingType];
    const intensityMod = INTENSITY_MULTIPLIER[intensity];
    
    const estimatedGain = trainingDef.baseGain * intensityMod.gainMultiplier * duration * (1 + instructorBonus / 100);
    const accidentChance = trainingDef.accidentRate * intensityMod.accidentMultiplier;
    const moraleImpact = trainingDef.moraleChange * intensityMod.moraleMultiplier * duration;

    // 6. 훈련 세션 생성
    const trainingSession: TrainingSession = {
      sessionId,
      fleetId,
      trainingType,
      startedAt: new Date(),
      duration,
      intensity,
      instructorId,
      progress: 0,
      events: [],
      isActive: true,
    };

    this.activeSessions.set(sessionKey, trainingSession);

    // 7. 함대 상태 변경
    fleet.status = 'REORG';
    fleet.statusData = { training: true, trainingType };
    await fleet.save();

    // 8. 이벤트 발생
    this.emit('training:started', {
      sessionId,
      fleetId,
      trainingType,
      duration,
      intensity,
      estimatedGain,
    });

    logger.info(`[TrainingSystemService] Fleet ${fleetId} started ${trainingType} training for ${duration} days`);

    return {
      success: true,
      trainingSession,
      estimatedGain,
      estimatedRisks: {
        accidentChance,
        moraleImpact,
      },
    };
  }

  /**
   * 훈련 종료
   */
  public async stopTraining(sessionId: string, fleetId: string): Promise<{
    success: boolean;
    finalResult?: TrainingProgressResult;
    error?: string;
  }> {
    const sessionKey = `${sessionId}-${fleetId}`;
    const session = this.activeSessions.get(sessionKey);
    
    if (!session) {
      return { success: false, error: '활성 훈련 세션이 없습니다.' };
    }

    // 최종 결과 계산
    const result = await this.processTrainingDay(sessionId, fleetId, true);

    // 세션 종료
    session.isActive = false;
    this.activeSessions.delete(sessionKey);

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
      trainingType: session.trainingType,
      totalGain: result?.gain || 0,
      events: session.events,
    });

    logger.info(`[TrainingSystemService] Fleet ${fleetId} completed training`);

    return {
      success: true,
      finalResult: result,
    };
  }

  // ============================================================
  // 훈련 진행
  // ============================================================

  /**
   * 일일 훈련 진행
   */
  public async processTrainingDay(
    sessionId: string,
    fleetId: string,
    isComplete: boolean = false,
  ): Promise<TrainingProgressResult | null> {
    const sessionKey = `${sessionId}-${fleetId}`;
    const session = this.activeSessions.get(sessionKey);
    
    if (!session || !session.isActive) return null;

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return null;

    // 1. 훈련 정의 가져오기
    const trainingDef = TRAINING_DEFINITIONS[session.trainingType];
    const intensityMod = INTENSITY_MULTIPLIER[session.intensity];

    // 2. 현재 훈련도 가져오기
    const currentTraining = this.getFleetTrainingLevel(fleet, session.trainingType);
    const previousLevel = currentTraining;

    // 3. 교관 보너스
    let instructorBonus = 0;
    if (session.instructorId) {
      const instructor = await Gin7Character.findOne({ sessionId, characterId: session.instructorId });
      if (instructor) {
        instructorBonus = this.calculateInstructorBonus(instructor, session.trainingType);
      }
    }

    // 4. 훈련도 증가 계산
    let gain = trainingDef.baseGain * intensityMod.gainMultiplier * (1 + instructorBonus / 100);
    
    // 높은 훈련도에서는 효율 감소
    if (currentTraining > 80) {
      gain *= 0.5;
    } else if (currentTraining > 60) {
      gain *= 0.75;
    }

    // 5. 이벤트 체크
    const events: TrainingEvent[] = [];

    // 사고 체크
    if (this.rollChance(trainingDef.accidentRate * intensityMod.accidentMultiplier)) {
      const accidentEvent = this.generateAccidentEvent(session, fleet);
      events.push(accidentEvent);
      session.events.push(accidentEvent);
      
      // 사고 효과 적용
      gain *= 0.5;
      await this.applyEventEffects(fleet, accidentEvent);
    }

    // 돌파 체크
    if (this.rollChance(trainingDef.breakthroughRate * intensityMod.breakthroughMultiplier)) {
      const breakthroughEvent = this.generateBreakthroughEvent(session, fleet);
      events.push(breakthroughEvent);
      session.events.push(breakthroughEvent);
      
      // 돌파 효과 적용
      gain *= 2;
      await this.applyEventEffects(fleet, breakthroughEvent);
    }

    // 6. 훈련도 적용
    const newLevel = Math.min(MAX_TRAINING, Math.max(MIN_TRAINING, currentTraining + gain));
    this.setFleetTrainingLevel(fleet, session.trainingType, newLevel);

    // 7. 사기 변화
    const moraleChange = trainingDef.moraleChange * intensityMod.moraleMultiplier;
    for (const unit of fleet.units) {
      unit.morale = Math.max(0, Math.min(100, unit.morale + moraleChange));
    }

    // 8. 진행도 업데이트
    session.progress += 100 / session.duration;
    if (session.progress >= 100) {
      session.progress = 100;
    }

    await fleet.save();
    this.activeSessions.set(sessionKey, session);

    // 9. 이벤트 발생
    if (events.length > 0) {
      this.emit('training:event', {
        sessionId,
        fleetId,
        events,
      });
    }

    return {
      fleetId,
      currentLevel: newLevel,
      previousLevel,
      gain: newLevel - previousLevel,
      events,
      isComplete: session.progress >= 100 || isComplete,
    };
  }

  // ============================================================
  // 전투 경험 → 훈련도 변환
  // ============================================================

  /**
   * 전투 경험을 훈련도로 변환
   */
  public async convertCombatExperience(
    sessionId: string,
    fleetId: string,
    combatData: {
      victory: boolean;
      enemiesDestroyed: number;
      damageDealt: number;
      damageTaken: number;
      duration: number;         // 전투 지속 턴
    },
  ): Promise<{
    combatTrainingGain: number;
    tacticalTrainingGain: number;
    veterancyGain: number;
  }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { combatTrainingGain: 0, tacticalTrainingGain: 0, veterancyGain: 0 };
    }

    // 1. 기본 경험치 계산
    let baseExp = combatData.victory ? 15 : 8;
    baseExp += combatData.enemiesDestroyed * 2;
    baseExp += Math.floor(combatData.damageDealt / 1000);
    baseExp -= Math.floor(combatData.damageTaken / 2000);
    baseExp = Math.max(5, baseExp);

    // 2. 전투 훈련도 증가
    const combatTrainingGain = baseExp * 0.3;
    const currentCombat = this.getFleetTrainingLevel(fleet, TrainingSkillType.COMBAT);
    this.setFleetTrainingLevel(fleet, TrainingSkillType.COMBAT, 
      Math.min(MAX_TRAINING, currentCombat + combatTrainingGain));

    // 3. 전술 훈련도 증가 (승리 시 추가)
    let tacticalTrainingGain = 0;
    if (combatData.victory) {
      tacticalTrainingGain = baseExp * 0.2;
      const currentTactical = this.getFleetTrainingLevel(fleet, TrainingSkillType.TACTICAL);
      this.setFleetTrainingLevel(fleet, TrainingSkillType.TACTICAL,
        Math.min(MAX_TRAINING, currentTactical + tacticalTrainingGain));
    }

    // 4. 베테랑시 증가
    const veterancyGain = baseExp * 0.1;
    for (const unit of fleet.units) {
      unit.veterancy = Math.min(100, (unit.veterancy || 0) + veterancyGain);
    }

    await fleet.save();

    // 5. 이벤트 발생
    this.emit('training:combatExperience', {
      sessionId,
      fleetId,
      combatTrainingGain,
      tacticalTrainingGain,
      veterancyGain,
      victory: combatData.victory,
    });

    logger.info(`[TrainingSystemService] Fleet ${fleetId} gained combat experience: +${combatTrainingGain.toFixed(1)} combat, +${tacticalTrainingGain.toFixed(1)} tactical`);

    return {
      combatTrainingGain,
      tacticalTrainingGain,
      veterancyGain,
    };
  }

  // ============================================================
  // 훈련 이벤트 생성
  // ============================================================

  /**
   * 사고 이벤트 생성
   */
  private generateAccidentEvent(session: TrainingSession, fleet: IFleet): TrainingEvent {
    const severity = Math.random();
    let type: TrainingEventType;
    let description: string;
    let effects: TrainingEvent['effects'];

    if (severity > 0.8) {
      // 심각한 사고 (20%)
      type = TrainingEventType.INJURY;
      const casualties = Math.floor(Math.random() * 5) + 1;
      description = `훈련 중 심각한 사고 발생. ${casualties}명 부상.`;
      effects = {
        trainingChange: -5,
        moraleChange: -10,
        casualtyCount: casualties,
      };
    } else if (severity > 0.5) {
      // 일반 사고 (30%)
      type = TrainingEventType.ACCIDENT;
      description = '훈련 중 경미한 사고 발생. 훈련 효율 감소.';
      effects = {
        trainingChange: -2,
        moraleChange: -5,
      };
    } else {
      // 사기 저하 (50%)
      type = TrainingEventType.MORALE_DROP;
      description = '과도한 훈련으로 인한 피로 누적.';
      effects = {
        moraleChange: -8,
      };
    }

    return {
      eventId: `EVENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      fleetId: fleet.fleetId,
      description,
      effects,
      timestamp: new Date(),
    };
  }

  /**
   * 돌파 이벤트 생성
   */
  private generateBreakthroughEvent(session: TrainingSession, fleet: IFleet): TrainingEvent {
    const quality = Math.random();
    let type: TrainingEventType;
    let description: string;
    let effects: TrainingEvent['effects'];

    if (quality > 0.7) {
      // 탁월한 성과 (30%)
      type = TrainingEventType.EXCEPTIONAL;
      description = '훈련에서 탁월한 성과! 전체 부대 역량 향상.';
      effects = {
        trainingChange: 10,
        moraleChange: 10,
        experienceBonus: 20,
      };
    } else if (quality > 0.4) {
      // 돌파 (30%)
      type = TrainingEventType.BREAKTHROUGH;
      description = '새로운 전술/기술 습득!';
      effects = {
        trainingChange: 5,
        experienceBonus: 10,
      };
    } else {
      // 사기 상승 (40%)
      type = TrainingEventType.MORALE_BOOST;
      description = '훈련 성과로 부대 사기 상승.';
      effects = {
        moraleChange: 15,
      };
    }

    return {
      eventId: `EVENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      fleetId: fleet.fleetId,
      description,
      effects,
      timestamp: new Date(),
    };
  }

  /**
   * 이벤트 효과 적용
   */
  private async applyEventEffects(fleet: IFleet, event: TrainingEvent): Promise<void> {
    const { effects } = event;

    // 사기 변화
    if (effects.moraleChange) {
      for (const unit of fleet.units) {
        unit.morale = Math.max(0, Math.min(100, unit.morale + effects.moraleChange));
      }
    }

    // 사상자 (크루 감소)
    if (effects.casualtyCount) {
      for (const unit of fleet.units) {
        const reduction = Math.ceil(effects.casualtyCount / fleet.units.length);
        unit.crewCount = Math.max(0, unit.crewCount - reduction);
      }
    }
  }

  // ============================================================
  // 월간 처리
  // ============================================================

  /**
   * 월간 훈련도 자연 감소
   */
  private async processMonthlyDecay(sessionId: string): Promise<void> {
    const fleets = await Fleet.find({ sessionId });

    for (const fleet of fleets) {
      // 활성 훈련 중이 아니면 자연 감소
      const sessionKey = `${sessionId}-${fleet.fleetId}`;
      if (this.activeSessions.has(sessionKey)) continue;

      // 각 훈련 유형별 감소
      let hasDecay = false;
      for (const trainingType of Object.values(TrainingSkillType)) {
        const current = this.getFleetTrainingLevel(fleet, trainingType);
        if (current > 30) { // 30 이하로는 감소하지 않음
          const decay = Math.min(NATURAL_DECAY_RATE, current - 30);
          this.setFleetTrainingLevel(fleet, trainingType, current - decay);
          hasDecay = true;
        }
      }

      if (hasDecay) {
        await fleet.save();
      }
    }

    logger.debug(`[TrainingSystemService] Monthly decay processed for session ${sessionId}`);
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * 교관 보너스 계산
   */
  private calculateInstructorBonus(instructor: IGin7Character, trainingType: TrainingSkillType): number {
    // 기본 능력치 기반
    let relevantStat = 50;
    
    switch (trainingType) {
      case TrainingSkillType.COMBAT:
      case TrainingSkillType.GROUND:
        relevantStat = instructor.stats.might;
        break;
      case TrainingSkillType.TACTICAL:
      case TrainingSkillType.NAVIGATION:
        relevantStat = instructor.stats.command;
        break;
      case TrainingSkillType.ENGINEERING:
      case TrainingSkillType.MEDICAL:
        relevantStat = instructor.stats.intellect;
        break;
      default:
        relevantStat = (instructor.stats.command + instructor.stats.intellect) / 2;
    }

    // 매력 (교육 능력)
    const charm = instructor.stats.charm || 50;
    
    // 0-50 범위의 보너스
    return Math.floor((relevantStat * 0.6 + charm * 0.4) / 2);
  }

  /**
   * 확률 체크
   */
  private rollChance(percentage: number): boolean {
    return Math.random() * 100 < percentage;
  }

  /**
   * 함대 훈련도 가져오기
   */
  private getFleetTrainingLevel(fleet: IFleet, trainingType: TrainingSkillType): number {
    // @ts-ignore - data 필드 사용
    const trainingData = fleet.data?.training || {};
    return trainingData[trainingType] || 50; // 기본값 50
  }

  /**
   * 함대 훈련도 설정
   */
  private setFleetTrainingLevel(fleet: IFleet, trainingType: TrainingSkillType, level: number): void {
    if (!fleet.data) fleet.data = {};
    // @ts-ignore - data 필드 사용
    if (!fleet.data.training) fleet.data.training = {};
    // @ts-ignore
    fleet.data.training[trainingType] = Math.round(level * 10) / 10; // 소수점 1자리
  }

  // ============================================================
  // 훈련 효과 계산
  // ============================================================

  /**
   * 훈련도에 따른 전투 보너스 계산
   */
  public calculateCombatBonus(fleet: IFleet): number {
    const combatTraining = this.getFleetTrainingLevel(fleet, TrainingSkillType.COMBAT);
    const tacticalTraining = this.getFleetTrainingLevel(fleet, TrainingSkillType.TACTICAL);
    
    // 기본 50 기준으로 보너스/페널티
    const combatMod = (combatTraining - 50) * 0.01; // -0.5 ~ +0.5
    const tacticalMod = (tacticalTraining - 50) * 0.005; // -0.25 ~ +0.25
    
    return combatMod + tacticalMod;
  }

  /**
   * 훈련도에 따른 항해 보너스 계산
   */
  public calculateNavigationBonus(fleet: IFleet): number {
    const navTraining = this.getFleetTrainingLevel(fleet, TrainingSkillType.NAVIGATION);
    return (navTraining - 50) * 0.01; // -0.5 ~ +0.5
  }

  /**
   * 훈련도에 따른 수리 보너스 계산
   */
  public calculateRepairBonus(fleet: IFleet): number {
    const engTraining = this.getFleetTrainingLevel(fleet, TrainingSkillType.ENGINEERING);
    return (engTraining - 50) * 0.01; // -0.5 ~ +0.5
  }

  /**
   * 훈련도에 따른 사기 회복 보너스 계산
   */
  public calculateMoraleRecoveryBonus(fleet: IFleet): number {
    const medTraining = this.getFleetTrainingLevel(fleet, TrainingSkillType.MEDICAL);
    const basicTraining = this.getFleetTrainingLevel(fleet, TrainingSkillType.BASIC);
    
    const medMod = (medTraining - 50) * 0.01;
    const basicMod = (basicTraining - 50) * 0.005;
    
    return medMod + basicMod;
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 함대 훈련 상태 조회
   */
  public async getFleetTrainingStatus(sessionId: string, fleetId: string): Promise<{
    training: Record<TrainingSkillType, number>;
    activeSession?: TrainingSession;
    bonuses: {
      combat: number;
      navigation: number;
      repair: number;
      moraleRecovery: number;
    };
  } | null> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return null;

    const training: Record<TrainingSkillType, number> = {} as Record<TrainingSkillType, number>;
    for (const type of Object.values(TrainingSkillType)) {
      training[type] = this.getFleetTrainingLevel(fleet, type);
    }

    const sessionKey = `${sessionId}-${fleetId}`;
    const activeSession = this.activeSessions.get(sessionKey);

    return {
      training,
      activeSession,
      bonuses: {
        combat: this.calculateCombatBonus(fleet),
        navigation: this.calculateNavigationBonus(fleet),
        repair: this.calculateRepairBonus(fleet),
        moraleRecovery: this.calculateMoraleRecoveryBonus(fleet),
      },
    };
  }

  /**
   * 훈련 정의 조회
   */
  public getTrainingDefinition(trainingType: TrainingSkillType): typeof TRAINING_DEFINITIONS[TrainingSkillType] {
    return TRAINING_DEFINITIONS[trainingType];
  }

  /**
   * 전체 훈련 유형 조회
   */
  public getAllTrainingSkillTypes(): typeof TRAINING_DEFINITIONS {
    return TRAINING_DEFINITIONS;
  }

  /**
   * 활성 훈련 세션 조회
   */
  public getActiveSession(sessionId: string, fleetId: string): TrainingSession | undefined {
    const key = `${sessionId}-${fleetId}`;
    return this.activeSessions.get(key);
  }

  /**
   * 훈련 이력 조회
   */
  public getTrainingHistory(sessionId: string, fleetId: string): TrainingEvent[] {
    const key = `${sessionId}-${fleetId}`;
    return this.trainingHistory.get(key) || [];
  }
}

export const trainingSystemService = TrainingSystemService.getInstance();
export default TrainingSystemService;





