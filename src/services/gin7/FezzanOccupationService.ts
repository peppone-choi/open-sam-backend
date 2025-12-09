/**
 * FezzanOccupationService - 페잔 점령 시스템
 * 매뉴얼 1901-1904행:
 * "『銀河英雄伝説Ⅶ』では、フェザーン自治領は中立となっています。
 * いずれかの陣営がフェザーンの中立を侵犯したり、武力占領を行ったりした場合は、
 * 特別なペナルティが与えられます(フェザーン占領は現在未実装となっております)"
 *
 * 페잔은 양 진영 사이의 중립국으로, 중립 침범 시 특별 페널티가 적용됩니다.
 * 이 시스템은 페잔 점령의 전략적 결정과 그에 따른 결과를 관리합니다.
 */

import { EventEmitter } from 'events';
import { Planet } from '../../models/gin7/Planet';
import { Gin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

/**
 * 페잔 상태
 */
export enum FezzanStatus {
  NEUTRAL = 'NEUTRAL',             // 중립 (정상)
  THREATENED = 'THREATENED',       // 위협 받음 (군함 접근)
  BLOCKADED = 'BLOCKADED',         // 봉쇄됨
  OCCUPIED_EMPIRE = 'OCCUPIED_EMPIRE',     // 제국 점령
  OCCUPIED_ALLIANCE = 'OCCUPIED_ALLIANCE', // 동맹 점령
  LIBERATED = 'LIBERATED',         // 해방됨 (중립 복원)
}

/**
 * 중립 침범 유형
 */
export enum ViolationType {
  MILITARY_PRESENCE = 'MILITARY_PRESENCE',   // 군함 진입
  BLOCKADE = 'BLOCKADE',                     // 항로 봉쇄
  BOMBARDMENT = 'BOMBARDMENT',               // 포격
  INVASION = 'INVASION',                     // 침공
  OCCUPATION = 'OCCUPATION',                 // 점령
  ECONOMIC_SANCTION = 'ECONOMIC_SANCTION',   // 경제 제재
}

/**
 * 페널티 유형
 */
export enum PenaltyType {
  DIPLOMATIC_CONDEMNATION = 'DIPLOMATIC_CONDEMNATION', // 외교적 비난
  TRADE_DISRUPTION = 'TRADE_DISRUPTION',               // 무역 중단
  ECONOMIC_DAMAGE = 'ECONOMIC_DAMAGE',                 // 경제적 피해
  REPUTATION_LOSS = 'REPUTATION_LOSS',                 // 명성 하락
  INSURGENCY = 'INSURGENCY',                           // 저항 운동
  THIRD_PARTY_INTERVENTION = 'THIRD_PARTY_INTERVENTION', // 제3세력 개입
}

/**
 * 중립 침범 기록
 */
export interface NeutralityViolation {
  violationId: string;
  sessionId: string;
  violatorFaction: string;
  type: ViolationType;
  severity: number;              // 심각도 (1-10)
  timestamp: Date;
  description: string;
  penaltiesApplied: AppliedPenalty[];
}

/**
 * 적용된 페널티
 */
export interface AppliedPenalty {
  penaltyId: string;
  type: PenaltyType;
  amount: number;                // 수치적 영향
  duration?: number;             // 지속 기간 (일)
  description: string;
  appliedAt: Date;
  expiresAt?: Date;
}

/**
 * 페잔 상태 정보
 */
export interface FezzanState {
  sessionId: string;
  status: FezzanStatus;
  occupyingFaction?: string;
  occupationDate?: Date;
  resistanceLevel: number;       // 저항 수준 (0-100)
  economicOutput: number;        // 경제 생산력 (%) - 점령 시 감소
  tradeRouteActive: boolean;     // 회랑 교역 활성화 여부
  totalViolations: number;
  lastUpdated: Date;
}

// 페널티 정의
const PENALTY_DEFINITIONS: Record<ViolationType, {
  penalties: PenaltyType[];
  baseSeverity: number;
  economicImpact: number;        // 경제적 영향 (%)
  reputationLoss: number;        // 명성 손실
}> = {
  [ViolationType.MILITARY_PRESENCE]: {
    penalties: [PenaltyType.DIPLOMATIC_CONDEMNATION],
    baseSeverity: 2,
    economicImpact: 5,
    reputationLoss: 100,
  },
  [ViolationType.BLOCKADE]: {
    penalties: [PenaltyType.TRADE_DISRUPTION, PenaltyType.DIPLOMATIC_CONDEMNATION],
    baseSeverity: 5,
    economicImpact: 20,
    reputationLoss: 500,
  },
  [ViolationType.BOMBARDMENT]: {
    penalties: [PenaltyType.REPUTATION_LOSS, PenaltyType.ECONOMIC_DAMAGE],
    baseSeverity: 7,
    economicImpact: 30,
    reputationLoss: 1000,
  },
  [ViolationType.INVASION]: {
    penalties: [PenaltyType.INSURGENCY, PenaltyType.REPUTATION_LOSS, PenaltyType.THIRD_PARTY_INTERVENTION],
    baseSeverity: 9,
    economicImpact: 50,
    reputationLoss: 2000,
  },
  [ViolationType.OCCUPATION]: {
    penalties: [PenaltyType.INSURGENCY, PenaltyType.ECONOMIC_DAMAGE, PenaltyType.THIRD_PARTY_INTERVENTION],
    baseSeverity: 10,
    economicImpact: 70,
    reputationLoss: 5000,
  },
  [ViolationType.ECONOMIC_SANCTION]: {
    penalties: [PenaltyType.TRADE_DISRUPTION],
    baseSeverity: 3,
    economicImpact: 15,
    reputationLoss: 200,
  },
};

/**
 * FezzanOccupationService 클래스
 */
export class FezzanOccupationService extends EventEmitter {
  private static instance: FezzanOccupationService;
  
  private fezzanStates: Map<string, FezzanState> = new Map(); // sessionId -> FezzanState
  private violations: Map<string, NeutralityViolation[]> = new Map(); // sessionId -> violations
  private activePenalties: Map<string, AppliedPenalty[]> = new Map(); // sessionId -> penalties

  private constructor() {
    super();
    logger.info('[FezzanOccupationService] Initialized - 매뉴얼 미구현 기능 완성');
  }

  public static getInstance(): FezzanOccupationService {
    if (!FezzanOccupationService.instance) {
      FezzanOccupationService.instance = new FezzanOccupationService();
    }
    return FezzanOccupationService.instance;
  }

  // ==================== 초기화 ====================

  public initializeSession(sessionId: string): void {
    this.fezzanStates.set(sessionId, {
      sessionId,
      status: FezzanStatus.NEUTRAL,
      resistanceLevel: 0,
      economicOutput: 100,
      tradeRouteActive: true,
      totalViolations: 0,
      lastUpdated: new Date(),
    });
    this.violations.set(sessionId, []);
    this.activePenalties.set(sessionId, []);

    logger.info(`[FezzanOccupationService] Session ${sessionId} initialized. Fezzan is NEUTRAL.`);
  }

  public cleanupSession(sessionId: string): void {
    this.fezzanStates.delete(sessionId);
    this.violations.delete(sessionId);
    this.activePenalties.delete(sessionId);
  }

  // ==================== 중립 침범 감지 ====================

  /**
   * 군함 진입 감지
   */
  public detectMilitaryPresence(
    sessionId: string,
    faction: string,
    fleetSize: number,
  ): { violation: boolean; warning?: string } {
    const state = this.fezzanStates.get(sessionId);
    if (!state || state.status !== FezzanStatus.NEUTRAL) {
      return { violation: false };
    }

    // 소규모 함대는 경고만
    if (fleetSize < 100) {
      this.emit('fezzan:warning', { sessionId, faction, message: '페잔 영역 접근 경고' });
      return { violation: false, warning: '페잔 자치령이 함대 접근에 우려를 표명합니다.' };
    }

    // 대규모 함대는 중립 침범
    this.recordViolation(sessionId, faction, ViolationType.MILITARY_PRESENCE, 
      `${faction} 소속 ${fleetSize}척 함대가 페잔 영역에 진입`);

    state.status = FezzanStatus.THREATENED;
    state.lastUpdated = new Date();

    return { violation: true, warning: '페잔 중립 침범! 국제적 비난이 예상됩니다.' };
  }

  /**
   * 페잔 침공 시작
   */
  public async initiateInvasion(
    sessionId: string,
    invadingFaction: string,
    commanderId: string,
    fleetStrength: number,
  ): Promise<{ success: boolean; penalties: AppliedPenalty[]; error?: string }> {
    const state = this.fezzanStates.get(sessionId);
    if (!state) {
      return { success: false, penalties: [], error: '세션을 찾을 수 없습니다.' };
    }

    if (state.status === FezzanStatus.OCCUPIED_EMPIRE || state.status === FezzanStatus.OCCUPIED_ALLIANCE) {
      return { success: false, penalties: [], error: '페잔은 이미 점령되어 있습니다.' };
    }

    // 침공 기록
    const violation = this.recordViolation(sessionId, invadingFaction, ViolationType.INVASION,
      `${invadingFaction}이(가) 페잔 자치령 침공을 시작`);

    // 페널티 적용
    const penalties = this.applyPenalties(sessionId, invadingFaction, ViolationType.INVASION);

    // 상태 업데이트
    state.status = invadingFaction === 'empire' 
      ? FezzanStatus.OCCUPIED_EMPIRE 
      : FezzanStatus.OCCUPIED_ALLIANCE;
    state.occupyingFaction = invadingFaction;
    state.occupationDate = new Date();
    state.economicOutput = 30; // 경제 활동 70% 감소
    state.tradeRouteActive = false; // 회랑 교역 중단
    state.resistanceLevel = 20; // 초기 저항
    state.lastUpdated = new Date();

    this.emit('fezzan:invaded', { 
      sessionId, 
      invadingFaction, 
      commanderId,
      penalties 
    });

    logger.warn(`[FezzanOccupationService] FEZZAN INVADED by ${invadingFaction}! Penalties applied.`);

    return { success: true, penalties };
  }

  /**
   * 페잔 점령 완료
   */
  public async completeOccupation(
    sessionId: string,
    occupyingFaction: string,
  ): Promise<{ success: boolean; penalties: AppliedPenalty[] }> {
    const state = this.fezzanStates.get(sessionId);
    if (!state) {
      return { success: false, penalties: [] };
    }

    // 점령 기록
    this.recordViolation(sessionId, occupyingFaction, ViolationType.OCCUPATION,
      `${occupyingFaction}이(가) 페잔 자치령을 완전 점령`);

    // 추가 페널티
    const penalties = this.applyPenalties(sessionId, occupyingFaction, ViolationType.OCCUPATION);

    // 저항 운동 시작
    state.resistanceLevel = 50;

    this.emit('fezzan:occupied', { sessionId, occupyingFaction, penalties });
    logger.warn(`[FezzanOccupationService] FEZZAN OCCUPATION COMPLETE by ${occupyingFaction}!`);

    return { success: true, penalties };
  }

  // ==================== 페널티 시스템 ====================

  /**
   * 페널티 적용
   */
  private applyPenalties(
    sessionId: string,
    faction: string,
    violationType: ViolationType,
  ): AppliedPenalty[] {
    const definition = PENALTY_DEFINITIONS[violationType];
    const appliedPenalties: AppliedPenalty[] = [];

    for (const penaltyType of definition.penalties) {
      const penalty: AppliedPenalty = {
        penaltyId: `PENALTY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: penaltyType,
        amount: this.calculatePenaltyAmount(penaltyType, definition),
        duration: this.getPenaltyDuration(penaltyType),
        description: this.getPenaltyDescription(penaltyType, faction),
        appliedAt: new Date(),
        expiresAt: this.getPenaltyDuration(penaltyType) 
          ? new Date(Date.now() + this.getPenaltyDuration(penaltyType)! * 24 * 60 * 60 * 1000)
          : undefined,
      };

      appliedPenalties.push(penalty);
      this.activePenalties.get(sessionId)?.push(penalty);

      // 페널티 효과 적용
      this.executePenaltyEffect(sessionId, faction, penalty);
    }

    return appliedPenalties;
  }

  /**
   * 페널티 효과 실행
   */
  private async executePenaltyEffect(
    sessionId: string,
    faction: string,
    penalty: AppliedPenalty,
  ): Promise<void> {
    switch (penalty.type) {
      case PenaltyType.DIPLOMATIC_CONDEMNATION:
        // 외교적 비난 - 명성 감소
        this.emit('fezzan:diplomaticCondemnation', { sessionId, faction, amount: penalty.amount });
        break;

      case PenaltyType.TRADE_DISRUPTION:
        // 무역 중단 - 경제 수입 감소
        this.emit('fezzan:tradeDisrupted', { sessionId, faction, amount: penalty.amount });
        break;

      case PenaltyType.ECONOMIC_DAMAGE:
        // 경제적 피해
        this.emit('fezzan:economicDamage', { sessionId, faction, amount: penalty.amount });
        break;

      case PenaltyType.REPUTATION_LOSS:
        // 명성 손실
        this.emit('fezzan:reputationLoss', { sessionId, faction, amount: penalty.amount });
        break;

      case PenaltyType.INSURGENCY:
        // 저항 운동 발생
        this.emit('fezzan:insurgency', { sessionId, faction });
        break;

      case PenaltyType.THIRD_PARTY_INTERVENTION:
        // 제3세력 개입 (지구교 등)
        this.emit('fezzan:thirdPartyIntervention', { sessionId, faction });
        break;
    }
  }

  private calculatePenaltyAmount(penaltyType: PenaltyType, definition: typeof PENALTY_DEFINITIONS[ViolationType]): number {
    switch (penaltyType) {
      case PenaltyType.ECONOMIC_DAMAGE:
        return definition.economicImpact;
      case PenaltyType.REPUTATION_LOSS:
        return definition.reputationLoss;
      default:
        return definition.baseSeverity * 100;
    }
  }

  private getPenaltyDuration(penaltyType: PenaltyType): number | undefined {
    switch (penaltyType) {
      case PenaltyType.TRADE_DISRUPTION:
        return 30; // 30일
      case PenaltyType.DIPLOMATIC_CONDEMNATION:
        return 60; // 60일
      case PenaltyType.INSURGENCY:
        return undefined; // 영구 (점령 해제까지)
      default:
        return 30;
    }
  }

  private getPenaltyDescription(penaltyType: PenaltyType, faction: string): string {
    switch (penaltyType) {
      case PenaltyType.DIPLOMATIC_CONDEMNATION:
        return `${faction}의 페잔 중립 침범에 대한 국제적 비난`;
      case PenaltyType.TRADE_DISRUPTION:
        return '페잔 회랑 교역 중단으로 인한 무역 손실';
      case PenaltyType.ECONOMIC_DAMAGE:
        return '점령지 경제 활동 위축';
      case PenaltyType.REPUTATION_LOSS:
        return '중립국 침범으로 인한 명성 손실';
      case PenaltyType.INSURGENCY:
        return '페잔 시민의 저항 운동 발생';
      case PenaltyType.THIRD_PARTY_INTERVENTION:
        return '제3세력(지구교 등)의 개입 가능성';
      default:
        return '알 수 없는 페널티';
    }
  }

  // ==================== 저항 운동 ====================

  /**
   * 매 틱마다 저항 운동 처리
   */
  public processResistance(sessionId: string): void {
    const state = this.fezzanStates.get(sessionId);
    if (!state || state.status === FezzanStatus.NEUTRAL) return;

    if (state.resistanceLevel > 0) {
      // 저항 운동으로 인한 피해
      const damage = Math.floor(state.resistanceLevel / 10);
      
      this.emit('fezzan:resistanceActivity', {
        sessionId,
        occupyingFaction: state.occupyingFaction,
        damage,
        resistanceLevel: state.resistanceLevel,
      });

      // 저항 수준 자연 증가 (점령 지속 시)
      state.resistanceLevel = Math.min(100, state.resistanceLevel + 1);
      
      // 경제 생산력 추가 감소
      state.economicOutput = Math.max(10, state.economicOutput - 0.5);

      state.lastUpdated = new Date();
    }
  }

  // ==================== 해방 ====================

  /**
   * 페잔 해방
   */
  public liberateFezzan(sessionId: string): { success: boolean; message: string } {
    const state = this.fezzanStates.get(sessionId);
    if (!state) {
      return { success: false, message: '세션을 찾을 수 없습니다.' };
    }

    if (state.status === FezzanStatus.NEUTRAL) {
      return { success: false, message: '페잔은 이미 중립 상태입니다.' };
    }

    const previousOccupier = state.occupyingFaction;

    // 상태 복원
    state.status = FezzanStatus.LIBERATED;
    state.occupyingFaction = undefined;
    state.occupationDate = undefined;
    state.resistanceLevel = 0;
    state.economicOutput = 50; // 서서히 회복
    state.tradeRouteActive = true;
    state.lastUpdated = new Date();

    // 일정 시간 후 중립으로 완전 복귀 (TODO: 스케줄러 연동)
    setTimeout(() => {
      const currentState = this.fezzanStates.get(sessionId);
      if (currentState && currentState.status === FezzanStatus.LIBERATED) {
        currentState.status = FezzanStatus.NEUTRAL;
        currentState.economicOutput = 100;
        this.emit('fezzan:neutralityRestored', { sessionId });
      }
    }, 30 * 60 * 1000); // 30분 후 (게임 내 30일)

    this.emit('fezzan:liberated', { sessionId, previousOccupier });
    logger.info(`[FezzanOccupationService] Fezzan liberated from ${previousOccupier}`);

    return { success: true, message: '페잔 자치령이 해방되었습니다.' };
  }

  // ==================== 중립 침범 기록 ====================

  private recordViolation(
    sessionId: string,
    faction: string,
    type: ViolationType,
    description: string,
  ): NeutralityViolation {
    const definition = PENALTY_DEFINITIONS[type];
    
    const violation: NeutralityViolation = {
      violationId: `VIOLATION-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      violatorFaction: faction,
      type,
      severity: definition.baseSeverity,
      timestamp: new Date(),
      description,
      penaltiesApplied: [],
    };

    this.violations.get(sessionId)?.push(violation);

    const state = this.fezzanStates.get(sessionId);
    if (state) {
      state.totalViolations++;
      state.lastUpdated = new Date();
    }

    this.emit('fezzan:violationRecorded', { sessionId, violation });
    logger.warn(`[FezzanOccupationService] Neutrality violation: ${description}`);

    return violation;
  }

  // ==================== 조회 ====================

  public getFezzanState(sessionId: string): FezzanState | undefined {
    return this.fezzanStates.get(sessionId);
  }

  public getViolations(sessionId: string): NeutralityViolation[] {
    return this.violations.get(sessionId) || [];
  }

  /**
   * 활성 페널티 조회
   * @param sessionId 세션 ID
   * @param faction 세력 ID (선택, 지정 시 해당 세력에 적용된 페널티만 반환)
   * @returns 활성 페널티 배열
   */
  public getActivePenalties(sessionId: string, faction?: string): AppliedPenalty[] {
    const penalties = this.activePenalties.get(sessionId) || [];
    const violations = this.violations.get(sessionId) || [];

    // 만료되지 않은 페널티만 필터링
    let activePenalties = penalties.filter((p) => !p.expiresAt || p.expiresAt > new Date());

    // faction 필터링이 필요한 경우
    if (faction) {
      // 해당 세력이 저지른 위반에 연결된 페널티 ID 수집
      const factionViolations = violations.filter((v) => v.violatorFaction === faction);
      const factionPenaltyIds = new Set(
        factionViolations.flatMap((v) => v.penaltiesApplied.map((p) => p.penaltyId)),
      );

      // 해당 세력의 페널티만 반환
      activePenalties = activePenalties.filter((p) => factionPenaltyIds.has(p.penaltyId));
    }

    return activePenalties;
  }

  public isFezzanNeutral(sessionId: string): boolean {
    const state = this.fezzanStates.get(sessionId);
    return state?.status === FezzanStatus.NEUTRAL;
  }
}

export const fezzanOccupationService = FezzanOccupationService.getInstance();
export default FezzanOccupationService;





