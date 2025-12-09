/**
 * OperationService - 작전 계획 시스템 서비스
 * 매뉴얼 1798~1895행 기반
 * 
 * 주요 기능:
 * - 작전 계획 수립
 * - 작전 발령 (부대 배정)
 * - 작전 진행 상태 관리
 * - 작전 결과 판정 및 공적 분배
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';
import {
  OperationType,
  OperationStatus,
  OPERATION_TYPE_DEFINITIONS,
  calculateOperationPlanningCost,
  calculateOperationIssuanceCost,
  calculateOperationMeritBonus,
} from '../../constants/gin7/operation_definitions';

/**
 * 작전 계획 인터페이스
 */
export interface Operation {
  operationId: string;
  sessionId: string;
  type: OperationType;
  status: OperationStatus;
  
  // 계획 정보
  plannerId: string;          // 계획 수립자 ID
  targetSystemId: string;     // 목표 성계 ID
  participatingFleetCount: number; // 참여 함대 수
  plannedActivationTime: Date; // 발동 예정 시각 (게임 시간)
  
  // 발령 정보
  issuerId?: string;          // 발령자 ID
  issuedAt?: Date;            // 발령 시각
  assignedFleetIds: string[]; // 배정된 함대 ID 목록
  
  // 진행 정보
  startedAt?: Date;           // 작전 개시 시각
  endAt?: Date;               // 작전 종료 예정 시각
  
  // 결과 정보
  result?: 'FULL_SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
  resultDetails?: string;
  meritAwarded?: number;      // 지급된 총 공적
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 작전 계획 수립 결과
 */
export interface PlanOperationResult {
  success: boolean;
  error?: string;
  operation?: Operation;
  cpCost?: number;
}

/**
 * 작전 발령 결과
 */
export interface IssueOperationResult {
  success: boolean;
  error?: string;
  operation?: Operation;
  cpCost?: number;
}

/**
 * OperationService 클래스
 */
export class OperationService extends EventEmitter {
  private static instance: OperationService;
  
  // 메모리 내 작전 저장소 (실제로는 MongoDB 사용)
  private operations: Map<string, Operation> = new Map();

  private constructor() {
    super();
    logger.info('[OperationService] Initialized');
  }

  public static getInstance(): OperationService {
    if (!OperationService.instance) {
      OperationService.instance = new OperationService();
    }
    return OperationService.instance;
  }

