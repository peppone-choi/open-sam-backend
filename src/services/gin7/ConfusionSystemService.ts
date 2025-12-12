/**
 * ConfusionSystemService - 혼란 시스템 서비스
 * 
 * 유닛의 혼란(Confusion) 상태를 관리합니다.
 * - ConfusionLevel: NONE, MINOR, MODERATE, SEVERE, ROUTED
 * - 혼란 발생 조건, 혼란 전파 (인접 유닛), 회복 시도
 * 
 * Note: 기존 ConfusionService를 확장한 버전
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// ============================================================
// Confusion Types & Constants
// ============================================================

/**
 * 혼란 레벨
 */
export enum ConfusionLevel {
  NONE = 'NONE',           // 정상 - 보정 없음
  MINOR = 'MINOR',         // 경미 - 일부 명령 지연
  MODERATE = 'MODERATE',   // 보통 - 명령 지연 및 일부 무시
  SEVERE = 'SEVERE',       // 심각 - 명령 무시, 무질서
  ROUTED = 'ROUTED',       // 패주 - 통제 불능, 도주
}

/**
 * 혼란 레벨별 효과
 */
export interface ConfusionEffect {
  commandDelay: number;         // 명령 지연 (틱)
  commandIgnoreChance: number;  // 명령 무시 확률 (0-1)
  attackMod: number;            // 공격력 배율
  defenseMod: number;           // 방어력 배율
  accuracyMod: number;          // 명중률 배율
  evasionMod: number;           // 회피율 배율
  speedMod: number;             // 이동속도 배율
  spreadChance: number;         // 인접 유닛 전파 확률
  duration: number;             // 기본 지속 시간 (틱)
  recoveryDifficulty: number;   // 회복 난이도 (높을수록 어려움)
  description: string;          // 상태 설명
}

/**
 * 혼란 레벨별 효과 정의
 */
export const CONFUSION_LEVEL_EFFECTS: Record<ConfusionLevel, ConfusionEffect> = {
  [ConfusionLevel.NONE]: {
    commandDelay: 0,
    commandIgnoreChance: 0,
    attackMod: 1.0,
    defenseMod: 1.0,
    accuracyMod: 1.0,
    evasionMod: 1.0,
    speedMod: 1.0,
    spreadChance: 0,
    duration: 0,
    recoveryDifficulty: 0,
    description: '정상 상태',
  },
  [ConfusionLevel.MINOR]: {
    commandDelay: 2,
    commandIgnoreChance: 0.1,
    attackMod: 0.9,
    defenseMod: 0.9,
    accuracyMod: 0.9,
    evasionMod: 0.95,
    speedMod: 0.95,
    spreadChance: 0.05,
    duration: 30,
    recoveryDifficulty: 1,
    description: '경미한 혼란. 명령 지연 발생',
  },
  [ConfusionLevel.MODERATE]: {
    commandDelay: 4,
    commandIgnoreChance: 0.25,
    attackMod: 0.75,
    defenseMod: 0.75,
    accuracyMod: 0.75,
    evasionMod: 0.8,
    speedMod: 0.85,
    spreadChance: 0.15,
    duration: 45,
    recoveryDifficulty: 2,
    description: '보통 혼란. 명령 무시 가능성',
  },
  [ConfusionLevel.SEVERE]: {
    commandDelay: 6,
    commandIgnoreChance: 0.5,
    attackMod: 0.5,
    defenseMod: 0.55,
    accuracyMod: 0.6,
    evasionMod: 0.6,
    speedMod: 0.7,
    spreadChance: 0.3,
    duration: 60,
    recoveryDifficulty: 3,
    description: '심각한 혼란. 명령 무시 빈번',
  },
  [ConfusionLevel.ROUTED]: {
    commandDelay: 10,
    commandIgnoreChance: 0.9,
    attackMod: 0.2,
    defenseMod: 0.3,
    accuracyMod: 0.2,
    evasionMod: 0.4,
    speedMod: 1.5,  // 도주 속도 증가
    spreadChance: 0.5,
    duration: 120,
    recoveryDifficulty: 5,
    description: '패주 상태! 통제 불능, 도주 중',
  },
};

/**
 * 혼란 발생 트리거
 */
