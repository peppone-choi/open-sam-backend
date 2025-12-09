/**
 * EscapeOperationService - 탈출공작 서비스
 * 매뉴얼 5460-5574행 기반 확장
 *
 * 체포/억류된 인원의 탈출 공작을 관리합니다.
 *
 * 지원 유형:
 * - DISTRACTION: 주의 분산 - 경비 교란
 * - TRANSPORT: 이동 수단 - 탈출 차량/함선 제공
 * - DOCUMENTS: 문서 위조 - 신분 서류 위조
 * - INSIDE_HELP: 내부 협조 - 내부자 매수/협조
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

// ============================================================
// 타입 정의
// ============================================================

/**
 * 탈출 상태
 */
export enum EscapeStatus {
  PLANNING = 'PLANNING',           // 계획 수립 중
  PREPARED = 'PREPARED',           // 준비 완료
  IN_PROGRESS = 'IN_PROGRESS',     // 탈출 진행 중
  EVADING = 'EVADING',             // 추적 회피 중
  SUCCEEDED = 'SUCCEEDED',         // 탈출 성공
  FAILED = 'FAILED',               // 탈출 실패
  ABORTED = 'ABORTED',             // 중단됨
}

/**
 * 지원 유형
 */
export enum SupportType {
  DISTRACTION = 'DISTRACTION',     // 주의 분산 - 경비 교란
  TRANSPORT = 'TRANSPORT',         // 이동 수단 제공
  DOCUMENTS = 'DOCUMENTS',         // 문서 위조
  INSIDE_HELP = 'INSIDE_HELP',     // 내부 협조자
}

/**
 * 탈출 방법
 */
export enum EscapeMethod {
  BREAKOUT = 'BREAKOUT',           // 탈옥/탈출
  RESCUE = 'RESCUE',               // 구출 작전
  EXCHANGE = 'EXCHANGE',           // 포로 교환
  BRIBERY = 'BRIBERY',             // 매수
  LEGAL = 'LEGAL',                 // 법적 석방
  STEALTH = 'STEALTH',             // 은밀 탈출
}

/**
 * 추적 강도
 */
export enum PursuitIntensity {
  NONE = 'NONE',                   // 추적 없음
  LOW = 'LOW',                     // 낮음
  MEDIUM = 'MEDIUM',               // 보통
  HIGH = 'HIGH',                   // 높음
  EXTREME = 'EXTREME',             // 극도
}

/**
 * 탈출 계획
 */
export interface EscapePlan {
  planId: string;
  sessionId: string;
  status: EscapeStatus;

  // 탈출 대상
  targetId: string;                // 탈출 대상 캐릭터
  targetName: string;
  detentionLocation: string;       // 억류 장소

  // 계획 정보
  method: EscapeMethod;
  supportOperations: SupportOperation[];
  plannedRoute?: EscapeRoute[];

  // 관계자
  coordinatorId?: string;          // 작전 조율자
  rescueTeamIds?: string[];        // 구출팀 (있을 경우)

  // 상태
  readinessScore: number;          // 준비 점수 (0-100)
  detectionRisk: number;           // 발각 위험 (0-100)
  successProbability: number;      // 예상 성공률

  // 시간
  createdAt: Date;
  executionTime?: Date;
  completedAt?: Date;

  // 결과
  result?: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  resultDetails?: string;
}

/**
 * 지원 작전
 */
export interface SupportOperation {
  operationId: string;
  type: SupportType;
  assignedAgentId?: string;
  status: 'PENDING' | 'READY' | 'EXECUTED' | 'FAILED';
  effectValue: number;             // 효과 수치 (0-100)
  executionTime?: Date;
  notes?: string;
}

/**
 * 탈출 경로
 */
export interface EscapeRoute {
  waypointId: string;
  locationId: string;
  locationType: 'FACILITY' | 'PLANET' | 'STARBASE' | 'SHIP' | 'SAFEHOUSE';
  orderIndex: number;
  riskLevel: number;               // 위험도 (0-100)
  estimatedTime: number;           // 예상 소요 시간 (분)
  passed: boolean;
}

/**
 * 추적 상태
 */
export interface PursuitStatus {
  pursuitId: string;
  escapePlanId: string;
  sessionId: string;
  intensity: PursuitIntensity;
  pursuingFaction: string;
  pursuingUnits: string[];
  lastKnownLocation?: string;
  estimatedDistance: number;       // 추정 거리
  active: boolean;
}

/**
 * 탈출 결과
 */
