/**
 * IntrusionOperationService - 침입공작 서비스
 * 매뉴얼 5460-5574행 기반 확장
 *
 * 적 영토/시설에 침입하여 목표를 수행하는 공작을 관리합니다.
 *
 * 목표 유형:
 * - DATA_THEFT: 데이터 탈취 - 기밀 정보 획득
 * - PLANTING_BUG: 도청 장치 설치 - 지속적 정보 수집
 * - SABOTAGE: 파괴 공작 - 시설/장비 파손
 * - RESCUE: 구출 - 억류자 구출
 * - ASSASSINATION: 암살 - 대상 제거
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

// ============================================================
// 타입 정의
// ============================================================

/**
 * 침입 상태
 */
export enum IntrusionStatus {
  PLANNING = 'PLANNING',           // 계획 수립 중
  APPROACHING = 'APPROACHING',     // 접근 중
  INFILTRATING = 'INFILTRATING',   // 침투 중
  OPERATING = 'OPERATING',         // 목표 수행 중
  EXFILTRATING = 'EXFILTRATING',   // 탈출 중
  COMPLETED = 'COMPLETED',         // 완료
  FAILED = 'FAILED',               // 실패
  ABORTED = 'ABORTED',             // 중단
}

/**
 * 침입 목표 유형
 */
export enum IntrusionObjective {
  DATA_THEFT = 'DATA_THEFT',           // 데이터 탈취
  PLANTING_BUG = 'PLANTING_BUG',       // 도청 장치 설치
  SABOTAGE = 'SABOTAGE',               // 파괴 공작
  RESCUE = 'RESCUE',                   // 구출
  ASSASSINATION = 'ASSASSINATION',     // 암살
}

/**
 * 경보 수준
 */
export enum AlertLevel {
  GREEN = 'GREEN',       // 정상
  YELLOW = 'YELLOW',     // 경계
  ORANGE = 'ORANGE',     // 고경계
  RED = 'RED',           // 최고경계
}

/**
 * 침입 공작 계획
 */
export interface IntrusionOperation {
  operationId: string;
  sessionId: string;
  status: IntrusionStatus;

  // 공작원
  operativeIds: string[];          // 참여 공작원 ID
  leadOperativeId: string;         // 지휘 공작원

  // 목표
  objective: IntrusionObjective;
  targetFaction: string;
  targetPlanetId: string;
  targetFacilityId?: string;
  targetCharacterId?: string;      // 구출/암살 대상
  targetDataId?: string;           // 탈취 대상 데이터

  // 상태
  alertLevel: AlertLevel;
  detectionRisk: number;           // 발각 위험 (0-100)
  progressPercent: number;         // 진행률 (0-100)

  // 경로 계획
  entryPoint?: string;
  exitPoint?: string;
  checkpoints: IntrusionCheckpoint[];

  // 시간
  plannedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration: number;       // 예상 소요 시간 (분)

  // 결과
  success?: boolean;
  acquiredData?: string[];
  bugPlanted?: boolean;
  damageDealt?: number;
  rescuedCharacterId?: string;
  assassinationConfirmed?: boolean;
  resultNotes?: string;
}

/**
 * 침입 체크포인트
 */
export interface IntrusionCheckpoint {
  checkpointId: string;
  name: string;
  type: 'ENTRY' | 'WAYPOINT' | 'OBJECTIVE' | 'EXIT';
  securityLevel: number;           // 보안 수준 (1-10)
  passed: boolean;
  passedAt?: Date;
}

/**
 * 침입 결과
 */
export interface IntrusionResult {
  success: boolean;
  operationId?: string;
  message: string;
  phase?: IntrusionStatus;
  alertLevelChange?: AlertLevel;
  acquiredData?: string[];
  cpCost: number;
}

// ============================================================
// 기본 설정
// ============================================================

const OBJECTIVE_CONFIG: Record<IntrusionObjective, {
  baseDuration: number;        // 기본 소요 시간 (분)
  baseSuccessRate: number;
  baseDetectionRisk: number;
  cpCost: number;
}> = {
  [IntrusionObjective.DATA_THEFT]: {
    baseDuration: 60, baseSuccessRate: 0.6, baseDetectionRisk: 30, cpCost: 160,
  },
  [IntrusionObjective.PLANTING_BUG]: {
    baseDuration: 45, baseSuccessRate: 0.7, baseDetectionRisk: 25, cpCost: 120,
  },
  [IntrusionObjective.SABOTAGE]: {
    baseDuration: 90, baseSuccessRate: 0.5, baseDetectionRisk: 50, cpCost: 200,
  },
  [IntrusionObjective.RESCUE]: {
    baseDuration: 120, baseSuccessRate: 0.4, baseDetectionRisk: 60, cpCost: 320,
  },
  [IntrusionObjective.ASSASSINATION]: {
    baseDuration: 90, baseSuccessRate: 0.3, baseDetectionRisk: 70, cpCost: 400,
  },
};