export enum ConfusionTriggerType {
  HEAVY_CASUALTIES = 'HEAVY_CASUALTIES',       // 급격한 손실 (30%+ 피해)
  CRITICAL_CASUALTIES = 'CRITICAL_CASUALTIES', // 치명적 손실 (50%+ 피해)
  COMMANDER_KILLED = 'COMMANDER_KILLED',       // 지휘관 전사
  FLAGSHIP_DESTROYED = 'FLAGSHIP_DESTROYED',   // 기함 격침
  SURROUNDED = 'SURROUNDED',                   // 포위됨
  ALLY_ROUTED = 'ALLY_ROUTED',                 // 인접 아군 패주
  CRITICAL_MORALE = 'CRITICAL_MORALE',         // 사기 위험 상태
  AMBUSH = 'AMBUSH',                           // 기습 당함
  ELECTRONIC_WARFARE = 'ELECTRONIC_WARFARE',   // 전자전 피해
  SUPPLY_CUT = 'SUPPLY_CUT',                   // 보급선 차단
  COMMUNICATION_LOST = 'COMMUNICATION_LOST',   // 통신 두절
}

/**
 * 혼란 트리거별 초기 혼란 레벨
 */
export const CONFUSION_TRIGGER_RESULTS: Record<ConfusionTriggerType, ConfusionLevel> = {
  [ConfusionTriggerType.HEAVY_CASUALTIES]: ConfusionLevel.MODERATE,
  [ConfusionTriggerType.CRITICAL_CASUALTIES]: ConfusionLevel.SEVERE,
  [ConfusionTriggerType.COMMANDER_KILLED]: ConfusionLevel.SEVERE,
  [ConfusionTriggerType.FLAGSHIP_DESTROYED]: ConfusionLevel.ROUTED,
  [ConfusionTriggerType.SURROUNDED]: ConfusionLevel.MODERATE,
  [ConfusionTriggerType.ALLY_ROUTED]: ConfusionLevel.MINOR,
  [ConfusionTriggerType.CRITICAL_MORALE]: ConfusionLevel.MINOR,
  [ConfusionTriggerType.AMBUSH]: ConfusionLevel.SEVERE,
  [ConfusionTriggerType.ELECTRONIC_WARFARE]: ConfusionLevel.MINOR,
  [ConfusionTriggerType.SUPPLY_CUT]: ConfusionLevel.MINOR,
  [ConfusionTriggerType.COMMUNICATION_LOST]: ConfusionLevel.MODERATE,
};

/**
 * 혼란 트리거 조건 정의
 */
export interface ConfusionTriggerCondition {
  type: ConfusionTriggerType;
  threshold?: number;           // 발생 임계값 (손실 비율 등)
  probability: number;          // 발생 확률 (0-1)
  resultLevel: ConfusionLevel;  // 결과 혼란 레벨
}

/**
 * 유닛 혼란 상태
 */
export interface UnitConfusionData {
  unitId: string;
  level: ConfusionLevel;
  trigger?: ConfusionTriggerType;
  
  // 지속 시간
  startTick: number;
  remainingTicks: number;
  
  // 회복
  recoveryProgress: number;      // 0-1 (회복 진행도)
  recoveryAttempts: number;      // 회복 시도 횟수
  lastRecoveryTick: number;
  
  // 전파 면역
  spreadImmunityTicks: number;
  
  // 위치 정보 (전파 계산용)
  position?: { x: number; y: number; z: number };
  factionId?: string;
}

/**
 * 혼란 변경 이벤트
 */
export interface ConfusionChangeEventData {
  unitId: string;
  previousLevel: ConfusionLevel;
  newLevel: ConfusionLevel;
  trigger?: ConfusionTriggerType;
  timestamp: number;
}

/**
 * 혼란 전파 이벤트
 */
export interface ConfusionSpreadEventData {
  sourceUnitId: string;
  targetUnitId: string;
  spreadLevel: ConfusionLevel;
  distance: number;
  timestamp: number;
}

/**
 * 회복 시도 결과
 */
export interface RecoveryAttemptResult {
  success: boolean;
  previousLevel: ConfusionLevel;
  newLevel: ConfusionLevel;
  recoveryProgress: number;
  message: string;
}

// ============================================================
// Constants
// ============================================================