export interface EscapeResult {
  success: boolean;
  planId?: string;
  message: string;
  newLocation?: string;
  pursuitStatus?: PursuitStatus;
  cpCost: number;
}

// ============================================================
// 기본 설정
// ============================================================

const SUPPORT_CONFIG: Record<SupportType, {
  effectBonus: number;
  riskReduction: number;
  prepTime: number;
  cpCost: number;
}> = {
  [SupportType.DISTRACTION]: { effectBonus: 15, riskReduction: 10, prepTime: 2, cpCost: 80 },
  [SupportType.TRANSPORT]: { effectBonus: 20, riskReduction: 5, prepTime: 4, cpCost: 160 },
  [SupportType.DOCUMENTS]: { effectBonus: 10, riskReduction: 15, prepTime: 6, cpCost: 120 },
  [SupportType.INSIDE_HELP]: { effectBonus: 25, riskReduction: 20, prepTime: 12, cpCost: 240 },
};

const METHOD_CONFIG: Record<EscapeMethod, {
  baseSuccessRate: number;
  baseDetectionRisk: number;
  minReadiness: number;
}> = {
  [EscapeMethod.BREAKOUT]: { baseSuccessRate: 0.3, baseDetectionRisk: 70, minReadiness: 60 },
  [EscapeMethod.RESCUE]: { baseSuccessRate: 0.5, baseDetectionRisk: 50, minReadiness: 70 },
  [EscapeMethod.EXCHANGE]: { baseSuccessRate: 0.8, baseDetectionRisk: 10, minReadiness: 30 },
  [EscapeMethod.BRIBERY]: { baseSuccessRate: 0.6, baseDetectionRisk: 30, minReadiness: 40 },
  [EscapeMethod.LEGAL]: { baseSuccessRate: 0.9, baseDetectionRisk: 0, minReadiness: 20 },
  [EscapeMethod.STEALTH]: { baseSuccessRate: 0.4, baseDetectionRisk: 40, minReadiness: 80 },
};

// ============================================================
// EscapeOperationService 클래스
// ============================================================

export class EscapeOperationService extends EventEmitter {
  private static instance: EscapeOperationService;
  private escapePlans: Map<string, EscapePlan[]> = new Map();
  private pursuits: Map<string, PursuitStatus[]> = new Map();

  private constructor() {
    super();
    logger.info('[EscapeOperationService] Initialized');
  }