const ALERT_DETECTION_MOD: Record<AlertLevel, number> = {
  [AlertLevel.GREEN]: 1.0,
  [AlertLevel.YELLOW]: 1.3,
  [AlertLevel.ORANGE]: 1.6,
  [AlertLevel.RED]: 2.0,
};

// ============================================================
// IntrusionOperationService 클래스
// ============================================================

export class IntrusionOperationService extends EventEmitter {
  private static instance: IntrusionOperationService;
  private operations: Map<string, IntrusionOperation[]> = new Map();

  private constructor() {
    super();
    logger.info('[IntrusionOperationService] Initialized');
  }

  public static getInstance(): IntrusionOperationService {
    if (!IntrusionOperationService.instance) {
      IntrusionOperationService.instance = new IntrusionOperationService();
    }
    return IntrusionOperationService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.operations.set(sessionId, []);
    logger.info(`[IntrusionOperationService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.operations.delete(sessionId);
    logger.info(`[IntrusionOperationService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 침입 계획 (planIntrusion)
  // ============================================================

  /**
   * 침입 계획 수립
   */
  public async planIntrusion(
    sessionId: string,
    leadOperativeId: string,
    objective: IntrusionObjective,
    targetPlanetId: string,
    targetFacilityId?: string,
    targetCharacterId?: string,
    additionalOperativeIds?: string[],
  ): Promise<IntrusionResult> {
    const config = OBJECTIVE_CONFIG[objective];
    const cpCost = config.cpCost;

    try {
      const leadOperative = await Gin7Character.findOne({ sessionId, characterId: leadOperativeId });
      if (!leadOperative) {
        return { success: false, message: '지휘 공작원을 찾을 수 없습니다.', cpCost: 0 };
      }

      const targetPlanet = await Planet.findOne({ sessionId, planetId: targetPlanetId });
      if (!targetPlanet) {
        return { success: false, message: '대상 행성을 찾을 수 없습니다.', cpCost: 0 };
      }

      // 암살/구출 목표 검증
      if ((objective === IntrusionObjective.ASSASSINATION || objective === IntrusionObjective.RESCUE)
          && !targetCharacterId) {
        return { success: false, message: '대상 인물을 지정해야 합니다.', cpCost: 0 };
      }

      // 체크포인트 생성
      const checkpoints = this.generateCheckpoints(objective, targetFacilityId);

      // 침입 공작 생성
      const operation: IntrusionOperation = {
        operationId: `INTR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        status: IntrusionStatus.PLANNING,
        operativeIds: [leadOperativeId, ...(additionalOperativeIds || [])],
        leadOperativeId,
        objective,
        targetFaction: targetPlanet.faction || 'unknown',
        targetPlanetId,
        targetFacilityId,
        targetCharacterId,
        alertLevel: AlertLevel.GREEN,
        detectionRisk: config.baseDetectionRisk,
        progressPercent: 0,
        checkpoints,
        plannedAt: new Date(),
        estimatedDuration: config.baseDuration,
      };

      this.operations.get(sessionId)?.push(operation);

      this.emit('intrusion:planned', { sessionId, operation });
      logger.info(`[IntrusionOperationService] Intrusion planned: ${operation.operationId}`);

      return {
        success: true,
        operationId: operation.operationId,
        message: `침입 공작 계획이 수립되었습니다. 목표: ${objective}`,
        phase: IntrusionStatus.PLANNING,
        cpCost: cpCost / 2,  // 계획 시 반값
      };
    } catch (error) {
      logger.error('[IntrusionOperationService] Plan intrusion error:', error);
      return { success: false, message: '침입 계획 수립 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 잠입 실행 (executeInfiltration)
  // ============================================================

  /**
   * 잠입 실행 (침입 시작)
   */
  public async executeInfiltration(
    sessionId: string,
    operationId: string,
  ): Promise<IntrusionResult> {
    const operation = this.getOperation(sessionId, operationId);
    if (!operation) {
      return { success: false, message: '침입 공작을 찾을 수 없습니다.', cpCost: 0 };
    }

    if (operation.status !== IntrusionStatus.PLANNING) {
      return { success: false, message: `현재 상태(${operation.status})에서는 잠입을 시작할 수 없습니다.`, cpCost: 0 };
    }

    const config = OBJECTIVE_CONFIG[operation.objective];
    const cpCost = config.cpCost / 2;

    try {
      operation.status = IntrusionStatus.APPROACHING;
      operation.startedAt = new Date();

      // 초기 접근 성공 체크
      const leadOp = await Gin7Character.findOne({
        sessionId, characterId: operation.leadOperativeId,
      });
      const skillBonus = (leadOp?.stats?.intellect || 50) / 200;
      const approachSuccess = Math.random() < (0.8 + skillBonus);

      if (!approachSuccess) {
        operation.alertLevel = AlertLevel.YELLOW;
        operation.detectionRisk += 15;

        this.emit('intrusion:approach_detected', { sessionId, operation });

        return {
          success: true,
          operationId,
          message: '접근 중 탐지되었습니다. 경계 수준이 높아졌습니다.',
          phase: IntrusionStatus.APPROACHING,
          alertLevelChange: AlertLevel.YELLOW,
          cpCost,
        };
      }

      // 침투 단계로 전환
      operation.status = IntrusionStatus.INFILTRATING;
      operation.progressPercent = 10;

      // 진입점 체크포인트 통과
      const entryCheckpoint = operation.checkpoints.find(c => c.type === 'ENTRY');
      if (entryCheckpoint) {
        entryCheckpoint.passed = true;
        entryCheckpoint.passedAt = new Date();
      }

      this.emit('intrusion:infiltrating', { sessionId, operation });
      logger.info(`[IntrusionOperationService] Infiltration started: ${operationId}`);

      return {
        success: true,
        operationId,
        message: '성공적으로 침투를 시작했습니다.',
        phase: IntrusionStatus.INFILTRATING,
        cpCost,
      };
    } catch (error) {
      logger.error('[IntrusionOperationService] Execute infiltration error:', error);
      return { success: false, message: '잠입 실행 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 목표 수행 (executeObjective)
  // ============================================================

  /**
   * 목표 수행
   */
  public async executeObjective(
    sessionId: string,
    operationId: string,
  ): Promise<IntrusionResult> {
    const operation = this.getOperation(sessionId, operationId);
    if (!operation) {
      return { success: false, message: '침입 공작을 찾을 수 없습니다.', cpCost: 0 };
    }

    if (operation.status !== IntrusionStatus.INFILTRATING) {
      return { success: false, message: `현재 상태(${operation.status})에서는 목표를 수행할 수 없습니다.`, cpCost: 0 };
    }

    const config = OBJECTIVE_CONFIG[operation.objective];
    const cpCost = 80;

    try {
      operation.status = IntrusionStatus.OPERATING;

      // 경보 수준에 따른 성공률 조정
      const alertMod = ALERT_DETECTION_MOD[operation.alertLevel];
      const detectionCheck = (operation.detectionRisk * alertMod) / 100;

      // 발각 체크
      if (Math.random() < detectionCheck) {
        operation.alertLevel = this.increaseAlertLevel(operation.alertLevel);
        operation.detectionRisk += 20;

        // 최고 경계 시 실패 가능
        if (operation.alertLevel === AlertLevel.RED && Math.random() < 0.5) {
          operation.status = IntrusionStatus.FAILED;
          operation.completedAt = new Date();
          operation.success = false;
          operation.resultNotes = '목표 수행 중 발각되어 실패';

          this.emit('intrusion:failed', { sessionId, operation });

          return {
            success: false,
            operationId,
            message: '발각되어 목표 수행에 실패했습니다.',
            phase: IntrusionStatus.FAILED,
            cpCost,
          };
        }
      }

      // 목표 수행 성공률 계산
      const leadOp = await Gin7Character.findOne({
        sessionId, characterId: operation.leadOperativeId,
      });
      const skillBonus = (leadOp?.stats?.intellect || 50) / 200;
      const teamBonus = Math.min(0.2, operation.operativeIds.length * 0.05);
      const successRate = Math.min(0.9, config.baseSuccessRate + skillBonus + teamBonus);

      const success = Math.random() < successRate;

      if (success) {
        // 목표 유형별 결과 처리
        const result = await this.processObjectiveSuccess(sessionId, operation);

        operation.progressPercent = 80;
        operation.status = IntrusionStatus.EXFILTRATING;

        // 목표 체크포인트 통과
        const objCheckpoint = operation.checkpoints.find(c => c.type === 'OBJECTIVE');
        if (objCheckpoint) {
          objCheckpoint.passed = true;
          objCheckpoint.passedAt = new Date();
        }

        this.emit('intrusion:objective_completed', { sessionId, operation, result });
        logger.info(`[IntrusionOperationService] Objective completed: ${operationId}`);

        return {
          success: true,
          operationId,
          message: `목표 수행 완료: ${result.message}`,
          phase: IntrusionStatus.EXFILTRATING,
          acquiredData: result.acquiredData,
          cpCost,
        };
      } else {
        // 목표 수행 실패
        operation.detectionRisk += 15;

        return {
          success: false,
          operationId,
          message: '목표 수행에 실패했습니다. 재시도하거나 탈출하세요.',
          phase: IntrusionStatus.OPERATING,
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[IntrusionOperationService] Execute objective error:', error);
      return { success: false, message: '목표 수행 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 탈출 (executeExfiltration)
  // ============================================================

  /**
   * 탈출 실행
   */
  public async executeExfiltration(
    sessionId: string,
    operationId: string,
  ): Promise<IntrusionResult> {
    const operation = this.getOperation(sessionId, operationId);
    if (!operation) {
      return { success: false, message: '침입 공작을 찾을 수 없습니다.', cpCost: 0 };
    }

    if (operation.status !== IntrusionStatus.EXFILTRATING &&
        operation.status !== IntrusionStatus.OPERATING &&
        operation.status !== IntrusionStatus.INFILTRATING) {
      return { success: false, message: `현재 상태(${operation.status})에서는 탈출할 수 없습니다.`, cpCost: 0 };
    }

    const cpCost = 80;

    try {
      const wasObjectiveCompleted = operation.status === IntrusionStatus.EXFILTRATING;
      operation.status = IntrusionStatus.EXFILTRATING;

      // 탈출 성공률 계산
      const alertPenalty = {
        [AlertLevel.GREEN]: 0,
        [AlertLevel.YELLOW]: 0.1,
        [AlertLevel.ORANGE]: 0.25,
        [AlertLevel.RED]: 0.4,
      }[operation.alertLevel];

      const leadOp = await Gin7Character.findOne({
        sessionId, characterId: operation.leadOperativeId,
      });
      const skillBonus = ((leadOp?.stats?.agility || 50) + (leadOp?.stats?.intellect || 50)) / 400;
      const exfilRate = Math.min(0.9, 0.7 + skillBonus - alertPenalty);

      const escaped = Math.random() < exfilRate;

      if (escaped) {
        operation.status = IntrusionStatus.COMPLETED;
        operation.completedAt = new Date();
        operation.success = wasObjectiveCompleted;
        operation.progressPercent = 100;

        // 탈출 체크포인트 통과
        const exitCheckpoint = operation.checkpoints.find(c => c.type === 'EXIT');
        if (exitCheckpoint) {
          exitCheckpoint.passed = true;
          exitCheckpoint.passedAt = new Date();
        }

        this.emit('intrusion:completed', { sessionId, operation });
        logger.info(`[IntrusionOperationService] Exfiltration completed: ${operationId}`);

        return {
          success: true,
          operationId,
          message: wasObjectiveCompleted
            ? '목표 수행 후 안전하게 탈출했습니다!'
            : '목표를 완수하지 못했지만 안전하게 탈출했습니다.',
          phase: IntrusionStatus.COMPLETED,
          acquiredData: operation.acquiredData,
          cpCost,
        };
      } else {
        // 탈출 실패
        operation.alertLevel = this.increaseAlertLevel(operation.alertLevel);

        if (operation.alertLevel === AlertLevel.RED && Math.random() < 0.4) {
          // 체포
          operation.status = IntrusionStatus.FAILED;
          operation.completedAt = new Date();
          operation.success = false;
          operation.resultNotes = '탈출 중 체포됨';

          // 공작원 상태 변경
          for (const opId of operation.operativeIds) {
            await Gin7Character.updateOne(
              { sessionId, characterId: opId },
              {
                $set: {
                  status: 'DETAINED',
                  'detentionDetails.reason': '침입 공작 중 체포',
                  'detentionDetails.detainedAt': new Date(),
                },
              },
            );
          }

          this.emit('intrusion:captured', { sessionId, operation });

          return {
            success: false,
            operationId,
            message: '탈출 중 체포되었습니다.',
            phase: IntrusionStatus.FAILED,
            cpCost,
          };
        }

        operation.detectionRisk += 20;

        return {
          success: false,
          operationId,
          message: '탈출 시도 실패. 경계 수준이 높아졌습니다. 재시도하세요.',
          phase: IntrusionStatus.EXFILTRATING,
          alertLevelChange: operation.alertLevel,
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[IntrusionOperationService] Execute exfiltration error:', error);
      return { success: false, message: '탈출 실행 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 유틸리티 메서드
  // ============================================================

  private getOperation(sessionId: string, operationId: string): IntrusionOperation | undefined {
    return this.operations.get(sessionId)?.find(o => o.operationId === operationId);
  }

  private generateCheckpoints(objective: IntrusionObjective, facilityId?: string): IntrusionCheckpoint[] {
    const checkpoints: IntrusionCheckpoint[] = [
      {
        checkpointId: `CP-${Date.now()}-entry`,
        name: '진입 지점',
        type: 'ENTRY',
        securityLevel: 3,
        passed: false,
      },
      {
        checkpointId: `CP-${Date.now()}-wp1`,
        name: '경비 초소',
        type: 'WAYPOINT',
        securityLevel: 5,
        passed: false,
      },
      {
        checkpointId: `CP-${Date.now()}-obj`,
        name: '목표 지점',
        type: 'OBJECTIVE',
        securityLevel: objective === IntrusionObjective.ASSASSINATION ? 8 : 6,
        passed: false,
      },
      {
        checkpointId: `CP-${Date.now()}-exit`,
        name: '탈출 지점',
        type: 'EXIT',
        securityLevel: 4,
        passed: false,
      },
    ];

    return checkpoints;
  }

  private increaseAlertLevel(current: AlertLevel): AlertLevel {
    const order = [AlertLevel.GREEN, AlertLevel.YELLOW, AlertLevel.ORANGE, AlertLevel.RED];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  private async processObjectiveSuccess(
    sessionId: string,
    operation: IntrusionOperation,
  ): Promise<{ message: string; acquiredData?: string[] }> {
    switch (operation.objective) {
      case IntrusionObjective.DATA_THEFT:
        const data = [
          '군사 배치 계획',
          '함대 이동 일정',
          '기밀 통신 기록',
        ];
        operation.acquiredData = data;
        return { message: '기밀 데이터 탈취 완료', acquiredData: data };

      case IntrusionObjective.PLANTING_BUG:
        operation.bugPlanted = true;
        return { message: '도청 장치 설치 완료' };

      case IntrusionObjective.SABOTAGE:
        operation.damageDealt = 30 + Math.floor(Math.random() * 40);
        return { message: `파괴 공작 완료. 피해: ${operation.damageDealt}%` };

      case IntrusionObjective.RESCUE:
        if (operation.targetCharacterId) {
          operation.rescuedCharacterId = operation.targetCharacterId;
          await Gin7Character.updateOne(
            { sessionId, characterId: operation.targetCharacterId },
            { $set: { status: 'ACTIVE', detentionDetails: null } },
          );
        }
        return { message: '구출 작전 완료' };

      case IntrusionObjective.ASSASSINATION:
        operation.assassinationConfirmed = true;
        if (operation.targetCharacterId) {
          await Gin7Character.updateOne(
            { sessionId, characterId: operation.targetCharacterId },
            {
              $set: {
                status: 'DEAD',
                'deathDetails.cause': 'ASSASSINATION',
                'deathDetails.diedAt': new Date(),
              },
            },
          );
        }
        return { message: '암살 임무 완료' };

      default:
        return { message: '목표 완료' };
    }
  }

  // ============================================================
  // 조회 메서드
  // ============================================================

  public getOperations(sessionId: string): IntrusionOperation[] {
    return this.operations.get(sessionId) || [];
  }

  public getActiveOperations(sessionId: string): IntrusionOperation[] {
    return (this.operations.get(sessionId) || [])
      .filter(o => ![IntrusionStatus.COMPLETED, IntrusionStatus.FAILED, IntrusionStatus.ABORTED]
        .includes(o.status));
  }

  public getOperationsByOperative(sessionId: string, operativeId: string): IntrusionOperation[] {
    return (this.operations.get(sessionId) || [])
      .filter(o => o.operativeIds.includes(operativeId));
  }

  public processGameTick(sessionId: string): void {
    const ops = this.operations.get(sessionId);
    if (!ops) return;

    for (const op of ops) {
      if (op.status === IntrusionStatus.INFILTRATING || op.status === IntrusionStatus.OPERATING) {
        // 시간 경과에 따른 발각 위험 증가
        op.detectionRisk = Math.min(100, op.detectionRisk + 0.5);

        // 랜덤 경보 상승
        if (Math.random() < op.detectionRisk / 500) {
          op.alertLevel = this.increaseAlertLevel(op.alertLevel);
          this.emit('intrusion:alert_raised', { sessionId, operationId: op.operationId });
        }
      }
    }
  }
}

export const intrusionOperationService = IntrusionOperationService.getInstance();
export default IntrusionOperationService;