export const CONFUSION_CONSTANTS = {
  SPREAD_CHECK_INTERVAL: 10,     // 전파 확인 간격 (틱)
  SPREAD_RADIUS: 150,            // 전파 범위 (거리 단위)
  RECOVERY_INTERVAL: 15,         // 회복 시도 간격 (틱)
  BASE_RECOVERY_CHANCE: 0.2,     // 기본 회복 확률
  IMMUNITY_AFTER_RECOVERY: 60,   // 회복 후 면역 시간 (틱)
  MAX_RECOVERY_ATTEMPTS: 5,      // 최대 회복 시도 횟수 (보너스)
  HEAVY_CASUALTY_THRESHOLD: 0.3, // 급격한 손실 기준 (30%)
  CRITICAL_CASUALTY_THRESHOLD: 0.5, // 치명적 손실 기준 (50%)
};

// ============================================================
// ConfusionSystemService Class
// ============================================================

export class ConfusionSystemService extends EventEmitter {
  // 유닛별 혼란 상태
  private confusionData: Map<string, UnitConfusionData> = new Map();
  
  // 유닛 세력 캐시 (전파용)
  private unitFactions: Map<string, string> = new Map();
  
  // 유닛 위치 캐시 (전파용)
  private unitPositions: Map<string, { x: number; y: number; z: number }> = new Map();
  
  constructor() {
    super();
    logger.info('[ConfusionSystemService] Initialized');
  }
  
  // ============================================================
  // Initialization
  // ============================================================
  
  /**
   * 유닛 혼란 상태 초기화
   */
  initializeConfusion(
    unitId: string,
    factionId: string,
    position?: { x: number; y: number; z: number }
  ): UnitConfusionData {
    const data: UnitConfusionData = {
      unitId,
      level: ConfusionLevel.NONE,
      startTick: 0,
      remainingTicks: 0,
      recoveryProgress: 0,
      recoveryAttempts: 0,
      lastRecoveryTick: 0,
      spreadImmunityTicks: 0,
      position,
      factionId,
    };
    
    this.confusionData.set(unitId, data);
    this.unitFactions.set(unitId, factionId);
    
    if (position) {
      this.unitPositions.set(unitId, position);
    }
    
    return data;
  }
  
  /**
   * 배치 초기화
   */
  initializeConfusionBatch(
    units: Array<{
      unitId: string;
      factionId: string;
      position?: { x: number; y: number; z: number };
    }>
  ): void {
    for (const unit of units) {
      this.initializeConfusion(unit.unitId, unit.factionId, unit.position);
    }
    logger.info('[ConfusionSystemService] Batch initialized', { count: units.length });
  }
  
  /**
   * 유닛 위치 업데이트
   */
  updateUnitPosition(unitId: string, position: { x: number; y: number; z: number }): void {
    this.unitPositions.set(unitId, position);
    const data = this.confusionData.get(unitId);
    if (data) {
      data.position = position;
    }
  }
  
  // ============================================================
  // Confusion Trigger Check
  // ============================================================
  