  public static getInstance(): EscapeOperationService {
    if (!EscapeOperationService.instance) {
      EscapeOperationService.instance = new EscapeOperationService();
    }
    return EscapeOperationService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.escapePlans.set(sessionId, []);
    this.pursuits.set(sessionId, []);
    logger.info(`[EscapeOperationService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.escapePlans.delete(sessionId);
    this.pursuits.delete(sessionId);
    logger.info(`[EscapeOperationService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 탈출 계획 (planEscape)
  // ============================================================

  /**
   * 탈출 계획 수립
   */
  public async planEscape(
    sessionId: string,
    targetId: string,
    method: EscapeMethod,
    coordinatorId?: string,
  ): Promise<EscapeResult> {
    const cpCost = 160;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return { success: false, message: '탈출 대상을 찾을 수 없습니다.', cpCost: 0 };
      }

      if (target.status !== 'DETAINED' && target.status !== 'CAPTURED') {
        return { success: false, message: '억류 상태가 아닌 대상은 탈출 계획을 세울 수 없습니다.', cpCost: 0 };
      }

      const methodConfig = METHOD_CONFIG[method];
      const detentionLocation = target.locationPlanetId || 'unknown';

      // 탈출 계획 생성
      const plan: EscapePlan = {
        planId: `ESC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        status: EscapeStatus.PLANNING,
        targetId,
        targetName: target.name,
        detentionLocation,
        method,
        supportOperations: [],
        coordinatorId,
        readinessScore: 0,
        detectionRisk: methodConfig.baseDetectionRisk,
        successProbability: methodConfig.baseSuccessRate * 100,
        createdAt: new Date(),
      };

      this.escapePlans.get(sessionId)?.push(plan);

      this.emit('escape:plan_created', { sessionId, plan });
      logger.info(`[EscapeOperationService] Escape plan created for ${target.name}`);

      return {
        success: true,
        planId: plan.planId,
        message: `${target.name}의 탈출 계획이 수립되었습니다. 준비도를 높이세요.`,
        cpCost,
      };
    } catch (error) {
      logger.error('[EscapeOperationService] Plan escape error:', error);
      return { success: false, message: '탈출 계획 수립 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 탈출 실행 (executeEscape)
  // ============================================================

  /**
   * 탈출 실행
   */
  public async executeEscape(
    sessionId: string,
    planId: string,
  ): Promise<EscapeResult> {
    const cpCost = 320;

    const plan = this.getPlan(sessionId, planId);
    if (!plan) {
      return { success: false, message: '탈출 계획을 찾을 수 없습니다.', cpCost: 0 };
    }

    if (plan.status !== EscapeStatus.PLANNING && plan.status !== EscapeStatus.PREPARED) {
      return { success: false, message: `현재 상태(${plan.status})에서는 탈출을 실행할 수 없습니다.`, cpCost: 0 };
    }

    const methodConfig = METHOD_CONFIG[plan.method];
    if (plan.readinessScore < methodConfig.minReadiness) {
      return {
        success: false,
        message: `준비도가 부족합니다. 필요: ${methodConfig.minReadiness}%, 현재: ${plan.readinessScore}%`,
        cpCost: 0,
      };
    }

    try {
      plan.status = EscapeStatus.IN_PROGRESS;
      plan.executionTime = new Date();

      // 지원 작전 실행
      for (const support of plan.supportOperations) {
        if (support.status === 'READY') {
          support.status = 'EXECUTED';
          support.executionTime = new Date();
        }
      }

      // 성공률 계산
      const supportBonus = plan.supportOperations
        .filter(s => s.status === 'EXECUTED')
        .reduce((sum, s) => sum + s.effectValue / 100, 0);

      const successRate = Math.min(0.95, (plan.successProbability / 100) + supportBonus * 0.1);
      const success = Math.random() < successRate;

      if (success) {
        plan.status = EscapeStatus.EVADING;

        // 추적 시작 여부 결정
        const pursuitChance = plan.detectionRisk / 100;
        if (Math.random() < pursuitChance) {
          const pursuit = this.startPursuit(sessionId, plan);
          plan.status = EscapeStatus.EVADING;

          this.emit('escape:pursuit_started', { sessionId, planId, pursuit });

          return {
            success: true,
            planId,
            message: '탈출에 성공했으나 추적이 시작되었습니다!',
            pursuitStatus: pursuit,
            cpCost,
          };
        }

        // 즉시 성공
        plan.status = EscapeStatus.SUCCEEDED;
        plan.completedAt = new Date();
        plan.result = 'SUCCESS';
        plan.resultDetails = '탈출 완료';

        // 대상 상태 변경
        await Gin7Character.updateOne(
          { sessionId, characterId: plan.targetId },
          {
            $set: {
              status: 'ACTIVE',
              'detentionDetails': null,
            },
          },
        );

        this.emit('escape:succeeded', { sessionId, plan });
        logger.info(`[EscapeOperationService] ${plan.targetName} escaped successfully`);

        return {
          success: true,
          planId,
          message: `${plan.targetName}의 탈출에 성공했습니다!`,
          cpCost,
        };
      } else {
        // 탈출 실패
        plan.status = EscapeStatus.FAILED;
        plan.completedAt = new Date();
        plan.result = 'FAILURE';
        plan.resultDetails = '탈출 시도 실패';

        // 발각 위험 증가
        plan.detectionRisk = Math.min(100, plan.detectionRisk + 30);

        this.emit('escape:failed', { sessionId, plan });
        logger.warn(`[EscapeOperationService] ${plan.targetName} escape failed`);

        return {
          success: false,
          planId,
          message: `${plan.targetName}의 탈출 시도가 실패했습니다.`,
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[EscapeOperationService] Execute escape error:', error);
      return { success: false, message: '탈출 실행 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 지원 작전 (provideSupport)
  // ============================================================

  /**
   * 지원 작전 추가
   */
  public async provideSupport(
    sessionId: string,
    planId: string,
    supportType: SupportType,
    agentId?: string,
  ): Promise<EscapeResult> {
    const config = SUPPORT_CONFIG[supportType];
    const cpCost = config.cpCost;

    const plan = this.getPlan(sessionId, planId);
    if (!plan) {
      return { success: false, message: '탈출 계획을 찾을 수 없습니다.', cpCost: 0 };
    }

    if (plan.status !== EscapeStatus.PLANNING && plan.status !== EscapeStatus.PREPARED) {
      return { success: false, message: '계획/준비 단계에서만 지원 작전을 추가할 수 있습니다.', cpCost: 0 };
    }

    try {
      // 지원 작전 생성
      const support: SupportOperation = {
        operationId: `SUP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: supportType,
        assignedAgentId: agentId,
        status: 'PENDING',
        effectValue: config.effectBonus,
      };

      // 에이전트 스킬 보너스
      if (agentId) {
        const agent = await Gin7Character.findOne({ sessionId, characterId: agentId });
        if (agent) {
          const skillBonus = (agent.stats?.intellect || 50) / 10;
          support.effectValue = Math.min(50, support.effectValue + skillBonus);
        }
      }

      plan.supportOperations.push(support);

      // 준비도/위험도 업데이트
      plan.readinessScore = Math.min(100, plan.readinessScore + config.effectBonus);
      plan.detectionRisk = Math.max(0, plan.detectionRisk - config.riskReduction);
      plan.successProbability = Math.min(95, plan.successProbability + config.effectBonus * 0.5);

      // 준비 완료 상태 체크
      const methodConfig = METHOD_CONFIG[plan.method];
      if (plan.readinessScore >= methodConfig.minReadiness) {
        plan.status = EscapeStatus.PREPARED;
        support.status = 'READY';
      }

      this.emit('escape:support_added', { sessionId, planId, support });
      logger.info(`[EscapeOperationService] Support ${supportType} added to plan ${planId}`);

      return {
        success: true,
        planId,
        message: `${supportType} 지원 작전이 추가되었습니다. 준비도: ${plan.readinessScore}%`,
        cpCost,
      };
    } catch (error) {
      logger.error('[EscapeOperationService] Provide support error:', error);
      return { success: false, message: '지원 작전 추가 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 추적 회피 (evadePursuit)
  // ============================================================

  /**
   * 추적 회피 시도
   */
  public async evadePursuit(
    sessionId: string,
    planId: string,
  ): Promise<EscapeResult> {
    const cpCost = 80;

    const plan = this.getPlan(sessionId, planId);
    if (!plan) {
      return { success: false, message: '탈출 계획을 찾을 수 없습니다.', cpCost: 0 };
    }

    if (plan.status !== EscapeStatus.EVADING) {
      return { success: false, message: '추적 회피 단계가 아닙니다.', cpCost: 0 };
    }

    const pursuit = this.pursuits.get(sessionId)?.find(p => p.escapePlanId === planId && p.active);
    if (!pursuit) {
      // 추적이 없으면 바로 성공
      plan.status = EscapeStatus.SUCCEEDED;
      plan.completedAt = new Date();
      plan.result = 'SUCCESS';

      await Gin7Character.updateOne(
        { sessionId, characterId: plan.targetId },
        { $set: { status: 'ACTIVE', detentionDetails: null } },
      );

      return {
        success: true,
        planId,
        message: '추적 없이 안전하게 탈출했습니다!',
        cpCost,
      };
    }

    try {
      // 회피 성공률 계산
      const target = await Gin7Character.findOne({ sessionId, characterId: plan.targetId });
      const baseEvadeRate = 0.4;
      const skillBonus = (target?.stats?.agility || 50) / 200;
      const intensityPenalty = this.getPursuitPenalty(pursuit.intensity);
      const evadeRate = Math.min(0.8, baseEvadeRate + skillBonus - intensityPenalty);

      const evaded = Math.random() < evadeRate;

      if (evaded) {
        // 추적 강도 감소 또는 중단
        if (pursuit.intensity === PursuitIntensity.LOW) {
          pursuit.active = false;
          plan.status = EscapeStatus.SUCCEEDED;
          plan.completedAt = new Date();
          plan.result = 'SUCCESS';

          await Gin7Character.updateOne(
            { sessionId, characterId: plan.targetId },
            { $set: { status: 'ACTIVE', detentionDetails: null } },
          );

          this.emit('escape:pursuit_lost', { sessionId, pursuit });

          return {
            success: true,
            planId,
            message: '추적을 따돌리고 완전히 탈출했습니다!',
            cpCost,
          };
        } else {
          // 추적 강도 한 단계 감소
          pursuit.intensity = this.reducePursuitIntensity(pursuit.intensity);
          pursuit.estimatedDistance += 100;

          this.emit('escape:pursuit_evaded', { sessionId, pursuit });

          return {
            success: true,
            planId,
            message: `추적을 일부 따돌렸습니다. 현재 추적 강도: ${pursuit.intensity}`,
            pursuitStatus: pursuit,
            cpCost,
          };
        }
      } else {
        // 회피 실패 - 추적 강화
        pursuit.intensity = this.increasePursuitIntensity(pursuit.intensity);
        pursuit.estimatedDistance = Math.max(0, pursuit.estimatedDistance - 50);

        // 극도의 추적 시 재체포 가능성
        if (pursuit.intensity === PursuitIntensity.EXTREME && Math.random() < 0.3) {
          plan.status = EscapeStatus.FAILED;
          plan.completedAt = new Date();
          plan.result = 'FAILURE';
          plan.resultDetails = '재체포됨';
          pursuit.active = false;

          await Gin7Character.updateOne(
            { sessionId, characterId: plan.targetId },
            { $set: { status: 'DETAINED' } },
          );

          this.emit('escape:recaptured', { sessionId, plan });

          return {
            success: false,
            planId,
            message: '추적에 잡혀 다시 체포되었습니다.',
            cpCost,
          };
        }

        this.emit('escape:evade_failed', { sessionId, pursuit });

        return {
          success: false,
          planId,
          message: `추적 회피 실패. 추적 강도가 ${pursuit.intensity}로 증가했습니다.`,
          pursuitStatus: pursuit,
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[EscapeOperationService] Evade pursuit error:', error);
      return { success: false, message: '추적 회피 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 유틸리티 메서드
  // ============================================================

  private getPlan(sessionId: string, planId: string): EscapePlan | undefined {
    return this.escapePlans.get(sessionId)?.find(p => p.planId === planId);
  }

  private startPursuit(sessionId: string, plan: EscapePlan): PursuitStatus {
    const pursuit: PursuitStatus = {
      pursuitId: `PUR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      escapePlanId: plan.planId,
      sessionId,
      intensity: plan.detectionRisk > 60 ? PursuitIntensity.HIGH :
                 plan.detectionRisk > 30 ? PursuitIntensity.MEDIUM : PursuitIntensity.LOW,
      pursuingFaction: 'enemy', // TODO: 실제 적 진영 연동
      pursuingUnits: [],
      estimatedDistance: 50,
      active: true,
    };

    this.pursuits.get(sessionId)?.push(pursuit);
    return pursuit;
  }

  private getPursuitPenalty(intensity: PursuitIntensity): number {
    const penalties: Record<PursuitIntensity, number> = {
      [PursuitIntensity.NONE]: 0,
      [PursuitIntensity.LOW]: 0.1,
      [PursuitIntensity.MEDIUM]: 0.2,
      [PursuitIntensity.HIGH]: 0.3,
      [PursuitIntensity.EXTREME]: 0.4,
    };
    return penalties[intensity];
  }

  private reducePursuitIntensity(current: PursuitIntensity): PursuitIntensity {
    const order = [PursuitIntensity.EXTREME, PursuitIntensity.HIGH,
                   PursuitIntensity.MEDIUM, PursuitIntensity.LOW, PursuitIntensity.NONE];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  private increasePursuitIntensity(current: PursuitIntensity): PursuitIntensity {
    const order = [PursuitIntensity.NONE, PursuitIntensity.LOW,
                   PursuitIntensity.MEDIUM, PursuitIntensity.HIGH, PursuitIntensity.EXTREME];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  // ============================================================
  // 조회 메서드
  // ============================================================

  public getEscapePlans(sessionId: string): EscapePlan[] {
    return this.escapePlans.get(sessionId) || [];
  }

  public getActivePlans(sessionId: string): EscapePlan[] {
    return (this.escapePlans.get(sessionId) || [])
      .filter(p => ![EscapeStatus.SUCCEEDED, EscapeStatus.FAILED, EscapeStatus.ABORTED].includes(p.status));
  }

  public getPlansByTarget(sessionId: string, targetId: string): EscapePlan[] {
    return (this.escapePlans.get(sessionId) || []).filter(p => p.targetId === targetId);
  }

  public getActivePursuits(sessionId: string): PursuitStatus[] {
    return (this.pursuits.get(sessionId) || []).filter(p => p.active);
  }

  public processGameTick(sessionId: string): void {
    const pursuits = this.pursuits.get(sessionId);
    if (!pursuits) return;

    for (const pursuit of pursuits) {
      if (pursuit.active) {
        // 시간이 지나면 추적 강도 자연 감소
        if (Math.random() < 0.1) {
          pursuit.intensity = this.reducePursuitIntensity(pursuit.intensity);
          if (pursuit.intensity === PursuitIntensity.NONE) {
            pursuit.active = false;

            const plan = this.getPlan(sessionId, pursuit.escapePlanId);
            if (plan && plan.status === EscapeStatus.EVADING) {
              plan.status = EscapeStatus.SUCCEEDED;
              plan.completedAt = new Date();
              plan.result = 'SUCCESS';
            }
          }
        }
      }
    }
  }
}

export const escapeOperationService = EscapeOperationService.getInstance();
export default EscapeOperationService;





