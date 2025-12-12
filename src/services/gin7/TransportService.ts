/**
 * TransportService - 수송 시스템
 * Agent F: 외교/경제 시스템 확장
 *
 * 기능:
 * - 수송 계획 (planTransport)
 * - 호위 배치 (assignEscort)
 * - 수송 경로 최적화
 * - 적 요격 대응
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum TransportType {
  SUPPLIES = 'SUPPLIES',           // 보급품
  REINFORCEMENTS = 'REINFORCEMENTS', // 증원병
  CIVILIANS = 'CIVILIANS',         // 민간인 대피
  TRADE_GOODS = 'TRADE_GOODS',     // 무역품
  VIP = 'VIP',                     // 중요 인물
  AMMUNITION = 'AMMUNITION',       // 탄약
  EQUIPMENT = 'EQUIPMENT',         // 장비
}

export enum TransportStatus {
  PLANNING = 'PLANNING',           // 계획 중
  WAITING_ESCORT = 'WAITING_ESCORT', // 호위 대기
  LOADING = 'LOADING',             // 적재 중
  IN_TRANSIT = 'IN_TRANSIT',       // 이동 중
  UNDER_ATTACK = 'UNDER_ATTACK',   // 공격 받음
  ARRIVED = 'ARRIVED',             // 도착
  INTERCEPTED = 'INTERCEPTED',     // 요격됨
  ABORTED = 'ABORTED',             // 중단됨
  COMPLETED = 'COMPLETED',         // 완료
}

export enum TransportPriority {
  EMERGENCY = 'EMERGENCY',         // 긴급
  HIGH = 'HIGH',                   // 높음
  NORMAL = 'NORMAL',               // 보통
  LOW = 'LOW',                     // 낮음
}

export enum RouteRisk {
  SAFE = 'SAFE',                   // 안전
  LOW = 'LOW',                     // 낮음
  MODERATE = 'MODERATE',           // 중간
  HIGH = 'HIGH',                   // 높음
  EXTREME = 'EXTREME',             // 매우 높음
}

export interface TransportPlan {
  planId: string;
  sessionId: string;
  factionId: string;
  commanderId?: string;           // 지휘관 ID

  // 수송 내용
  type: TransportType;
  cargo: TransportCargo[];
  totalCapacity: number;          // 총 적재 용량
  usedCapacity: number;           // 사용된 용량

  // 경로
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  route: RouteWaypoint[];
  distance: number;               // 총 거리 (파섹)
  estimatedDuration: number;      // 예상 소요 시간 (틱)

  // 호위
  escortRequired: boolean;
  escortStrength: number;         // 필요 호위 전력
  assignedEscort?: EscortAssignment;

  // 상태
  status: TransportStatus;
  priority: TransportPriority;
  routeRisk: RouteRisk;

  // 시간
  plannedAt: Date;
  departureTime?: Date;
  arrivalTime?: Date;
  completedAt?: Date;

  // 결과
  cargoDelivered: number;         // 도착한 화물량 (%)
  casualties?: number;            // 손실
  interceptedBy?: string;         // 요격한 세력
}

export interface TransportCargo {
  cargoId: string;
  type: string;                   // 화물 유형
  quantity: number;
  weight: number;                 // 무게 (톤)
  value: number;                  // 가치
  priority: number;               // 우선순위 (1-10)
  isFragile: boolean;             // 취급 주의 여부
}

export interface RouteWaypoint {
  waypointId: string;
  systemId: string;
  systemName: string;
  distanceFromPrev: number;       // 이전 지점으로부터 거리
  arrivalTime?: Date;             // 예상 도착 시간
  riskLevel: RouteRisk;
  notes?: string;                 // 특이사항
}

export interface EscortAssignment {
  assignmentId: string;
  fleetIds: string[];             // 호위 함대 ID
  totalShips: number;             // 총 함선 수
  commanderId: string;            // 호위 지휘관
  formation: EscortFormation;
  engagementRules: EngagementRules;
  assignedAt: Date;
}

export interface EscortFormation {
  type: 'CONVOY' | 'SCREEN' | 'ENCIRCLE' | 'VANGUARD' | 'REAR_GUARD';
  spacing: number;                // 함대 간격
  responseTime: number;           // 반응 시간 (초)
}

export interface EngagementRules {
  engageOnSight: boolean;         // 발견 즉시 교전
  retreatThreshold: number;       // 후퇴 기준 (손실률 %)
  protectCargoFirst: boolean;     // 화물 우선 보호
  pursuitAllowed: boolean;        // 추격 허용
  maxPursuitDistance: number;     // 최대 추격 거리
}

export interface InterceptionEvent {
  eventId: string;
  sessionId: string;
  transportPlanId: string;
  interceptorFactionId: string;
  interceptorFleetId: string;
  location: string;
  occurredAt: Date;
  outcome: 'ESCAPED' | 'DAMAGED' | 'CAPTURED' | 'DESTROYED' | 'REPELLED';
  cargoLost: number;              // 손실 화물 (%)
  casualtiesTransport: number;
  casualtiesInterceptor: number;
  battleDuration: number;         // 전투 시간 (분)
}

export interface TransportStatistics {
  sessionId: string;
  factionId: string;
  totalMissions: number;
  successfulMissions: number;
  failedMissions: number;
  totalCargoDelivered: number;
  totalCargoLost: number;
  averageDeliveryRate: number;    // 평균 배달률 (%)
  totalDistanceTraveled: number;
  interceptionsEvaded: number;
  interceptionsSuccumbed: number;
}

// ============================================================
// Constants
// ============================================================

const ESCORT_STRENGTH_MULTIPLIER: Record<RouteRisk, number> = {
  [RouteRisk.SAFE]: 0,
  [RouteRisk.LOW]: 0.1,
  [RouteRisk.MODERATE]: 0.25,
  [RouteRisk.HIGH]: 0.5,
  [RouteRisk.EXTREME]: 1.0,
};

const PRIORITY_SPEED_BONUS: Record<TransportPriority, number> = {
  [TransportPriority.EMERGENCY]: 1.5,
  [TransportPriority.HIGH]: 1.2,
  [TransportPriority.NORMAL]: 1.0,
  [TransportPriority.LOW]: 0.8,
};

const INTERCEPTION_BASE_CHANCE: Record<RouteRisk, number> = {
  [RouteRisk.SAFE]: 0,
  [RouteRisk.LOW]: 5,
  [RouteRisk.MODERATE]: 15,
  [RouteRisk.HIGH]: 35,
  [RouteRisk.EXTREME]: 60,
};

// ============================================================
// TransportService Class
// ============================================================

export class TransportService extends EventEmitter {
  private static instance: TransportService;

  // 세션별 데이터
  private transportPlans: Map<string, TransportPlan[]> = new Map();
  private interceptionEvents: Map<string, InterceptionEvent[]> = new Map();
  private statistics: Map<string, Map<string, TransportStatistics>> = new Map();

  private constructor() {
    super();
    logger.info('[TransportService] Initialized');
  }

  public static getInstance(): TransportService {
    if (!TransportService.instance) {
      TransportService.instance = new TransportService();
    }
    return TransportService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.transportPlans.set(sessionId, []);
    this.interceptionEvents.set(sessionId, []);
    this.statistics.set(sessionId, new Map());
    logger.info(`[TransportService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.transportPlans.delete(sessionId);
    this.interceptionEvents.delete(sessionId);
    this.statistics.delete(sessionId);
    logger.info(`[TransportService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 수송 계획
  // ============================================================

  /**
   * 수송 계획 생성
   */
  public planTransport(
    sessionId: string,
    factionId: string,
    request: {
      type: TransportType;
      originId: string;
      originName: string;
      destinationId: string;
      destinationName: string;
      cargo: Omit<TransportCargo, 'cargoId'>[];
      priority?: TransportPriority;
      commanderId?: string;
    },
  ): { success: boolean; plan?: TransportPlan; error?: string } {
    // 화물 검증
    if (!request.cargo || request.cargo.length === 0) {
      return { success: false, error: '수송할 화물이 없습니다.' };
    }

    // 화물 ID 부여
    const cargo: TransportCargo[] = request.cargo.map(c => ({
      ...c,
      cargoId: `CARGO-${uuidv4().slice(0, 8)}`,
    }));

    // 용량 계산
    const totalCapacity = cargo.reduce((sum, c) => sum + c.weight, 0);
    const usedCapacity = totalCapacity;

    // 경로 계산
    const route = this.calculateRoute(
      sessionId,
      request.originId,
      request.destinationId,
    );

    // 거리 및 소요 시간 계산
    const distance = route.reduce((sum, wp) => sum + wp.distanceFromPrev, 0);
    const priority = request.priority || TransportPriority.NORMAL;
    const speedBonus = PRIORITY_SPEED_BONUS[priority];
    const estimatedDuration = Math.ceil(distance / (10 * speedBonus)); // 틱당 10파섹 기본

    // 경로 위험도 평가
    const routeRisk = this.assessRouteRisk(route);

    // 호위 필요 여부 및 전력
    const escortRequired = routeRisk !== RouteRisk.SAFE;
    const escortStrength = Math.ceil(
      totalCapacity * ESCORT_STRENGTH_MULTIPLIER[routeRisk],
    );

    const plan: TransportPlan = {
      planId: `TRANS-${uuidv4().slice(0, 8)}`,
      sessionId,
      factionId,
      commanderId: request.commanderId,
      type: request.type,
      cargo,
      totalCapacity,
      usedCapacity,
      originId: request.originId,
      originName: request.originName,
      destinationId: request.destinationId,
      destinationName: request.destinationName,
      route,
      distance,
      estimatedDuration,
      escortRequired,
      escortStrength,
      status: TransportStatus.PLANNING,
      priority,
      routeRisk,
      plannedAt: new Date(),
      cargoDelivered: 0,
    };

    const plans = this.transportPlans.get(sessionId) || [];
    plans.push(plan);
    this.transportPlans.set(sessionId, plans);

    this.emit('transport:planned', { sessionId, plan });
    logger.info(`[TransportService] Transport planned: ${plan.planId} (${request.type})`);

    return { success: true, plan };
  }

  /**
   * 경로 계산 (시뮬레이션)
   */
  private calculateRoute(
    sessionId: string,
    originId: string,
    destinationId: string,
  ): RouteWaypoint[] {
    // 실제로는 맵 데이터 기반으로 경로 계산
    // 여기서는 간단히 직선 경로 + 중간 웨이포인트 생성

    const waypoints: RouteWaypoint[] = [];

    // 출발지
    waypoints.push({
      waypointId: `WP-${uuidv4().slice(0, 6)}`,
      systemId: originId,
      systemName: originId,
      distanceFromPrev: 0,
      riskLevel: RouteRisk.SAFE,
    });

    // 중간 경유지 (랜덤 생성)
    const midpointCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < midpointCount; i++) {
      const distance = Math.floor(Math.random() * 20) + 5;
      const riskLevels = Object.values(RouteRisk);
      const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];

      waypoints.push({
        waypointId: `WP-${uuidv4().slice(0, 6)}`,
        systemId: `mid-${i + 1}`,
        systemName: `중간 경유지 ${i + 1}`,
        distanceFromPrev: distance,
        riskLevel,
      });
    }

    // 목적지
    waypoints.push({
      waypointId: `WP-${uuidv4().slice(0, 6)}`,
      systemId: destinationId,
      systemName: destinationId,
      distanceFromPrev: Math.floor(Math.random() * 15) + 5,
      riskLevel: RouteRisk.SAFE,
    });

    return waypoints;
  }

  /**
   * 경로 위험도 평가
   */
  private assessRouteRisk(route: RouteWaypoint[]): RouteRisk {
    const riskValues = {
      [RouteRisk.SAFE]: 0,
      [RouteRisk.LOW]: 1,
      [RouteRisk.MODERATE]: 2,
      [RouteRisk.HIGH]: 3,
      [RouteRisk.EXTREME]: 4,
    };

    const riskKeys = Object.keys(riskValues) as RouteRisk[];
    let maxRisk = 0;

    for (const wp of route) {
      const risk = riskValues[wp.riskLevel];
      if (risk > maxRisk) maxRisk = risk;
    }

    return riskKeys[maxRisk];
  }

  /**
   * 경로 최적화
   */
  public optimizeRoute(
    sessionId: string,
    planId: string,
    preference: 'SPEED' | 'SAFETY' | 'BALANCED',
  ): { success: boolean; plan?: TransportPlan; changes?: string[] } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false };
    }

    if (plan.status !== TransportStatus.PLANNING) {
      return { success: false };
    }

    const changes: string[] = [];

    switch (preference) {
      case 'SPEED':
        // 직선 경로로 변경, 위험도 무시
        plan.route = plan.route.filter((wp, i) =>
          i === 0 || i === plan.route.length - 1 || wp.riskLevel === RouteRisk.SAFE
        );
        plan.distance = plan.route.reduce((sum, wp) => sum + wp.distanceFromPrev, 0);
        plan.estimatedDuration = Math.ceil(plan.distance / 15); // 더 빠른 속도
        changes.push('최단 경로로 변경');
        break;

      case 'SAFETY':
        // 위험 구역 우회
        for (const wp of plan.route) {
          if (wp.riskLevel === RouteRisk.HIGH || wp.riskLevel === RouteRisk.EXTREME) {
            wp.distanceFromPrev *= 1.5; // 우회로 인한 거리 증가
            wp.riskLevel = RouteRisk.MODERATE;
          }
        }
        plan.distance = plan.route.reduce((sum, wp) => sum + wp.distanceFromPrev, 0);
        plan.estimatedDuration = Math.ceil(plan.distance / 8); // 더 느린 속도
        plan.routeRisk = this.assessRouteRisk(plan.route);
        changes.push('안전 경로로 변경 (우회)');
        break;

      case 'BALANCED':
        // 중간 수준
        plan.estimatedDuration = Math.ceil(plan.distance / 10);
        changes.push('균형 경로 적용');
        break;
    }

    // 호위 요구사항 재계산
    plan.escortStrength = Math.ceil(
      plan.totalCapacity * ESCORT_STRENGTH_MULTIPLIER[plan.routeRisk],
    );

    this.emit('transport:routeOptimized', { sessionId, plan, preference, changes });
    logger.info(`[TransportService] Route optimized: ${planId} (${preference})`);

    return { success: true, plan, changes };
  }

  // ============================================================
  // 호위 배치
  // ============================================================

  /**
   * 호위 배치
   */
  public assignEscort(
    sessionId: string,
    planId: string,
    assignment: Omit<EscortAssignment, 'assignmentId' | 'assignedAt'>,
  ): { success: boolean; plan?: TransportPlan; error?: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false, error: '수송 계획을 찾을 수 없습니다.' };
    }

    if (!plan.escortRequired) {
      return { success: false, error: '이 수송은 호위가 필요하지 않습니다.' };
    }

    // 호위 전력 검증
    if (assignment.totalShips < plan.escortStrength * 0.5) {
      return {
        success: false,
        error: `호위 전력이 부족합니다. 최소 ${Math.ceil(plan.escortStrength * 0.5)}척 필요.`,
      };
    }

    plan.assignedEscort = {
      ...assignment,
      assignmentId: `ESC-${uuidv4().slice(0, 8)}`,
      assignedAt: new Date(),
    };

    // 상태 변경
    if (plan.status === TransportStatus.WAITING_ESCORT) {
      plan.status = TransportStatus.LOADING;
    }

    this.emit('transport:escortAssigned', { sessionId, plan });
    logger.info(`[TransportService] Escort assigned: ${planId}`);

    return { success: true, plan };
  }

  /**
   * 호위 해제
   */
  public removeEscort(
    sessionId: string,
    planId: string,
  ): { success: boolean; error?: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false, error: '수송 계획을 찾을 수 없습니다.' };
    }

    if (plan.status === TransportStatus.IN_TRANSIT) {
      return { success: false, error: '이동 중에는 호위를 해제할 수 없습니다.' };
    }

    plan.assignedEscort = undefined;

    if (plan.escortRequired) {
      plan.status = TransportStatus.WAITING_ESCORT;
    }

    this.emit('transport:escortRemoved', { sessionId, planId });
    logger.info(`[TransportService] Escort removed: ${planId}`);

    return { success: true };
  }

  // ============================================================
  // 수송 실행
  // ============================================================

  /**
   * 수송 시작
   */
  public startTransport(
    sessionId: string,
    planId: string,
  ): { success: boolean; plan?: TransportPlan; error?: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false, error: '수송 계획을 찾을 수 없습니다.' };
    }

    // 상태 검증
    if (plan.status !== TransportStatus.PLANNING &&
        plan.status !== TransportStatus.LOADING) {
      return { success: false, error: '수송을 시작할 수 없는 상태입니다.' };
    }

    // 호위 필수인 경우 호위 검증
    if (plan.escortRequired && !plan.assignedEscort) {
      plan.status = TransportStatus.WAITING_ESCORT;
      return { success: false, error: '호위가 배치되지 않았습니다.', plan };
    }

    plan.status = TransportStatus.IN_TRANSIT;
    plan.departureTime = new Date();
    plan.arrivalTime = new Date(
      Date.now() + plan.estimatedDuration * 60 * 1000, // 틱 = 1분으로 가정
    );

    // 웨이포인트별 예상 도착 시간 설정
    let cumulativeTime = 0;
    for (const wp of plan.route) {
      cumulativeTime += (wp.distanceFromPrev / plan.distance) * plan.estimatedDuration;
      wp.arrivalTime = new Date(Date.now() + cumulativeTime * 60 * 1000);
    }

    this.emit('transport:started', { sessionId, plan });
    logger.info(`[TransportService] Transport started: ${planId}`);

    return { success: true, plan };
  }

  /**
   * 수송 중단
   */
  public abortTransport(
    sessionId: string,
    planId: string,
    reason: string,
  ): { success: boolean; error?: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false, error: '수송 계획을 찾을 수 없습니다.' };
    }

    if (plan.status === TransportStatus.COMPLETED ||
        plan.status === TransportStatus.INTERCEPTED) {
      return { success: false, error: '이미 완료된 수송입니다.' };
    }

    plan.status = TransportStatus.ABORTED;
    plan.completedAt = new Date();

    // 통계 업데이트
    this.updateStatistics(sessionId, plan.factionId, plan, false);

    this.emit('transport:aborted', { sessionId, plan, reason });
    logger.info(`[TransportService] Transport aborted: ${planId} (${reason})`);

    return { success: true };
  }

  // ============================================================
  // 요격 대응
  // ============================================================

  /**
   * 요격 발생 처리
   */
  public processInterception(
    sessionId: string,
    planId: string,
    interceptorFactionId: string,
    interceptorFleetId: string,
    interceptorStrength: number,
  ): { success: boolean; event?: InterceptionEvent; outcome: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false, outcome: '수송 계획을 찾을 수 없습니다.' };
    }

    if (plan.status !== TransportStatus.IN_TRANSIT) {
      return { success: false, outcome: '이동 중인 수송이 아닙니다.' };
    }

    plan.status = TransportStatus.UNDER_ATTACK;
    plan.interceptedBy = interceptorFactionId;

    // 전투 결과 계산
    const escortStrength = plan.assignedEscort?.totalShips || 0;
    const battleResult = this.resolveBattle(
      escortStrength,
      interceptorStrength,
      plan.assignedEscort?.engagementRules,
    );

    const event: InterceptionEvent = {
      eventId: `INTERCEPT-${uuidv4().slice(0, 8)}`,
      sessionId,
      transportPlanId: planId,
      interceptorFactionId,
      interceptorFleetId,
      location: plan.route.find(wp => wp.arrivalTime && wp.arrivalTime > new Date())?.systemName || 'unknown',
      occurredAt: new Date(),
      outcome: battleResult.outcome,
      cargoLost: battleResult.cargoLost,
      casualtiesTransport: battleResult.escortCasualties,
      casualtiesInterceptor: battleResult.interceptorCasualties,
      battleDuration: battleResult.duration,
    };

    const events = this.interceptionEvents.get(sessionId) || [];
    events.push(event);
    this.interceptionEvents.set(sessionId, events);

    // 결과에 따른 수송 상태 업데이트
    switch (battleResult.outcome) {
      case 'ESCAPED':
        plan.status = TransportStatus.IN_TRANSIT;
        plan.cargoDelivered = 100 - battleResult.cargoLost;
        break;
      case 'REPELLED':
        plan.status = TransportStatus.IN_TRANSIT;
        plan.cargoDelivered = 100;
        break;
      case 'DAMAGED':
        plan.status = TransportStatus.IN_TRANSIT;
        plan.cargoDelivered = 100 - battleResult.cargoLost;
        break;
      case 'CAPTURED':
      case 'DESTROYED':
        plan.status = TransportStatus.INTERCEPTED;
        plan.completedAt = new Date();
        plan.cargoDelivered = 0;
        plan.casualties = battleResult.escortCasualties;
        this.updateStatistics(sessionId, plan.factionId, plan, false);
        break;
    }

    this.emit('transport:intercepted', { sessionId, plan, event });
    logger.info(`[TransportService] Interception: ${planId} - ${battleResult.outcome}`);

    return { success: true, event, outcome: battleResult.outcome };
  }

  /**
   * 전투 결과 계산
   */
  private resolveBattle(
    escortStrength: number,
    interceptorStrength: number,
    engagementRules?: EngagementRules,
  ): {
    outcome: InterceptionEvent['outcome'];
    cargoLost: number;
    escortCasualties: number;
    interceptorCasualties: number;
    duration: number;
  } {
    // 전력 비율 계산
    const ratio = escortStrength / Math.max(interceptorStrength, 1);

    // 기본 전투 결과 판정
    let outcome: InterceptionEvent['outcome'];
    let cargoLost = 0;
    let escortCasualties = 0;
    let interceptorCasualties = 0;

    if (escortStrength === 0) {
      // 호위 없음 - 높은 확률로 피해
      const roll = Math.random();
      if (roll < 0.3) {
        outcome = 'ESCAPED';
        cargoLost = Math.floor(Math.random() * 30);
      } else if (roll < 0.7) {
        outcome = 'DAMAGED';
        cargoLost = Math.floor(Math.random() * 50) + 20;
      } else {
        outcome = 'CAPTURED';
        cargoLost = 100;
      }
    } else if (ratio >= 2.0) {
      // 압도적 호위 - 요격자 격퇴
      outcome = 'REPELLED';
      escortCasualties = Math.floor(interceptorStrength * 0.1);
      interceptorCasualties = Math.floor(interceptorStrength * 0.5);
    } else if (ratio >= 1.0) {
      // 균형 - 일부 피해 후 통과
      outcome = 'ESCAPED';
      cargoLost = Math.floor(Math.random() * 20);
      escortCasualties = Math.floor(escortStrength * 0.2);
      interceptorCasualties = Math.floor(interceptorStrength * 0.3);
    } else if (ratio >= 0.5) {
      // 열세 - 피해 발생
      const roll = Math.random();
      if (roll < 0.4) {
        outcome = 'ESCAPED';
        cargoLost = Math.floor(Math.random() * 40) + 10;
        escortCasualties = Math.floor(escortStrength * 0.4);
        interceptorCasualties = Math.floor(interceptorStrength * 0.2);
      } else {
        outcome = 'DAMAGED';
        cargoLost = Math.floor(Math.random() * 50) + 20;
        escortCasualties = Math.floor(escortStrength * 0.6);
        interceptorCasualties = Math.floor(interceptorStrength * 0.1);
      }
    } else {
      // 압도적 열세
      const roll = Math.random();
      if (roll < 0.5) {
        outcome = 'CAPTURED';
      } else {
        outcome = 'DESTROYED';
      }
      cargoLost = 100;
      escortCasualties = escortStrength;
      interceptorCasualties = Math.floor(interceptorStrength * 0.1);
    }

    // 교전 규칙 적용
    if (engagementRules?.protectCargoFirst && outcome !== 'REPELLED') {
      escortCasualties = Math.floor(escortCasualties * 1.3);
      cargoLost = Math.floor(cargoLost * 0.7);
    }

    // 전투 시간 (분)
    const duration = Math.floor(Math.random() * 30) + 10;

    return { outcome, cargoLost, escortCasualties, interceptorCasualties, duration };
  }

  /**
   * 요격 위험 체크 (매 틱)
   */
  public checkInterceptionRisk(
    sessionId: string,
    planId: string,
  ): { atRisk: boolean; chance: number; location?: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan || plan.status !== TransportStatus.IN_TRANSIT) {
      return { atRisk: false, chance: 0 };
    }

    // 현재 위치의 위험도 기반
    const baseChance = INTERCEPTION_BASE_CHANCE[plan.routeRisk];

    // 호위 여부에 따른 보정
    const escortModifier = plan.assignedEscort
      ? 0.5
      : 1.5;

    // 우선순위에 따른 보정 (긴급 수송은 더 눈에 띔)
    const priorityModifier = plan.priority === TransportPriority.EMERGENCY
      ? 1.3
      : 1.0;

    const finalChance = Math.min(100, baseChance * escortModifier * priorityModifier);

    // 현재 웨이포인트 확인
    const currentWp = plan.route.find(wp =>
      wp.arrivalTime && wp.arrivalTime > new Date()
    );

    return {
      atRisk: finalChance > 0,
      chance: Math.round(finalChance),
      location: currentWp?.systemName,
    };
  }

  // ============================================================
  // 수송 완료
  // ============================================================

  /**
   * 수송 완료 처리
   */
  public completeTransport(
    sessionId: string,
    planId: string,
  ): { success: boolean; plan?: TransportPlan; error?: string } {
    const plans = this.transportPlans.get(sessionId) || [];
    const plan = plans.find(p => p.planId === planId);

    if (!plan) {
      return { success: false, error: '수송 계획을 찾을 수 없습니다.' };
    }

    if (plan.status !== TransportStatus.IN_TRANSIT &&
        plan.status !== TransportStatus.ARRIVED) {
      return { success: false, error: '완료할 수 없는 상태입니다.' };
    }

    plan.status = TransportStatus.COMPLETED;
    plan.completedAt = new Date();

    if (plan.cargoDelivered === 0) {
      plan.cargoDelivered = 100; // 요격 없이 완료
    }

    // 통계 업데이트
    this.updateStatistics(sessionId, plan.factionId, plan, true);

    this.emit('transport:completed', { sessionId, plan });
    logger.info(`[TransportService] Transport completed: ${planId}, delivered: ${plan.cargoDelivered}%`);

    return { success: true, plan };
  }

  // ============================================================
  // 통계
  // ============================================================

  private updateStatistics(
    sessionId: string,
    factionId: string,
    plan: TransportPlan,
    success: boolean,
  ): void {
    const factionStats = this.statistics.get(sessionId) || new Map();
    let stats = factionStats.get(factionId);

    if (!stats) {
      stats = {
        sessionId,
        factionId,
        totalMissions: 0,
        successfulMissions: 0,
        failedMissions: 0,
        totalCargoDelivered: 0,
        totalCargoLost: 0,
        averageDeliveryRate: 100,
        totalDistanceTraveled: 0,
        interceptionsEvaded: 0,
        interceptionsSuccumbed: 0,
      };
      factionStats.set(factionId, stats);
      this.statistics.set(sessionId, factionStats);
    }

    stats.totalMissions++;
    if (success) {
      stats.successfulMissions++;
    } else {
      stats.failedMissions++;
    }

    stats.totalCargoDelivered += plan.cargoDelivered * plan.usedCapacity / 100;
    stats.totalCargoLost += (100 - plan.cargoDelivered) * plan.usedCapacity / 100;
    stats.totalDistanceTraveled += plan.distance;

    stats.averageDeliveryRate = (stats.totalCargoDelivered /
      (stats.totalCargoDelivered + stats.totalCargoLost)) * 100 || 100;

    if (plan.status === TransportStatus.INTERCEPTED) {
      stats.interceptionsSuccumbed++;
    } else if (plan.interceptedBy && plan.status === TransportStatus.COMPLETED) {
      stats.interceptionsEvaded++;
    }
  }

  public getStatistics(sessionId: string, factionId: string): TransportStatistics | undefined {
    return this.statistics.get(sessionId)?.get(factionId);
  }

  // ============================================================
  // 조회 API
  // ============================================================

  public getTransportPlan(sessionId: string, planId: string): TransportPlan | undefined {
    const plans = this.transportPlans.get(sessionId) || [];
    return plans.find(p => p.planId === planId);
  }

  public getTransportPlans(
    sessionId: string,
    filter?: {
      factionId?: string;
      status?: TransportStatus;
      type?: TransportType;
    },
  ): TransportPlan[] {
    let plans = this.transportPlans.get(sessionId) || [];

    if (filter?.factionId) {
      plans = plans.filter(p => p.factionId === filter.factionId);
    }
    if (filter?.status) {
      plans = plans.filter(p => p.status === filter.status);
    }
    if (filter?.type) {
      plans = plans.filter(p => p.type === filter.type);
    }

    return plans;
  }

  public getActiveTransports(sessionId: string, factionId?: string): TransportPlan[] {
    return this.getTransportPlans(sessionId, {
      factionId,
      status: TransportStatus.IN_TRANSIT,
    });
  }

  public getInterceptionEvents(
    sessionId: string,
    limit?: number,
  ): InterceptionEvent[] {
    let events = this.interceptionEvents.get(sessionId) || [];
    events = events.sort((a, b) =>
      b.occurredAt.getTime() - a.occurredAt.getTime()
    );

    if (limit) {
      events = events.slice(0, limit);
    }

    return events;
  }
}

export const transportService = TransportService.getInstance();
export default TransportService;