  /**
   * 혼란 발생 조건 체크
   */
  checkConfusionTrigger(
    unitId: string,
    conditions: {
      casualtyRatio?: number;         // 손실 비율 (0-1)
      commanderKilled?: boolean;
      flagshipDestroyed?: boolean;
      isSurrounded?: boolean;
      hasRoutedAllyNearby?: boolean;
      moraleState?: string;           // 'CRITICAL' 등
      isAmbushed?: boolean;
      ewDamage?: boolean;             // 전자전 피해
      supplyStatus?: 'CUT' | 'LOW' | 'NORMAL';
      communicationLost?: boolean;
    },
    currentTick: number
  ): {
    triggered: boolean;
    trigger?: ConfusionTriggerType;
    resultLevel?: ConfusionLevel;
  } {
    const data = this.confusionData.get(unitId);
    if (!data) {
      return { triggered: false };
    }
    
    // 이미 패주 상태면 스킵
    if (data.level === ConfusionLevel.ROUTED) {
      return { triggered: false };
    }
    
    // 전파 면역 체크
    if (data.spreadImmunityTicks > 0) {
      return { triggered: false };
    }
    
    // 우선순위 높은 트리거부터 체크
    
    // 기함 격침 -> 패주
    if (conditions.flagshipDestroyed) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.FLAGSHIP_DESTROYED, currentTick);
    }
    
    // 기습 당함 -> 심각
    if (conditions.isAmbushed) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.AMBUSH, currentTick);
    }
    
    // 지휘관 전사 -> 심각
    if (conditions.commanderKilled) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.COMMANDER_KILLED, currentTick);
    }
    
    // 치명적 손실 (50%+) -> 심각
    if (conditions.casualtyRatio && conditions.casualtyRatio >= CONFUSION_CONSTANTS.CRITICAL_CASUALTY_THRESHOLD) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.CRITICAL_CASUALTIES, currentTick);
    }
    
    // 급격한 손실 (30%+) -> 보통
    if (conditions.casualtyRatio && conditions.casualtyRatio >= CONFUSION_CONSTANTS.HEAVY_CASUALTY_THRESHOLD) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.HEAVY_CASUALTIES, currentTick);
    }
    
    // 통신 두절 -> 보통
    if (conditions.communicationLost) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.COMMUNICATION_LOST, currentTick);
    }
    
    // 포위됨 -> 보통
    if (conditions.isSurrounded) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.SURROUNDED, currentTick);
    }
    
    // 아군 패주 -> 경미
    if (conditions.hasRoutedAllyNearby) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.ALLY_ROUTED, currentTick);
    }
    
    // 사기 위기 -> 경미
    if (conditions.moraleState === 'CRITICAL') {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.CRITICAL_MORALE, currentTick);
    }
    
    // 보급선 차단 -> 경미
    if (conditions.supplyStatus === 'CUT') {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.SUPPLY_CUT, currentTick);
    }
    
    // 전자전 피해 -> 경미
    if (conditions.ewDamage) {
      return this.applyConfusionTrigger(unitId, ConfusionTriggerType.ELECTRONIC_WARFARE, currentTick);
    }
    
    return { triggered: false };
  }
  
  /**
   * 혼란 트리거 적용
   */
  private applyConfusionTrigger(
    unitId: string,
    trigger: ConfusionTriggerType,
    currentTick: number
  ): {
    triggered: boolean;
    trigger?: ConfusionTriggerType;
    resultLevel?: ConfusionLevel;
  } {
    const data = this.confusionData.get(unitId);
    if (!data) return { triggered: false };
    
    const resultLevel = CONFUSION_TRIGGER_RESULTS[trigger];
    
    // 더 심각한 혼란으로만 전환
    if (this.getLevelSeverity(resultLevel) <= this.getLevelSeverity(data.level)) {
      return { triggered: false };
    }
    
    const previousLevel = data.level;
    
    // 혼란 상태 설정
    data.level = resultLevel;
    data.trigger = trigger;
    data.startTick = currentTick;
    data.remainingTicks = CONFUSION_LEVEL_EFFECTS[resultLevel].duration;
    data.recoveryProgress = 0;
    data.recoveryAttempts = 0;
    
    // 이벤트 발생
    this.emit('CONFUSION_TRIGGERED', {
      unitId,
      previousLevel,
      newLevel: resultLevel,
      trigger,
      timestamp: Date.now(),
    } as ConfusionChangeEventData);
    
    logger.info('[ConfusionSystemService] Confusion triggered', {
      unitId,
      trigger,
      level: resultLevel,
    });
    
    // 패주 시 추가 이벤트
    if (resultLevel === ConfusionLevel.ROUTED) {
      this.emit('UNIT_ROUTED', { unitId, trigger });
    }
    
    return { triggered: true, trigger, resultLevel };
  }
  
  // ============================================================
  // Confusion Spread
  // ============================================================
  
  /**
   * 혼란 전파
   */
  spreadConfusion(currentTick: number): ConfusionSpreadEventData[] {
    const spreadEvents: ConfusionSpreadEventData[] = [];
    
    // 전파 체크 간격
    if (currentTick % CONFUSION_CONSTANTS.SPREAD_CHECK_INTERVAL !== 0) {
      return spreadEvents;
    }
    
    // 혼란 상태(SEVERE 또는 ROUTED)의 유닛 찾기
    const confusedUnits: Array<{
      unitId: string;
      factionId: string;
      position: { x: number; y: number; z: number };
      level: ConfusionLevel;
    }> = [];
    
    for (const [unitId, data] of this.confusionData) {
      if (data.level === ConfusionLevel.SEVERE || data.level === ConfusionLevel.ROUTED) {
        const position = this.unitPositions.get(unitId);
        const factionId = this.unitFactions.get(unitId);
        
        if (position && factionId) {
          confusedUnits.push({ unitId, factionId, position, level: data.level });
        }
      }
    }
    
    // 각 혼란 유닛에서 인접 아군에게 전파
    for (const confused of confusedUnits) {
      const spreadChance = CONFUSION_LEVEL_EFFECTS[confused.level].spreadChance;
      
      // 범위 내 아군 찾기
      for (const [targetId, targetData] of this.confusionData) {
        if (targetId === confused.unitId) continue;
        if (targetData.spreadImmunityTicks > 0) continue;
        if (targetData.level !== ConfusionLevel.NONE && targetData.level !== ConfusionLevel.MINOR) continue;
        
        const targetFaction = this.unitFactions.get(targetId);
        if (targetFaction !== confused.factionId) continue;
        
        const targetPosition = this.unitPositions.get(targetId);
        if (!targetPosition) continue;
        
        // 거리 계산
        const distance = this.calculateDistance(confused.position, targetPosition);
        if (distance > CONFUSION_CONSTANTS.SPREAD_RADIUS) continue;
        
        // 전파 확률 체크 (거리가 가까울수록 높음)
        const distanceFactor = 1 - (distance / CONFUSION_CONSTANTS.SPREAD_RADIUS);
        const actualChance = spreadChance * distanceFactor;
        
        if (Math.random() < actualChance) {
          // 전파 - 한 단계 낮은 혼란
          const spreadLevel = confused.level === ConfusionLevel.ROUTED
            ? ConfusionLevel.SEVERE
            : ConfusionLevel.MODERATE;
          
          // 기존 혼란보다 심각한 경우만 적용
          if (this.getLevelSeverity(spreadLevel) > this.getLevelSeverity(targetData.level)) {
            const previousLevel = targetData.level;
            
            targetData.level = spreadLevel;
            targetData.trigger = ConfusionTriggerType.ALLY_ROUTED;
            targetData.startTick = currentTick;
            targetData.remainingTicks = CONFUSION_LEVEL_EFFECTS[spreadLevel].duration;
            targetData.recoveryProgress = 0;
            
            const spreadEvent: ConfusionSpreadEventData = {
              sourceUnitId: confused.unitId,
              targetUnitId: targetId,
              spreadLevel,
              distance,
              timestamp: Date.now(),
            };
            
            spreadEvents.push(spreadEvent);
            this.emit('CONFUSION_SPREAD', spreadEvent);
            
            logger.info('[ConfusionSystemService] Confusion spread', {
              from: confused.unitId,
              to: targetId,
              level: spreadLevel,
              distance,
            });
          }
        }
      }
    }
    
    return spreadEvents;
  }
  
  // ============================================================
  // Recovery
  // ============================================================
  
  /**
   * 회복 시도
   */
  attemptRecovery(
    unitId: string,
    options?: {
      commanderLeadership?: number;  // 지휘관 리더십 (0-100)
      cpSpent?: number;              // 투입한 CP
      rallyCommand?: boolean;        // Rally 명령 사용 여부
    }
  ): RecoveryAttemptResult {
    const data = this.confusionData.get(unitId);
    
    if (!data) {
      return {
        success: false,
        previousLevel: ConfusionLevel.NONE,
        newLevel: ConfusionLevel.NONE,
        recoveryProgress: 0,
        message: '유닛을 찾을 수 없습니다.',
      };
    }
    
    // 정상 상태면 회복 불필요
    if (data.level === ConfusionLevel.NONE) {
      return {
        success: true,
        previousLevel: ConfusionLevel.NONE,
        newLevel: ConfusionLevel.NONE,
        recoveryProgress: 1,
        message: '이미 정상 상태입니다.',
      };
    }
    
    const effect = CONFUSION_LEVEL_EFFECTS[data.level];
    const previousLevel = data.level;
    
    // 회복 확률 계산
    let recoveryChance = CONFUSION_CONSTANTS.BASE_RECOVERY_CHANCE;
    
    // 리더십 보너스
    if (options?.commanderLeadership) {
      recoveryChance += (options.commanderLeadership - 50) / 200; // 50 기준으로 ±25%
    }
    
    // CP 투입 보너스
    if (options?.cpSpent) {
      recoveryChance += options.cpSpent * 0.01; // CP 1당 1%
    }
    
    // Rally 명령 보너스
    if (options?.rallyCommand) {
      recoveryChance += 0.2;
    }
    
    // 회복 시도 횟수 보너스
    const attemptBonus = Math.min(data.recoveryAttempts, CONFUSION_CONSTANTS.MAX_RECOVERY_ATTEMPTS) * 0.05;
    recoveryChance += attemptBonus;
    
    // 난이도에 따른 감소
    recoveryChance /= effect.recoveryDifficulty;
    
    // 최소/최대 제한
    recoveryChance = Math.max(0.05, Math.min(0.9, recoveryChance));
    
    data.recoveryAttempts++;
    
    // 회복 성공 체크
    if (Math.random() < recoveryChance) {
      // 한 단계 회복
      const newLevel = this.getPreviousLevel(data.level);
      
      data.level = newLevel;
      data.recoveryProgress = 0;
      data.recoveryAttempts = 0;
      
      // 완전 회복 시 면역 부여
      if (newLevel === ConfusionLevel.NONE) {
        data.spreadImmunityTicks = CONFUSION_CONSTANTS.IMMUNITY_AFTER_RECOVERY;
        data.trigger = undefined;
      } else {
        // 다음 레벨의 지속 시간 설정
        data.remainingTicks = CONFUSION_LEVEL_EFFECTS[newLevel].duration;
      }
      
      this.emit('CONFUSION_RECOVERED', {
        unitId,
        previousLevel,
        newLevel,
        timestamp: Date.now(),
      } as ConfusionChangeEventData);
      
      logger.info('[ConfusionSystemService] Recovery successful', {
        unitId,
        from: previousLevel,
        to: newLevel,
      });
      
      return {
        success: true,
        previousLevel,
        newLevel,
        recoveryProgress: 1,
        message: `혼란 회복: ${this.getLevelName(previousLevel)} → ${this.getLevelName(newLevel)}`,
      };
    }
    
    // 회복 실패 - 진행도만 증가
    data.recoveryProgress = Math.min(1, data.recoveryProgress + 0.15);
    
    return {
      success: false,
      previousLevel,
      newLevel: previousLevel,
      recoveryProgress: data.recoveryProgress,
      message: `회복 시도 실패 (진행도: ${Math.floor(data.recoveryProgress * 100)}%)`,
    };
  }
  
  /**
   * 강제 회복 (디버그/특수 능력)
   */
  forceRecover(unitId: string, targetLevel: ConfusionLevel = ConfusionLevel.NONE): boolean {
    const data = this.confusionData.get(unitId);
    if (!data) return false;
    
    const previousLevel = data.level;
    
    data.level = targetLevel;
    data.remainingTicks = targetLevel === ConfusionLevel.NONE ? 0 : CONFUSION_LEVEL_EFFECTS[targetLevel].duration;
    data.recoveryProgress = 0;
    data.recoveryAttempts = 0;
    data.spreadImmunityTicks = CONFUSION_CONSTANTS.IMMUNITY_AFTER_RECOVERY;
    
    if (targetLevel === ConfusionLevel.NONE) {
      data.trigger = undefined;
    }
    
    if (previousLevel !== targetLevel) {
      this.emit('CONFUSION_RECOVERED', {
        unitId,
        previousLevel,
        newLevel: targetLevel,
        timestamp: Date.now(),
      } as ConfusionChangeEventData);
    }
    
    return true;
  }
  
  // ============================================================
  // Tick Update
  // ============================================================
  
  /**
   * 틱 업데이트
   */
  updateTick(currentTick: number): void {
    for (const [unitId, data] of this.confusionData) {
      // 전파 면역 감소
      if (data.spreadImmunityTicks > 0) {
        data.spreadImmunityTicks--;
      }
      
      // 정상 상태면 스킵
      if (data.level === ConfusionLevel.NONE) continue;
      
      // 남은 시간 감소
      data.remainingTicks--;
      
      // 시간 만료 시 자동 회복 (한 단계)
      if (data.remainingTicks <= 0) {
        this.attemptRecovery(unitId);
      }
    }
    
    // 전파 처리
    this.spreadConfusion(currentTick);
  }
  
  // ============================================================
  // Queries
  // ============================================================
  
  /**
   * 혼란 상태 조회
   */
  getConfusionData(unitId: string): UnitConfusionData | undefined {
    return this.confusionData.get(unitId);
  }
  
  /**
   * 혼란 레벨 조회
   */
  getConfusionLevel(unitId: string): ConfusionLevel {
    return this.confusionData.get(unitId)?.level ?? ConfusionLevel.NONE;
  }
  
  /**
   * 혼란 효과 조회
   */
  getConfusionEffect(unitId: string): ConfusionEffect {
    const data = this.confusionData.get(unitId);
    if (!data) return CONFUSION_LEVEL_EFFECTS[ConfusionLevel.NONE];
    return CONFUSION_LEVEL_EFFECTS[data.level];
  }
  
  /**
   * 패주 상태인지 확인
   */
  isRouted(unitId: string): boolean {
    return this.confusionData.get(unitId)?.level === ConfusionLevel.ROUTED;
  }
  
  /**
   * 혼란 상태인지 확인
   */
  isConfused(unitId: string): boolean {
    const level = this.confusionData.get(unitId)?.level;
    return level !== undefined && level !== ConfusionLevel.NONE;
  }
  
  /**
   * 명령 무시 체크
   */
  checkCommandIgnored(unitId: string): boolean {
    const data = this.confusionData.get(unitId);
    if (!data || data.level === ConfusionLevel.NONE) return false;
    
    const effect = CONFUSION_LEVEL_EFFECTS[data.level];
    return Math.random() < effect.commandIgnoreChance;
  }
  
  /**
   * 명령 지연 틱 조회
   */
  getCommandDelay(unitId: string): number {
    const data = this.confusionData.get(unitId);
    if (!data) return 0;
    return CONFUSION_LEVEL_EFFECTS[data.level].commandDelay;
  }
  
  /**
   * 세력별 혼란 통계
   */
  getConfusionStats(factionId: string): {
    total: number;
    none: number;
    minor: number;
    moderate: number;
    severe: number;
    routed: number;
  } {
    const stats = { total: 0, none: 0, minor: 0, moderate: 0, severe: 0, routed: 0 };
    
    for (const [unitId, data] of this.confusionData) {
      const unitFaction = this.unitFactions.get(unitId);
      if (unitFaction !== factionId) continue;
      
      stats.total++;
      switch (data.level) {
        case ConfusionLevel.NONE: stats.none++; break;
        case ConfusionLevel.MINOR: stats.minor++; break;
        case ConfusionLevel.MODERATE: stats.moderate++; break;
        case ConfusionLevel.SEVERE: stats.severe++; break;
        case ConfusionLevel.ROUTED: stats.routed++; break;
      }
    }
    
    return stats;
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 혼란 레벨 심각도 반환
   */
  private getLevelSeverity(level: ConfusionLevel): number {
    const severities: Record<ConfusionLevel, number> = {
      [ConfusionLevel.NONE]: 0,
      [ConfusionLevel.MINOR]: 1,
      [ConfusionLevel.MODERATE]: 2,
      [ConfusionLevel.SEVERE]: 3,
      [ConfusionLevel.ROUTED]: 4,
    };
    return severities[level];
  }
  
  /**
   * 이전 레벨 반환
   */
  private getPreviousLevel(level: ConfusionLevel): ConfusionLevel {
    const levels: ConfusionLevel[] = [
      ConfusionLevel.NONE,
      ConfusionLevel.MINOR,
      ConfusionLevel.MODERATE,
      ConfusionLevel.SEVERE,
      ConfusionLevel.ROUTED,
    ];
    const index = levels.indexOf(level);
    return index > 0 ? levels[index - 1] : ConfusionLevel.NONE;
  }
  
  /**
   * 거리 계산
   */
  private calculateDistance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * 레벨 이름 조회
   */
  getLevelName(level: ConfusionLevel): string {
    const names: Record<ConfusionLevel, string> = {
      [ConfusionLevel.NONE]: '정상',
      [ConfusionLevel.MINOR]: '경미한 혼란',
      [ConfusionLevel.MODERATE]: '보통 혼란',
      [ConfusionLevel.SEVERE]: '심각한 혼란',
      [ConfusionLevel.ROUTED]: '패주',
    };
    return names[level];
  }
  
  /**
   * 유닛 상태 제거
   */
  removeConfusionData(unitId: string): void {
    this.confusionData.delete(unitId);
    this.unitFactions.delete(unitId);
    this.unitPositions.delete(unitId);
  }
  
  /**
   * 세션 정리
   */
  clearSession(): void {
    this.confusionData.clear();
    this.unitFactions.clear();
    this.unitPositions.clear();
    logger.info('[ConfusionSystemService] Session cleared');
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.clearSession();
    this.removeAllListeners();
    logger.info('[ConfusionSystemService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const confusionSystemService = new ConfusionSystemService();








