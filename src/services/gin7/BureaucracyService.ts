/**
 * GIN7 Bureaucracy Service
 * 
 * 관료제적 작전 승인 및 평가 시스템
 * - 작전 입안 (Draft)
 * - 결재/승인 (Approval)
 * - 발령 (Issuance)
 * - 공적치 보정 계산
 * 
 * @see agents/gin7-agents/gin7-bureaucracy/CHECKLIST.md
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  OperationPlan, 
  IOperationPlan, 
  OperationObjective, 
  OperationStatus,
  IApprovalStep,
  IOperationZone,
  EMPIRE_APPROVAL_CHAIN,
  ALLIANCE_APPROVAL_CHAIN,
  OPERATION_MERIT_BONUS,
  OPERATION_PARTICIPATION_BONUS,
} from '../../models/gin7/OperationPlan';
import { GovernmentStructure, IPositionHolder, PositionType } from '../../models/gin7/GovernmentStructure';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { RankLadder } from '../../models/gin7/RankLadder';
import { Gin7Message as Message } from '../../models/gin7/Message';
import { logger } from '../../common/logger';

// ============================================================================
// Types
// ============================================================================

export interface ProposeOperationParams {
  sessionId: string;
  factionId: string;
  drafterId: string;
  drafterName: string;
  
  operationName: string;
  description?: string;
  objective: OperationObjective;
  targetSystems: string[];
  targetPlanets?: string[];
  
  operationZone: IOperationZone;
  
  requiredResources?: {
    minFleets?: number;
    maxFleets?: number;
    minShips?: number;
    estimatedSupply?: number;
    estimatedDuration?: number;
  };
  
  scheduledStartAt?: Date;
  deadline?: Date;
}

export interface ApproveOperationParams {
  sessionId: string;
  operationId: string;
  approverId: string;
  approverName: string;
  approved: boolean;
  comment?: string;
}

export interface IssueOrderParams {
  sessionId: string;
  operationId: string;
  issuerId: string;
  fleetIds: string[];
}

export interface MeritCalculationResult {
  characterId: string;
  rawMerit: number;
  bonusRate: number;
  finalMerit: number;
  inOperationZone: boolean;
  operationBonus: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class BureaucracyService extends EventEmitter {
  private static instance: BureaucracyService;
  
  private constructor() {
    super();
  }
  
  public static getInstance(): BureaucracyService {
    if (!BureaucracyService.instance) {
      BureaucracyService.instance = new BureaucracyService();
    }
    return BureaucracyService.instance;
  }
  
  // ==========================================================================
  // Operation Proposal (작전 입안)
  // ==========================================================================
  
  /**
   * 작전 입안
   */
  async proposeOperation(params: ProposeOperationParams): Promise<IOperationPlan> {
    const {
      sessionId,
      factionId,
      drafterId,
      drafterName,
      operationName,
      description,
      objective,
      targetSystems,
      targetPlanets,
      operationZone,
      requiredResources,
      scheduledStartAt,
      deadline,
    } = params;
    
    // 입안자 직책 확인
    const drafterPosition = await this.getDrafterPosition(sessionId, factionId, drafterId);
    
    // 정부 유형에 따른 결재 체인 생성
    const government = await GovernmentStructure.findOne({ sessionId, factionId });
    const approvalChain = this.buildApprovalChain(
      government?.governmentType || 'empire',
      objective
    );
    
    // 작전 코드 생성
    const operationCode = await this.generateOperationCode(sessionId, factionId);
    
    const operation = new OperationPlan({
      operationId: uuidv4(),
      sessionId,
      factionId,
      
      operationName,
      operationCode,
      description,
      
      objective,
      targetSystems,
      targetPlanets: targetPlanets || [],
      
      operationZone,
      
      requiredResources: {
        minFleets: requiredResources?.minFleets || 1,
        maxFleets: requiredResources?.maxFleets,
        minShips: requiredResources?.minShips || 10,
        estimatedSupply: requiredResources?.estimatedSupply || 1000,
        estimatedDuration: requiredResources?.estimatedDuration || 7,
      },
      
      drafterId,
      drafterName,
      drafterPosition,
      draftedAt: new Date(),
      
      approvalChain,
      currentApprovalStep: 0,
      
      status: 'draft',
      statusHistory: [{
        status: 'draft',
        changedAt: new Date(),
        changedBy: drafterId,
        reason: 'Operation drafted',
      }],
      
      scheduledStartAt,
      deadline,
    });
    
    await operation.save();
    
    logger.info('[BureaucracyService] Operation proposed', {
      operationId: operation.operationId,
      operationName,
      objective,
      drafterId,
    });
    
    this.emit('operation:proposed', {
      sessionId,
      operationId: operation.operationId,
      operationName,
      drafterId,
    });
    
    return operation;
  }
  
  /**
   * 입안자 직책 확인
   */
  private async getDrafterPosition(
    sessionId: string,
    factionId: string,
    drafterId: string
  ): Promise<string | undefined> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });
    if (!government) return undefined;
    
    const position = government.positions.find(
      (p: IPositionHolder) => p.holderId === drafterId
    );
    
    return position?.positionName;
  }
  
  /**
   * 결재 체인 생성
   */
  private buildApprovalChain(
    governmentType: string,
    objective: OperationObjective
  ): IApprovalStep[] {
    const chainTemplate = governmentType === 'alliance'
      ? ALLIANCE_APPROVAL_CHAIN[objective]
      : EMPIRE_APPROVAL_CHAIN[objective];
    
    return chainTemplate.map((step, index) => ({
      stepOrder: index,
      positionType: step.positionType,
      positionName: step.positionName,
      status: 'pending' as const,
    }));
  }
  
  /**
   * 작전 코드 생성
   */
  private async generateOperationCode(
    sessionId: string,
    factionId: string
  ): Promise<string> {
    const year = new Date().getFullYear();
    const count = await OperationPlan.countDocuments({
      sessionId,
      factionId,
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      },
    });
    
    const prefix = factionId.substring(0, 3).toUpperCase();
    return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`;
  }
  
  // ==========================================================================
  // Approval Process (결재)
  // ==========================================================================
  
  /**
   * 결재 요청 (draft -> pending)
   */
  async submitForApproval(
    sessionId: string,
    operationId: string,
    submitterId: string
  ): Promise<IOperationPlan> {
    const operation = await OperationPlan.findOne({ sessionId, operationId });
    
    if (!operation) {
      throw new Error('Operation not found');
    }
    
    if (operation.status !== 'draft') {
      throw new Error(`Cannot submit operation in ${operation.status} status`);
    }
    
    // 입안자만 제출 가능
    if (operation.drafterId !== submitterId) {
      throw new Error('Only drafter can submit for approval');
    }
    
    operation.status = 'pending';
    operation.statusHistory.push({
      status: 'pending',
      changedAt: new Date(),
      changedBy: submitterId,
      reason: 'Submitted for approval',
    });
    
    await operation.save();
    
    // 첫 번째 결재권자에게 알림
    await this.notifyApprover(operation);
    
    logger.info('[BureaucracyService] Operation submitted for approval', {
      operationId,
      submitterId,
    });
    
    this.emit('operation:submitted', {
      sessionId,
      operationId,
      submitterId,
    });
    
    return operation;
  }
  
  /**
   * 결재 처리
   */
  async processApproval(params: ApproveOperationParams): Promise<IOperationPlan> {
    const { sessionId, operationId, approverId, approverName, approved, comment } = params;
    
    const operation = await OperationPlan.findOne({ sessionId, operationId });
    
    if (!operation) {
      throw new Error('Operation not found');
    }
    
    if (operation.status !== 'pending') {
      throw new Error(`Cannot approve operation in ${operation.status} status`);
    }
    
    // 결재권한 확인
    const canApprove = await this.validateApprover(
      sessionId,
      operation.factionId,
      approverId,
      operation.approvalChain[operation.currentApprovalStep]
    );
    
    if (!canApprove) {
      throw new Error('No authority to approve this operation');
    }
    
    // 결재 처리
    const currentStep = operation.approvalChain[operation.currentApprovalStep];
    currentStep.approverId = approverId;
    currentStep.approverName = approverName;
    currentStep.status = approved ? 'approved' : 'rejected';
    currentStep.comment = comment;
    currentStep.processedAt = new Date();
    
    if (!approved) {
      // 반려
      operation.status = 'rejected';
      operation.statusHistory.push({
        status: 'rejected',
        changedAt: new Date(),
        changedBy: approverId,
        reason: comment || 'Rejected by approver',
      });
      
      // 입안자에게 반려 알림
      await this.notifyRejection(operation, comment);
    } else {
      // 승인
      operation.currentApprovalStep++;
      
      if (operation.currentApprovalStep >= operation.approvalChain.length) {
        // 모든 결재 완료
        operation.status = 'approved';
        operation.statusHistory.push({
          status: 'approved',
          changedAt: new Date(),
          changedBy: approverId,
          reason: 'All approvals completed',
        });
        
        // 입안자에게 승인 완료 알림
        await this.notifyApprovalComplete(operation);
      } else {
        // 다음 결재권자에게 알림
        await this.notifyApprover(operation);
      }
    }
    
    await operation.save();
    
    logger.info('[BureaucracyService] Approval processed', {
      operationId,
      approverId,
      approved,
      newStatus: operation.status,
    });
    
    this.emit('operation:approval_processed', {
      sessionId,
      operationId,
      approverId,
      approved,
      newStatus: operation.status,
    });
    
    return operation;
  }
  
  /**
   * 결재권한 검증
   */
  private async validateApprover(
    sessionId: string,
    factionId: string,
    approverId: string,
    approvalStep: IApprovalStep
  ): Promise<boolean> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });
    if (!government) return false;
    
    // 해당 직책 보유자인지 확인
    const position = government.positions.find(
      (p: IPositionHolder) => 
        p.positionType === approvalStep.positionType && 
        p.holderId === approverId
    );
    
    return !!position;
  }
  
  /**
   * 결재권자에게 알림
   */
  private async notifyApprover(operation: IOperationPlan): Promise<void> {
    const currentStep = operation.approvalChain[operation.currentApprovalStep];
    if (!currentStep) return;
    
    const government = await GovernmentStructure.findOne({ 
      sessionId: operation.sessionId, 
      factionId: operation.factionId 
    });
    
    if (!government) return;
    
    const position = government.positions.find(
      (p: IPositionHolder) => p.positionType === currentStep.positionType
    );
    
    if (!position?.holderId) return;
    
    // 메시지 전송
    await Message.create({
      messageId: uuidv4(),
      sessionId: operation.sessionId,
      senderId: operation.drafterId,
      senderName: operation.drafterName,
      recipientIds: [position.holderId],
      messageType: 'official',
      subject: `[결재 요청] ${operation.operationName}`,
      content: `작전명: ${operation.operationName}\n` +
        `작전 코드: ${operation.operationCode}\n` +
        `목표: ${operation.objective}\n` +
        `설명: ${operation.description || '없음'}\n\n` +
        `결재를 요청드립니다.`,
      priority: 'high',
      metadata: {
        operationType: 'approval_request',
        operationId: operation.operationId,
      },
    });
  }
  
  /**
   * 반려 알림
   */
  private async notifyRejection(
    operation: IOperationPlan,
    reason?: string
  ): Promise<void> {
    const currentStep = operation.approvalChain[operation.currentApprovalStep];
    
    await Message.create({
      messageId: uuidv4(),
      sessionId: operation.sessionId,
      senderId: currentStep.approverId || 'system',
      senderName: currentStep.approverName || '결재 시스템',
      recipientIds: [operation.drafterId],
      messageType: 'official',
      subject: `[반려] ${operation.operationName}`,
      content: `작전 "${operation.operationName}"이(가) 반려되었습니다.\n\n` +
        `결재자: ${currentStep.approverName}\n` +
        `사유: ${reason || '사유 없음'}`,
      priority: 'high',
      metadata: {
        operationType: 'rejection',
        operationId: operation.operationId,
      },
    });
  }
  
  /**
   * 승인 완료 알림
   */
  private async notifyApprovalComplete(operation: IOperationPlan): Promise<void> {
    await Message.create({
      messageId: uuidv4(),
      sessionId: operation.sessionId,
      senderId: 'system',
      senderName: '결재 시스템',
      recipientIds: [operation.drafterId],
      messageType: 'official',
      subject: `[승인 완료] ${operation.operationName}`,
      content: `작전 "${operation.operationName}"이(가) 최종 승인되었습니다.\n\n` +
        `작전 코드: ${operation.operationCode}\n` +
        `이제 부대를 할당하고 발령할 수 있습니다.`,
      priority: 'high',
      metadata: {
        operationType: 'approval_complete',
        operationId: operation.operationId,
      },
    });
  }
  
  // ==========================================================================
  // Order Issuance (발령)
  // ==========================================================================
  
  /**
   * 작전 발령 (부대 할당 및 활성화)
   */
  async issueOrder(params: IssueOrderParams): Promise<IOperationPlan> {
    const { sessionId, operationId, issuerId, fleetIds } = params;
    
    const operation = await OperationPlan.findOne({ sessionId, operationId });
    
    if (!operation) {
      throw new Error('Operation not found');
    }
    
    if (operation.status !== 'approved') {
      throw new Error(`Cannot issue order for operation in ${operation.status} status`);
    }
    
    // 발령 권한 확인 (통수본부장/통합작전본부장)
    const canIssue = await this.validateIssuer(sessionId, operation.factionId, issuerId);
    if (!canIssue) {
      throw new Error('No authority to issue order');
    }
    
    // 함대 할당
    for (const fleetId of fleetIds) {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet) {
        logger.warn('[BureaucracyService] Fleet not found', { fleetId });
        continue;
      }
      
      // 함대가 같은 세력인지 확인
      if (fleet.factionId !== operation.factionId) {
        logger.warn('[BureaucracyService] Fleet faction mismatch', { fleetId });
        continue;
      }
      
      // 함대 할당
      operation.assignedUnits.push({
        fleetId: fleet.fleetId,
        fleetName: fleet.name,
        commanderId: fleet.commanderId,
        commanderName: '', // Fleet에서 조회 필요
        assignedAt: new Date(),
        role: operation.assignedUnits.length === 0 ? 'main' : 'support',
      });
      
      // 함대에 작전 정보 설정
      await Fleet.updateOne(
        { sessionId, fleetId },
        {
          $set: {
            'data.operationId': operation.operationId,
            'data.operationName': operation.operationName,
          },
        }
      );
      
      // 함대 지휘관에게 작전서 전송
      await this.sendOrderDocument(operation, fleet);
    }
    
    // 최소 함대 수 확인
    if (operation.assignedUnits.length < operation.requiredResources.minFleets) {
      throw new Error(`Minimum ${operation.requiredResources.minFleets} fleets required`);
    }
    
    // 작전 활성화
    operation.status = 'active';
    operation.actualStartAt = new Date();
    operation.statusHistory.push({
      status: 'active',
      changedAt: new Date(),
      changedBy: issuerId,
      reason: 'Order issued',
    });
    
    await operation.save();
    
    logger.info('[BureaucracyService] Order issued', {
      operationId,
      issuerId,
      assignedFleets: fleetIds.length,
    });
    
    this.emit('operation:order_issued', {
      sessionId,
      operationId,
      issuerId,
      fleetIds,
    });
    
    return operation;
  }
  
  /**
   * 발령 권한 검증
   */
  private async validateIssuer(
    sessionId: string,
    factionId: string,
    issuerId: string
  ): Promise<boolean> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });
    if (!government) return false;
    
    // 발령 가능 직책: marshal (원수), fleet_commander (우주함대총사령관), 
    // defense_chair (국방위원장), emperor (황제), council_chair (의장)
    const issuerPositions = ['marshal', 'fleet_commander', 'defense_chair', 'emperor', 'council_chair'];
    
    const position = government.positions.find(
      (p: IPositionHolder) => 
        issuerPositions.includes(p.positionType) && 
        p.holderId === issuerId
    );
    
    return !!position;
  }
  
  /**
   * 작전서 전송
   */
  private async sendOrderDocument(operation: IOperationPlan, fleet: IFleet): Promise<void> {
    await Message.create({
      messageId: uuidv4(),
      sessionId: operation.sessionId,
      senderId: 'system',
      senderName: '작전본부',
      recipientIds: [fleet.commanderId],
      messageType: 'official',
      subject: `[작전 명령] ${operation.operationName}`,
      content: 
        `═══════════════════════════════════════\n` +
        `        작  전  명  령  서\n` +
        `═══════════════════════════════════════\n\n` +
        `작전명: ${operation.operationName}\n` +
        `작전코드: ${operation.operationCode}\n` +
        `목표: ${this.getObjectiveText(operation.objective)}\n\n` +
        `목표 성계: ${operation.targetSystems.join(', ')}\n` +
        `예상 기간: ${operation.requiredResources.estimatedDuration}일\n\n` +
        `배속 함대: ${fleet.name}\n` +
        `역할: ${operation.assignedUnits.find(u => u.fleetId === fleet.fleetId)?.role || 'main'}\n\n` +
        `══════════════════════════════════════\n` +
        `본 명령에 따라 작전을 수행하시기 바랍니다.\n`,
      priority: 'critical',
      metadata: {
        operationType: 'order_document',
        operationId: operation.operationId,
        fleetId: fleet.fleetId,
      },
    });
  }
  
  /**
   * 목표 텍스트 변환
   */
  private getObjectiveText(objective: OperationObjective): string {
    const texts: Record<OperationObjective, string> = {
      capture: '점령',
      defense: '방어',
      sweep: '소탕',
      raid: '기습',
      patrol: '순찰',
      escort: '호위',
      blockade: '봉쇄',
    };
    return texts[objective] || objective;
  }
  
  // ==========================================================================
  // Merit Calculation (공적치 계산)
  // ==========================================================================
  
  /**
   * 공적치 계산 (작전 구역 보정 적용)
   */
  async calculateMerit(
    sessionId: string,
    characterId: string,
    factionId: string,
    rawMerit: number,
    systemId?: string,
    planetId?: string
  ): Promise<MeritCalculationResult> {
    // 현재 캐릭터가 참여 중인 활성 작전 조회
    const activeOperation = await OperationPlan.findActiveOperationForLocation(
      sessionId,
      factionId,
      systemId,
      planetId
    );
    
    let bonusRate = 1.0;
    let operationBonus = 0;
    let inOperationZone = false;
    
    if (activeOperation) {
      // 작전 구역 내 여부 확인
      const zone = activeOperation.operationZone;
      inOperationZone = zone?.systemIds?.includes(systemId) || 
                        zone?.planetIds?.includes(planetId || '') || 
                        false;
      
      if (inOperationZone) {
        // 작전 구역 내: +20%
        bonusRate = OPERATION_PARTICIPATION_BONUS.IN_ZONE;
      } else {
        // 작전 구역 외 (작전 참여 중이지만 구역 이탈): -50%
        const isAssigned = activeOperation.assignedUnits.some(
          u => u.commanderId === characterId
        );
        
        if (isAssigned) {
          bonusRate = OPERATION_PARTICIPATION_BONUS.OUT_ZONE;
        }
      }
    }
    
    const finalMerit = Math.floor(rawMerit * bonusRate);
    
    // 작전에 공적 기록
    if (activeOperation && inOperationZone) {
      await this.recordParticipantMerit(
        activeOperation,
        characterId,
        rawMerit,
        bonusRate,
        finalMerit
      );
    }
    
    return {
      characterId,
      rawMerit,
      bonusRate,
      finalMerit,
      inOperationZone,
      operationBonus,
    };
  }
  
  /**
   * 참가자 공적 기록
   */
  private async recordParticipantMerit(
    operation: IOperationPlan,
    characterId: string,
    rawMerit: number,
    bonusRate: number,
    finalMerit: number
  ): Promise<void> {
    // 캐릭터 이름 조회
    const rankEntry = await RankLadder.findOne({
      sessionId: operation.sessionId,
      characterId,
    });
    
    const existingEntry = operation.participantMerits.find(
      p => p.characterId === characterId
    );
    
    if (existingEntry) {
      existingEntry.rawMerit += rawMerit;
      existingEntry.finalMerit += finalMerit;
    } else {
      operation.participantMerits.push({
        characterId,
        characterName: rankEntry?.characterName || 'Unknown',
        rawMerit,
        bonusRate,
        finalMerit,
        actions: [],
      });
    }
    
    await operation.save();
  }
  
  // ==========================================================================
  // Operation Completion (작전 완료)
  // ==========================================================================
  
  /**
   * 작전 완료 처리
   */
  async completeOperation(
    sessionId: string,
    operationId: string,
    completedBy: string,
    result: {
      success: boolean;
      objectiveAchieved: boolean;
      casualties: {
        shipsLost: number;
        shipsDestroyed: number;
        personnelLost: number;
        enemyKilled: number;
      };
      capturedSystems: string[];
      capturedPlanets: string[];
    }
  ): Promise<IOperationPlan> {
    const operation = await OperationPlan.findOne({ sessionId, operationId });
    
    if (!operation) {
      throw new Error('Operation not found');
    }
    
    if (operation.status !== 'active') {
      throw new Error(`Cannot complete operation in ${operation.status} status`);
    }
    
    // 평가 등급 계산
    const rating = this.evaluateOperation(operation, result);
    
    operation.status = result.success ? 'completed' : 'failed';
    operation.completedAt = new Date();
    operation.result = {
      ...result,
      startedAt: operation.actualStartAt || new Date(),
      completedAt: new Date(),
      evaluation: {
        rating,
        meritBonus: this.calculateCompletionBonus(rating, result.objectiveAchieved),
        comment: this.generateEvaluationComment(rating, result),
      },
    };
    
    operation.statusHistory.push({
      status: operation.status,
      changedAt: new Date(),
      changedBy: completedBy,
      reason: result.success ? 'Operation successful' : 'Operation failed',
    });
    
    // 참가자들에게 작전 완료 보너스 지급
    await this.distributeCompletionBonus(operation);
    
    // 할당된 함대의 작전 정보 해제
    for (const unit of operation.assignedUnits) {
      await Fleet.updateOne(
        { sessionId, fleetId: unit.fleetId },
        {
          $unset: {
            'data.operationId': '',
            'data.operationName': '',
          },
        }
      );
    }
    
    await operation.save();
    
    logger.info('[BureaucracyService] Operation completed', {
      operationId,
      success: result.success,
      rating,
    });
    
    this.emit('operation:completed', {
      sessionId,
      operationId,
      success: result.success,
      rating,
    });
    
    return operation;
  }
  
  /**
   * 작전 평가
   */
  private evaluateOperation(
    operation: IOperationPlan,
    result: { success: boolean; objectiveAchieved: boolean; casualties: { shipsLost: number; shipsDestroyed: number } }
  ): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (!result.success) return 'F';
    if (!result.objectiveAchieved) return 'D';
    
    // 피해율 계산
    const damageRatio = result.casualties.shipsLost > 0
      ? result.casualties.shipsDestroyed / result.casualties.shipsLost
      : result.casualties.shipsDestroyed > 0 ? 10 : 1;
    
    if (damageRatio >= 5 && result.objectiveAchieved) return 'S';
    if (damageRatio >= 3) return 'A';
    if (damageRatio >= 1.5) return 'B';
    if (damageRatio >= 1) return 'C';
    return 'D';
  }
  
  /**
   * 완료 보너스 계산
   */
  private calculateCompletionBonus(
    rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F',
    objectiveAchieved: boolean
  ): number {
    const baseBonus = OPERATION_MERIT_BONUS[rating] || 1.0;
    const objectiveBonus = objectiveAchieved ? OPERATION_PARTICIPATION_BONUS.OBJECTIVE_BONUS : 0;
    return Math.floor((baseBonus + objectiveBonus - 1) * 100);
  }
  
  /**
   * 평가 코멘트 생성
   */
  private generateEvaluationComment(
    rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F',
    result: { success: boolean; objectiveAchieved: boolean }
  ): string {
    const comments: Record<string, string> = {
      'S': '탁월한 작전 수행. 최소 피해로 목표 완수.',
      'A': '우수한 작전 수행. 효율적인 목표 달성.',
      'B': '양호한 작전 수행. 목표 달성.',
      'C': '작전 목표 달성. 개선 여지 있음.',
      'D': '작전 목표 미달성 또는 과도한 피해.',
      'F': '작전 실패.',
    };
    return comments[rating] || '평가 없음';
  }
  
  /**
   * 완료 보너스 분배
   */
  private async distributeCompletionBonus(operation: IOperationPlan): Promise<void> {
    if (!operation.result?.evaluation) return;
    
    const bonusMerit = operation.result.evaluation.meritBonus;
    
    for (const participant of operation.participantMerits) {
      // RankLadder의 merit 업데이트
      await RankLadder.updateOne(
        { sessionId: operation.sessionId, characterId: participant.characterId },
        {
          $inc: {
            merit: bonusMerit,
            totalMerit: bonusMerit,
          },
        }
      );
      
      // 완료 보너스 기록
      participant.finalMerit += bonusMerit;
    }
    
    await operation.save();
  }
  
  // ==========================================================================
  // Query Methods
  // ==========================================================================
  
  /**
   * 세력의 작전 목록 조회
   */
  async getOperations(
    sessionId: string,
    factionId: string,
    status?: OperationStatus | OperationStatus[]
  ): Promise<IOperationPlan[]> {
    const query: Record<string, unknown> = { sessionId, factionId };
    
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }
    
    return OperationPlan.find(query).sort({ createdAt: -1 });
  }
  
  /**
   * 특정 작전 조회
   */
  async getOperation(sessionId: string, operationId: string): Promise<IOperationPlan | null> {
    return OperationPlan.findOne({ sessionId, operationId });
  }
  
  /**
   * 캐릭터의 결재 대기 작전 목록
   */
  async getPendingApprovals(
    sessionId: string,
    factionId: string,
    approverId: string
  ): Promise<IOperationPlan[]> {
    // 결재권자의 직책 확인
    const government = await GovernmentStructure.findOne({ sessionId, factionId });
    if (!government) return [];
    
    const positions = government.positions.filter(
      (p: IPositionHolder) => p.holderId === approverId
    );
    
    if (positions.length === 0) return [];
    
    const positionTypes = positions.map((p: IPositionHolder) => p.positionType);
    
    // 해당 직책이 현재 결재 단계인 작전 조회
    return OperationPlan.find({
      sessionId,
      factionId,
      status: 'pending',
    }).then(operations =>
      operations.filter(op => {
        const currentStep = op.approvalChain[op.currentApprovalStep];
        return currentStep && positionTypes.includes(currentStep.positionType as PositionType);
      })
    );
  }
  
  /**
   * 작전 취소
   */
  async cancelOperation(
    sessionId: string,
    operationId: string,
    cancelledBy: string,
    reason: string
  ): Promise<IOperationPlan> {
    const operation = await OperationPlan.findOne({ sessionId, operationId });
    
    if (!operation) {
      throw new Error('Operation not found');
    }
    
    if (['completed', 'failed', 'cancelled'].includes(operation.status)) {
      throw new Error(`Cannot cancel operation in ${operation.status} status`);
    }
    
    operation.status = 'cancelled';
    operation.completedAt = new Date();
    operation.statusHistory.push({
      status: 'cancelled',
      changedAt: new Date(),
      changedBy: cancelledBy,
      reason,
    });
    
    // 할당된 함대의 작전 정보 해제
    for (const unit of operation.assignedUnits) {
      await Fleet.updateOne(
        { sessionId, fleetId: unit.fleetId },
        {
          $unset: {
            'data.operationId': '',
            'data.operationName': '',
          },
        }
      );
    }
    
    await operation.save();
    
    logger.info('[BureaucracyService] Operation cancelled', {
      operationId,
      cancelledBy,
      reason,
    });
    
    this.emit('operation:cancelled', {
      sessionId,
      operationId,
      cancelledBy,
      reason,
    });
    
    return operation;
  }
}

export default BureaucracyService;








