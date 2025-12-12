/**
 * 작전 계획 시스템 정의 (Operation Planning System Definitions)
 * 매뉴얼 1798~1895행 기반
 */

/**
 * 작전 타입 코드
 */
export enum OperationType {
  OCCUPATION = 'OCCUPATION',   // 점령 작전
  DEFENSE = 'DEFENSE',         // 방어 작전
  MOPUP = 'MOPUP',             // 소탕 작전
}

/**
 * 작전 상태
 */
export enum OperationStatus {
  PLANNED = 'PLANNED',         // 계획됨 (발동 대기)
  ACTIVE = 'ACTIVE',           // 발동됨 (부대 배정됨)
  IN_PROGRESS = 'IN_PROGRESS', // 진행 중 (목표 도달)
  SUCCESS = 'SUCCESS',         // 성공
  FAILURE = 'FAILURE',         // 실패
  CANCELLED = 'CANCELLED',     // 취소됨
}

/**
 * 작전 타입 정의 인터페이스
 */
export interface OperationTypeDefinition {
  type: OperationType;
  nameKo: string;
  nameJp: string;
  nameEn: string;
  description: string;
  durationGameDays: number;      // 작전 기간 (게임일)
  targetType: 'ENEMY_SYSTEM' | 'FRIENDLY_SYSTEM' | 'ANY_SYSTEM';
  validUnitTypes: ('FLEET' | 'TRANSPORT' | 'PATROL' | 'SOLO')[];
  successConditions: string[];
  partialSuccessConditions: string[];
  meritMultiplier: number;       // 기본 공적 보너스 배율
  partialMeritMultiplier: number; // 부분 성공 시 배율
}

/**
 * 작전 타입 정의 테이블
 */
export const OPERATION_TYPE_DEFINITIONS: Record<OperationType, OperationTypeDefinition> = {
  [OperationType.OCCUPATION]: {
    type: OperationType.OCCUPATION,
    nameKo: '점령 작전',
    nameJp: '占領作戦',
    nameEn: 'Occupation Operation',
    description: '적 성계의 모든 행성/요새를 점령하는 것을 목표로 하는 작전.',
    durationGameDays: 30,
    targetType: 'ENEMY_SYSTEM',
    validUnitTypes: ['FLEET', 'TRANSPORT', 'PATROL'],
    successConditions: [
      '작전 목표 성계 내 모든 행성/요새를 자군이 지배',
    ],
    partialSuccessConditions: [
      '작전 목표 성계 내 최소 1개 행성/요새를 자군이 지배',
    ],
    meritMultiplier: 1.0,
    partialMeritMultiplier: 0.5,
  },
  [OperationType.DEFENSE]: {
    type: OperationType.DEFENSE,
    nameKo: '방어 작전',
    nameJp: '防衛作戦',
    nameEn: 'Defense Operation',
    description: '아군 성계의 행성/요새를 적으로부터 방어하는 것을 목표로 하는 작전.',
    durationGameDays: 30,
    targetType: 'FRIENDLY_SYSTEM',
    validUnitTypes: ['FLEET', 'TRANSPORT', 'PATROL'],
    successConditions: [
      '작전 목표 성계 내 모든 행성/요새가 자군 지배 상태 유지',
    ],
    partialSuccessConditions: [
      '작전 목표 성계 내 최소 1개 행성/요새가 적에게 점령됨',
    ],
    meritMultiplier: 1.0,
    partialMeritMultiplier: 0.5,
  },
  [OperationType.MOPUP]: {
    type: OperationType.MOPUP,
    nameKo: '소탕 작전',
    nameJp: '掃討作戦',
    nameEn: 'Mop-up Operation',
    description: '특정 성계 주변의 적 유닛을 격파하는 것을 목표로 하는 작전. 독행함 전용.',
    durationGameDays: 30,
    targetType: 'ANY_SYSTEM',
    validUnitTypes: ['SOLO'],
    successConditions: [
      '지정 성계로부터 400광년 이내에서 적 함선 격침',
    ],
    partialSuccessConditions: [],
    meritMultiplier: 0.1, // 1척당 보너스
    partialMeritMultiplier: 0,
  },
};

/**
 * 작전 계획 CP 비용 계산
 * 발동 예정 시기에 따라 변동 (10~1280)
 */
export function calculateOperationPlanningCost(
  activationDelayHours: number, // 발동까지 대기 시간 (게임 시간)
  fleetCount: number            // 참여 함대 수
): number {
  // 기본 비용: 10 CP
  // 대기 시간이 짧을수록 비용 증가
  // 참여 함대 수에 비례하여 비용 증가
  
  const baseCost = 10;
  const urgencyMultiplier = Math.max(1, Math.floor(720 / Math.max(activationDelayHours, 1)));
  const fleetMultiplier = Math.max(1, fleetCount);
  
  return Math.min(1280, baseCost * urgencyMultiplier * fleetMultiplier);
}

/**
 * 작전 발령 CP 비용 계산
 */
export function calculateOperationIssuanceCost(fleetCount: number): number {
  // 1~320 범위
  return Math.min(320, Math.max(1, fleetCount * 10));
}