  /**
   * 작전 계획 수립
   */
  public async planOperation(
    sessionId: string,
    plannerId: string,
    type: OperationType,
    targetSystemId: string,
    participatingFleetCount: number,
    activationDelayHours: number  // 발동까지 대기 시간 (게임 시간)
  ): Promise<PlanOperationResult> {
    try {
      // 권한 확인 (통수부 작전과장 등)
      const hasAuthority = await this.checkPlanningAuthority(sessionId, plannerId, type);
      if (!hasAuthority) {
        return { success: false, error: '작전 계획 권한이 없습니다.' };
      }

      // 목표 성계 유효성 확인
      const isValidTarget = await this.validateTargetSystem(sessionId, type, targetSystemId, plannerId);
      if (!isValidTarget.valid) {
        return { success: false, error: isValidTarget.error };
      }

      // 중복 작전 확인 (같은 카드에서 같은 목표 성계)
      const duplicateOp = await this.checkDuplicateOperation(sessionId, plannerId, targetSystemId);
      if (duplicateOp) {
        return { success: false, error: '이미 해당 성계에 대한 작전이 계획되어 있습니다.' };
      }

      // CP 비용 계산
      const cpCost = calculateOperationPlanningCost(activationDelayHours, participatingFleetCount);

      // 작전 생성
      const operationId = `OP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date();
      const activationTime = new Date(now.getTime() + activationDelayHours * 60 * 60 * 1000);

      const operation: Operation = {
        operationId,
        sessionId,
        type,
        status: OperationStatus.PLANNED,
        plannerId,
        targetSystemId,
        participatingFleetCount,
        plannedActivationTime: activationTime,
        assignedFleetIds: [],
        createdAt: now,
        updatedAt: now,
      };

      this.operations.set(operationId, operation);

      // 이벤트 발생
      this.emit('OPERATION_PLANNED', {
        sessionId,
        operationId,
        type,
        targetSystemId,
        plannerId,
      });

      logger.info(`[OperationService] Operation planned: ${operationId}, type: ${type}, target: ${targetSystemId}`);

      return { success: true, operation, cpCost };
    } catch (error: any) {
      logger.error(`[OperationService] Error planning operation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 작전 발령 (부대 배정)
   */
  public async issueOperation(
    sessionId: string,
    issuerId: string,
    operationId: string,
    fleetIds: string[]
  ): Promise<IssueOperationResult> {
    try {
      const operation = this.operations.get(operationId);
      if (!operation || operation.sessionId !== sessionId) {
        return { success: false, error: '작전을 찾을 수 없습니다.' };
      }

      if (operation.status !== OperationStatus.PLANNED) {
        return { success: false, error: '발령할 수 없는 상태입니다.' };
      }

      // 권한 확인 (우주함대사령장관 등)
      const hasAuthority = await this.checkIssuanceAuthority(sessionId, issuerId);
      if (!hasAuthority) {
        return { success: false, error: '작전 발령 권한이 없습니다.' };
      }

      // 발동 시기 확인
      const now = new Date();
      if (now < operation.plannedActivationTime) {
        return { success: false, error: '아직 발동 예정 시기가 되지 않았습니다.' };
      }

      // 부대 수 확인
      if (fleetIds.length !== operation.participatingFleetCount) {
        return {
          success: false,
          error: `계획된 함대 수(${operation.participatingFleetCount})와 배정 함대 수(${fleetIds.length})가 일치하지 않습니다.`,
        };
      }

      // CP 비용 계산
      const cpCost = calculateOperationIssuanceCost(fleetIds.length);

      // 작전 상태 업데이트
      operation.status = OperationStatus.ACTIVE;
      operation.issuerId = issuerId;
      operation.issuedAt = now;
      operation.assignedFleetIds = fleetIds;
      operation.updatedAt = now;

      // 이벤트 발생
      this.emit('OPERATION_ISSUED', {
        sessionId,
        operationId,
        issuerId,
        fleetIds,
      });

      logger.info(`[OperationService] Operation issued: ${operationId}, fleets: ${fleetIds.join(', ')}`);

      return { success: true, operation, cpCost };
    } catch (error: any) {
      logger.error(`[OperationService] Error issuing operation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 작전 개시 (목표 도달 시 호출)
   */
  public async startOperation(
    operationId: string,
    currentGameTime: Date
  ): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== OperationStatus.ACTIVE) {
      return false;
    }

    const typeDef = OPERATION_TYPE_DEFINITIONS[operation.type];
    if (!typeDef) return false;

    operation.status = OperationStatus.IN_PROGRESS;
    operation.startedAt = currentGameTime;
    operation.endAt = new Date(currentGameTime.getTime() + typeDef.durationGameDays * 24 * 60 * 60 * 1000);
    operation.updatedAt = new Date();

    // 이벤트 발생
    this.emit('OPERATION_STARTED', {
      sessionId: operation.sessionId,
      operationId,
      endAt: operation.endAt,
    });

    logger.info(`[OperationService] Operation started: ${operationId}`);

    return true;
  }

  /**
   * 작전 결과 판정
   */
  public async evaluateOperationResult(
    operationId: string,
    systemControlStatus: {
      totalPlanets: number;
      controlledPlanets: number;
      initialControlledPlanets: number;
    },
    enemiesDestroyed: number = 0
  ): Promise<{
    result: 'FULL_SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
    meritPerParticipant: number;
  }> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return { result: 'FAILURE', meritPerParticipant: 0 };
    }

    const typeDef = OPERATION_TYPE_DEFINITIONS[operation.type];
    let result: 'FULL_SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';

    switch (operation.type) {
      case OperationType.OCCUPATION:
        // 점령 작전: 모든 행성 점령 = 성공, 1개 이상 점령 = 부분 성공
        if (systemControlStatus.controlledPlanets === systemControlStatus.totalPlanets) {
          result = 'FULL_SUCCESS';
        } else if (systemControlStatus.controlledPlanets > 0) {
          result = 'PARTIAL_SUCCESS';
        } else {
          result = 'FAILURE';
        }
        break;

      case OperationType.DEFENSE:
        // 방어 작전: 모든 행성 유지 = 성공, 일부 상실 = 부분 성공
        if (systemControlStatus.controlledPlanets === systemControlStatus.initialControlledPlanets) {
          result = 'FULL_SUCCESS';
        } else if (systemControlStatus.controlledPlanets > 0) {
          result = 'PARTIAL_SUCCESS';
        } else {
          result = 'FAILURE';
        }
        break;

      case OperationType.MOPUP:
        // 소탕 작전: 격침당 보너스 (실패 없음)
        result = enemiesDestroyed > 0 ? 'FULL_SUCCESS' : 'FAILURE';
        break;

      default:
        result = 'FAILURE';
    }

    const isFullSuccess = result === 'FULL_SUCCESS';
    const participantCount = operation.assignedFleetIds.length;
    const meritPerParticipant = calculateOperationMeritBonus(
      operation.type,
      isFullSuccess,
      participantCount,
      enemiesDestroyed
    );

    // 작전 상태 업데이트
    operation.status = result === 'FAILURE' ? OperationStatus.FAILURE : OperationStatus.SUCCESS;
    operation.result = result;
    operation.meritAwarded = meritPerParticipant * participantCount;
    operation.updatedAt = new Date();

    // 이벤트 발생
    this.emit('OPERATION_COMPLETED', {
      sessionId: operation.sessionId,
      operationId,
      result,
      meritPerParticipant,
      totalMerit: operation.meritAwarded,
    });

    logger.info(`[OperationService] Operation completed: ${operationId}, result: ${result}, merit: ${meritPerParticipant}/participant`);

    return { result, meritPerParticipant };
  }

  /**
   * 작전 취소 (철회)
   */
  public async cancelOperation(
    sessionId: string,
    operationId: string,
    cancellerId: string
  ): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.sessionId !== sessionId) {
      return false;
    }

    // 진행 중인 작전은 취소 불가
    if (operation.status === OperationStatus.IN_PROGRESS) {
      return false;
    }

    // 계획자만 취소 가능
    if (operation.plannerId !== cancellerId) {
      return false;
    }

    operation.status = OperationStatus.CANCELLED;
    operation.updatedAt = new Date();

    // 이벤트 발생
    this.emit('OPERATION_CANCELLED', {
      sessionId,
      operationId,
      cancellerId,
    });

    logger.info(`[OperationService] Operation cancelled: ${operationId}`);

    return true;
  }

  /**
   * 작전 조회
   */
  public getOperation(operationId: string): Operation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * 세션의 활성 작전 목록 조회
   */
  public getActiveOperations(sessionId: string): Operation[] {
    return Array.from(this.operations.values()).filter(
      op => op.sessionId === sessionId && 
        (op.status === OperationStatus.PLANNED || 
         op.status === OperationStatus.ACTIVE || 
         op.status === OperationStatus.IN_PROGRESS)
    );
  }

  /**
   * 캐릭터가 참여 중인 작전 조회
   */
  public getOperationsForCharacter(sessionId: string, characterId: string): Operation[] {
    return Array.from(this.operations.values()).filter(
      op => op.sessionId === sessionId && 
        (op.plannerId === characterId || 
         op.issuerId === characterId ||
         op.assignedFleetIds.includes(characterId))
    );
  }

  // ==================== Private Helper Methods ====================

  /**
   * 작전 계획 권한 확인
   */
  private async checkPlanningAuthority(
    sessionId: string,
    plannerId: string,
    type: OperationType
  ): Promise<boolean> {
    // TODO: 실제 권한 확인 로직 구현
    // 통수부 작전과장(제국) / 통합작전본부장(동맹)
    return true;
  }

  /**
   * 작전 발령 권한 확인
   */
  private async checkIssuanceAuthority(
    sessionId: string,
    issuerId: string
  ): Promise<boolean> {
    // TODO: 실제 권한 확인 로직 구현
    // 우주함대사령장관 또는 동급
    return true;
  }

  /**
   * 목표 성계 유효성 확인
   */
  private async validateTargetSystem(
    sessionId: string,
    type: OperationType,
    targetSystemId: string,
    plannerId: string
  ): Promise<{ valid: boolean; error?: string }> {
    const typeDef = OPERATION_TYPE_DEFINITIONS[type];
    if (!typeDef) {
      return { valid: false, error: '알 수 없는 작전 유형입니다.' };
    }

    // TODO: 실제 성계 소유권 확인 로직 구현
    // targetType에 따라 적 성계/아군 성계/모든 성계 확인

    return { valid: true };
  }

  /**
   * 중복 작전 확인
   */
  private async checkDuplicateOperation(
    sessionId: string,
    plannerId: string,
    targetSystemId: string
  ): Promise<Operation | undefined> {
    return Array.from(this.operations.values()).find(
      op => op.sessionId === sessionId &&
        op.plannerId === plannerId &&
        op.targetSystemId === targetSystemId &&
        op.status !== OperationStatus.CANCELLED &&
        op.status !== OperationStatus.SUCCESS &&
        op.status !== OperationStatus.FAILURE
    );
  }

  // ============================================================
  // Command wrapper methods for CommandCommandService
  // ============================================================

  /**
   * 작전 생성 - planOperation 래퍼
   */
  public async createOperation(
    params: {
      sessionId: string;
      creatorId: string;
      factionId?: string;
      objective: string;
      targetId?: string;
      scale?: string;
      expectedDuration?: number;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string; operationId?: string }> {
    try {
      const result = await this.planOperation(
        params.sessionId,
        params.creatorId,
        params.objective as OperationType,
        params.targetId || '',
        1, // participatingFleetCount
        params.expectedDuration || 24 // activationDelayHours
      );
      return { success: result.success, error: result.error, operationId: result.operation?.operationId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 함대 작전 배정
   */
  public async assignFleet(
    operationId: string,
    fleetId: string,
    role?: string
  ): Promise<{ success: boolean; error?: string }> {
    const operation = this.getOperation(operationId);
    if (!operation) {
      return { success: false, error: '작전을 찾을 수 없습니다.' };
    }
    
    // 배정된 함대 목록에 추가
    if (!operation.assignedFleetIds) {
      operation.assignedFleetIds = [];
    }
    if (!operation.assignedFleetIds.includes(fleetId)) {
      operation.assignedFleetIds.push(fleetId);
      operation.participatingFleetCount = operation.assignedFleetIds.length;
    }
    
    return { success: true };
  }
}

export const operationService = OperationService.getInstance();
export default OperationService;





