/**
 * ProposalService - 제안/명령 시스템
 * 매뉴얼 737-738행 기반 구현
 *
 * 기능:
 * - 상관에게 제안 (Proposal)
 * - 부하에게 명령 (Order)
 * - 제안/명령 수락/거절
 * - 제안/명령 이력 관리
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

export enum ProposalType {
  // 제안 (상관에게)
  PROPOSAL = 'PROPOSAL',
  // 명령 (부하에게)
  ORDER = 'ORDER',
}

export enum ProposalStatus {
  PENDING = 'PENDING',       // 대기 중
  ACCEPTED = 'ACCEPTED',     // 수락됨
  REJECTED = 'REJECTED',     // 거절됨
  EXPIRED = 'EXPIRED',       // 만료됨
  CANCELLED = 'CANCELLED',   // 취소됨
  EXECUTED = 'EXECUTED',     // 실행됨
}

export enum ProposalCategory {
  // 인사
  APPOINTMENT = 'APPOINTMENT',       // 임명
  DISMISSAL = 'DISMISSAL',           // 해임
  PROMOTION = 'PROMOTION',           // 승진
  TRANSFER = 'TRANSFER',             // 전근
  
  // 작전
  OPERATION = 'OPERATION',           // 작전 제안
  MOVEMENT = 'MOVEMENT',             // 이동
  ATTACK = 'ATTACK',                 // 공격
  RETREAT = 'RETREAT',               // 철퇴
  
  // 병참
  PRODUCTION = 'PRODUCTION',         // 생산
  RESUPPLY = 'RESUPPLY',             // 보급
  ALLOCATION = 'ALLOCATION',         // 할당
  
  // 외교
  NEGOTIATION = 'NEGOTIATION',       // 협상
  ALLIANCE = 'ALLIANCE',             // 동맹
  
  // 기타
  CUSTOM = 'CUSTOM',                 // 커스텀
}

// ============================================================
// Models
// ============================================================

export interface IProposal extends Document {
  proposalId: string;
  sessionId: string;
  type: ProposalType;
  category: ProposalCategory;
  status: ProposalStatus;
  
  // 발신자/수신자
  senderId: string;
  senderName: string;
  senderRank: string;
  senderPosition?: string;
  
  receiverId: string;
  receiverName: string;
  receiverRank: string;
  receiverPosition?: string;
  
  // 내용
  title: string;
  content: string;
  
  // 명령/제안 세부사항
  details: {
    targetId?: string;        // 대상 (캐릭터, 부대, 행성 등)
    targetType?: string;      // 대상 타입
    action?: string;          // 수행할 액션
    parameters?: Record<string, any>; // 추가 파라미터
  };
  
  // 타임스탬프
  createdAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
  executedAt?: Date;
  
  // 응답
  responseMessage?: string;
  rejectionReason?: string;
  
  // CP 비용
  cpCost: number;
  
  // 메타데이터
  isUrgent: boolean;
  priority: number;
}

const ProposalSchema = new Schema<IProposal>({
  proposalId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  type: { type: String, enum: Object.values(ProposalType), required: true },
  category: { type: String, enum: Object.values(ProposalCategory), required: true },
  status: { type: String, enum: Object.values(ProposalStatus), default: ProposalStatus.PENDING },
  
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  senderRank: { type: String, required: true },
  senderPosition: { type: String },
  
  receiverId: { type: String, required: true, index: true },
  receiverName: { type: String, required: true },
  receiverRank: { type: String, required: true },
  receiverPosition: { type: String },
  
  title: { type: String, required: true },
  content: { type: String, required: true },
  
  details: {
    targetId: { type: String },
    targetType: { type: String },
    action: { type: String },
    parameters: { type: Schema.Types.Mixed },
  },
  
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  respondedAt: { type: Date },
  executedAt: { type: Date },
  
  responseMessage: { type: String },
  rejectionReason: { type: String },
  
  cpCost: { type: Number, default: 10 },
  
  isUrgent: { type: Boolean, default: false },
  priority: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'proposals',
});

// 인덱스
ProposalSchema.index({ sessionId: 1, senderId: 1, status: 1 });
ProposalSchema.index({ sessionId: 1, receiverId: 1, status: 1 });
ProposalSchema.index({ sessionId: 1, expiresAt: 1 });

export const Proposal: Model<IProposal> = mongoose.models.Proposal as Model<IProposal> ||
  mongoose.model<IProposal>('Proposal', ProposalSchema);

// ============================================================
// Request Types
// ============================================================

export interface CreateProposalRequest {
  sessionId: string;
  type: ProposalType;
  category: ProposalCategory;
  
  senderId: string;
  senderName: string;
  senderRank: string;
  senderPosition?: string;
  
  receiverId: string;
  receiverName: string;
  receiverRank: string;
  receiverPosition?: string;
  
  title: string;
  content: string;
  
  details?: {
    targetId?: string;
    targetType?: string;
    action?: string;
    parameters?: Record<string, any>;
  };
  
  expiresInHours?: number; // 만료 시간 (시간, 기본 24)
  isUrgent?: boolean;
}

export interface RespondToProposalRequest {
  proposalId: string;
  responderId: string;
  accept: boolean;
  responseMessage?: string;
  rejectionReason?: string;
}

// ============================================================
// ProposalService Class
// ============================================================

export class ProposalService extends EventEmitter {
  private static instance: ProposalService;
  
  // 기본 만료 시간 (24시간)
  private readonly DEFAULT_EXPIRY_HOURS = 24;
  
  // CP 비용
  private readonly PROPOSAL_CP_COST = 10;
  private readonly ORDER_CP_COST = 5;

  private constructor() {
    super();
    logger.info('[ProposalService] Initialized');
    
    // 만료 체크 타이머 설정 (1시간마다)
    setInterval(() => this.checkExpiredProposals(), 60 * 60 * 1000);
  }

  public static getInstance(): ProposalService {
    if (!ProposalService.instance) {
      ProposalService.instance = new ProposalService();
    }
    return ProposalService.instance;
  }

  // ============================================================
  // 제안/명령 생성
  // ============================================================

  /**
   * 상관에게 제안
   * 매뉴얼: "제안/명령에 대해서도 이 버튼을 좌클릭함으로써 실행할 수 있습니다"
   */
  public async createProposal(request: CreateProposalRequest): Promise<{
    success: boolean;
    proposalId?: string;
    cpCost?: number;
    error?: string;
  }> {
    const {
      sessionId, type, category,
      senderId, senderName, senderRank, senderPosition,
      receiverId, receiverName, receiverRank, receiverPosition,
      title, content, details,
      expiresInHours = this.DEFAULT_EXPIRY_HOURS,
      isUrgent = false,
    } = request;

    // 1. 계급 검증
    if (type === ProposalType.PROPOSAL) {
      // 제안은 상관에게만 가능 (상관 확인 로직 필요)
      // TODO: 계급/직위 비교 로직
    } else if (type === ProposalType.ORDER) {
      // 명령은 부하에게만 가능
      // TODO: 계급/직위 비교 로직
    }

    // 2. 만료 시간 계산
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // 3. CP 비용 결정
    const cpCost = type === ProposalType.PROPOSAL 
      ? this.PROPOSAL_CP_COST 
      : this.ORDER_CP_COST;

    // 4. 제안/명령 생성
    const proposal = await Proposal.create({
      proposalId: `PROP-${uuidv4().slice(0, 8)}`,
      sessionId,
      type,
      category,
      status: ProposalStatus.PENDING,
      
      senderId,
      senderName,
      senderRank,
      senderPosition,
      
      receiverId,
      receiverName,
      receiverRank,
      receiverPosition,
      
      title,
      content,
      details: details || {},
      
      createdAt: new Date(),
      expiresAt,
      
      cpCost,
      isUrgent,
      priority: isUrgent ? 10 : 0,
    });

    // 5. 이벤트 발생
    this.emit('proposal:created', {
      sessionId,
      proposalId: proposal.proposalId,
      type,
      senderId,
      receiverId,
      title,
    });

    logger.info(`[ProposalService] ${type} created: ${title} from ${senderName} to ${receiverName}`);

    return {
      success: true,
      proposalId: proposal.proposalId,
      cpCost,
    };
  }

  // ============================================================
  // 제안/명령 응답
  // ============================================================

  /**
   * 제안/명령에 응답
   */
  public async respondToProposal(request: RespondToProposalRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { proposalId, responderId, accept, responseMessage, rejectionReason } = request;

    const proposal = await Proposal.findOne({ proposalId });
    if (!proposal) {
      return { success: false, error: '제안/명령을 찾을 수 없습니다.' };
    }

    // 수신자 확인
    if (proposal.receiverId !== responderId) {
      return { success: false, error: '수신자만 응답할 수 있습니다.' };
    }

    // 상태 확인
    if (proposal.status !== ProposalStatus.PENDING) {
      return { success: false, error: '이미 처리된 제안/명령입니다.' };
    }

    // 만료 확인
    if (new Date() > proposal.expiresAt) {
      proposal.status = ProposalStatus.EXPIRED;
      await proposal.save();
      return { success: false, error: '만료된 제안/명령입니다.' };
    }

    // 응답 처리
    proposal.status = accept ? ProposalStatus.ACCEPTED : ProposalStatus.REJECTED;
    proposal.respondedAt = new Date();
    proposal.responseMessage = responseMessage;
    if (!accept) {
      proposal.rejectionReason = rejectionReason;
    }
    await proposal.save();

    // 이벤트 발생
    this.emit('proposal:responded', {
      sessionId: proposal.sessionId,
      proposalId: proposal.proposalId,
      type: proposal.type,
      senderId: proposal.senderId,
      receiverId: proposal.receiverId,
      accepted: accept,
    });

    logger.info(`[ProposalService] ${proposal.type} ${accept ? 'accepted' : 'rejected'}: ${proposal.title}`);

    return { success: true };
  }

  /**
   * 제안/명령 실행 (수락 후)
   */
  public async executeProposal(proposalId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const proposal = await Proposal.findOne({ proposalId });
    if (!proposal) {
      return { success: false, error: '제안/명령을 찾을 수 없습니다.' };
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      return { success: false, error: '수락된 제안/명령만 실행할 수 있습니다.' };
    }

    // TODO: 실제 액션 실행 (카테고리별 처리)
    // switch (proposal.category) {
    //   case ProposalCategory.APPOINTMENT:
    //     // AppointmentService.appoint(...)
    //     break;
    //   ...
    // }

    proposal.status = ProposalStatus.EXECUTED;
    proposal.executedAt = new Date();
    await proposal.save();

    this.emit('proposal:executed', {
      sessionId: proposal.sessionId,
      proposalId: proposal.proposalId,
      category: proposal.category,
    });

    logger.info(`[ProposalService] Proposal executed: ${proposal.title}`);

    return { success: true };
  }

  /**
   * 제안/명령 취소
   */
  public async cancelProposal(
    proposalId: string,
    cancelledBy: string,
  ): Promise<{ success: boolean; error?: string }> {
    const proposal = await Proposal.findOne({ proposalId });
    if (!proposal) {
      return { success: false, error: '제안/명령을 찾을 수 없습니다.' };
    }

    // 발신자만 취소 가능
    if (proposal.senderId !== cancelledBy) {
      return { success: false, error: '발신자만 취소할 수 있습니다.' };
    }

    if (proposal.status !== ProposalStatus.PENDING) {
      return { success: false, error: '대기 중인 제안/명령만 취소할 수 있습니다.' };
    }

    proposal.status = ProposalStatus.CANCELLED;
    await proposal.save();

    this.emit('proposal:cancelled', {
      sessionId: proposal.sessionId,
      proposalId: proposal.proposalId,
    });

    return { success: true };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 받은 제안/명령 목록
   */
  public async getReceivedProposals(
    sessionId: string,
    receiverId: string,
    status?: ProposalStatus,
  ): Promise<IProposal[]> {
    const query: any = { sessionId, receiverId };
    if (status) {
      query.status = status;
    } else {
      query.status = ProposalStatus.PENDING;
    }
    
    return Proposal.find(query)
      .sort({ isUrgent: -1, priority: -1, createdAt: -1 })
      .lean() as unknown as IProposal[];
  }

  /**
   * 보낸 제안/명령 목록
   */
  public async getSentProposals(
    sessionId: string,
    senderId: string,
    status?: ProposalStatus,
  ): Promise<IProposal[]> {
    const query: any = { sessionId, senderId };
    if (status) query.status = status;
    
    return Proposal.find(query)
      .sort({ createdAt: -1 })
      .lean() as unknown as IProposal[];
  }

  /**
   * 제안/명령 상세 조회
   */
  public async getProposal(proposalId: string): Promise<IProposal | null> {
    return Proposal.findOne({ proposalId }).lean() as unknown as IProposal | null;
  }

  // ============================================================
  // 만료 처리
  // ============================================================

  /**
   * 만료된 제안/명령 처리
   */
  private async checkExpiredProposals(): Promise<void> {
    const now = new Date();
    
    const result = await Proposal.updateMany(
      {
        status: ProposalStatus.PENDING,
        expiresAt: { $lt: now },
      },
      {
        status: ProposalStatus.EXPIRED,
      },
    );

    if (result.modifiedCount > 0) {
      logger.info(`[ProposalService] Expired ${result.modifiedCount} proposals`);
    }
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    logger.info(`[ProposalService] Cleaned up session: ${sessionId}`);
  }
}

export const proposalService = ProposalService.getInstance();
export default ProposalService;