/**
 * 작전 성공 시 공적 보너스 계산
 */
export function calculateOperationMeritBonus(
  operationType: OperationType,
  isFullSuccess: boolean,
  participantCount: number,
  enemiesDestroyed: number = 0
): number {
  const typeDef = OPERATION_TYPE_DEFINITIONS[operationType];
  if (!typeDef) return 0;
  
  if (operationType === OperationType.MOPUP) {
    // 소탕 작전: 격침당 보너스
    return Math.floor(enemiesDestroyed * typeDef.meritMultiplier * 100);
  }
  
  // 점령/방어 작전: 참여자 수 기반
  const baseBonus = 500;
  const multiplier = isFullSuccess ? typeDef.meritMultiplier : typeDef.partialMeritMultiplier;
  const perCapitaBonus = Math.floor(baseBonus * multiplier / Math.max(1, participantCount));
  
  return perCapitaBonus;
}

/**
 * 쿠데타 상태 코드
 */
export enum CoupStatus {
  PLOTTING = 'PLOTTING',       // 모의 중
  RECRUITING = 'RECRUITING',   // 참가자 모집 중
  READY = 'READY',             // 실행 준비 완료
  ACTIVE = 'ACTIVE',           // 진행 중 (반란)
  SUCCESS = 'SUCCESS',         // 성공
  FAILURE = 'FAILURE',         // 실패
  SUPPRESSED = 'SUPPRESSED',   // 진압됨
}

/**
 * 쿠데타 참가자 역할
 */
export enum CoupRole {
  MASTERMIND = 'MASTERMIND',   // 수괴
  CONSPIRATOR = 'CONSPIRATOR', // 공모자
  SYMPATHIZER = 'SYMPATHIZER', // 동조자
}

/**
 * 쿠데타 관련 상수
 */
export const COUP_CONSTANTS = {
  MIN_CONSPIRATORS_FOR_UPRISING: 3,       // 반란 실행 최소 참가자 수
  MIN_LOYALTY_FOR_UPRISING: 70,           // 반란 실행 최소 평균 충성도
  CONSPIRACY_SUCCESS_BASE: 50,            // 모의 기본 성공률 (%)
  PERSUASION_LOYALTY_INCREASE: 10,        // 설득 성공 시 충성도 증가량
  INSPECTION_DETECTION_BASE: 30,          // 사열 기본 탐지율 (%)
  ARREST_SUCCESS_BASE: 60,                // 체포 기본 성공률 (%)
  MASTERMIND_CP_COST: 640,                // 반의 CP 비용
  CONSPIRACY_CP_COST: 640,                // 모의 CP 비용
  PERSUASION_CP_COST: 640,                // 설득 CP 비용
  UPRISING_CP_COST: 640,                  // 반란 CP 비용
  JOIN_CP_COST: 160,                      // 참가 CP 비용
};

/**
 * 쿠데타 성공 확률 계산
 */
export function calculateCoupSuccessChance(
  mastermindInfluence: number,
  conspiratorsCount: number,
  avgLoyalty: number,
  targetPlanetSupport: number     // 대상 행성의 정부 지지율
): number {
  // 기본 성공률
  let chance = 20;
  
  // 영향력 보너스 (최대 +30)
  chance += Math.min(30, mastermindInfluence / 10);
  
  // 참가자 수 보너스 (최대 +20)
  chance += Math.min(20, conspiratorsCount * 5);
  
  // 충성도 보너스 (최대 +20)
  chance += Math.min(20, (avgLoyalty - 50) / 2.5);
  
  // 지지율 페널티 (지지율이 높으면 성공률 감소)
  chance -= Math.max(0, (targetPlanetSupport - 50) / 2);
  
  return Math.max(5, Math.min(95, chance));
}

/**
 * 모의 성공 확률 계산
 */
export function calculateConspiracySuccessChance(
  mastermindCharm: number,
  mastermindInfluence: number,
  targetCharm: number,
  targetLoyalty: number           // 대상의 현 체제 충성도
): number {
  let chance = COUP_CONSTANTS.CONSPIRACY_SUCCESS_BASE;
  
  // 수괴 매력 보너스
  chance += (mastermindCharm - 50) / 2;
  
  // 수괴 영향력 보너스
  chance += mastermindInfluence / 10;
  
  // 대상 매력 페널티 (높은 매력은 설득하기 어려움)
  chance -= (targetCharm - 50) / 4;
  
  // 대상 충성도 페널티
  chance -= (targetLoyalty - 50) / 2;
  
  return Math.max(5, Math.min(95, chance));
}

/**
 * 체포 성공 확률 계산
 */
export function calculateArrestSuccessChance(
  arrestorIntelligence: number,
  targetIntelligence: number,
  sameLocation: boolean
): number {
  let chance = COUP_CONSTANTS.ARREST_SUCCESS_BASE;
  
  // 정보 스탯 차이
  chance += (arrestorIntelligence - targetIntelligence) / 2;
  
  // 같은 위치면 보너스
  if (sameLocation) {
    chance += 20;
  }
  
  return Math.max(10, Math.min(95, chance));
}







