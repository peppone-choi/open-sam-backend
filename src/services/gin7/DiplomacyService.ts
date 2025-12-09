/**
 * DiplomacyService - 외교 시스템
 * Agent F: 외교/경제 시스템 확장
 *
 * 기능:
 * - 외교 상태 관리 (동맹/중립/적대/휴전)
 * - 조약 체결 (signTreaty)
 * - 조약 파기 (breakTreaty)
 * - 외교 메시지 송수신
 * - 전쟁 선포 (declareWar)
 * - 휴전 협상 (negotiateCeasefire)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger';
import { DiplomacyState, IDiplomacyState } from '../../models/gin7/Diplomacy';
import { Faction } from '../../models/gin7/Faction';

// ============================================================
// Types
// ============================================================

export enum DiplomaticStatus {
  ALLIED = 'ALLIED',           // 동맹
  FRIENDLY = 'FRIENDLY',       // 우호
  NEUTRAL = 'NEUTRAL',         // 중립
  HOSTILE = 'HOSTILE',         // 적대
  AT_WAR = 'AT_WAR',           // 전쟁 중
  CEASEFIRE = 'CEASEFIRE',     // 휴전
}

export enum TreatyType {
  TRADE = 'TRADE',                     // 무역 협정
  NON_AGGRESSION = 'NON_AGGRESSION',   // 불가침 조약
  ALLIANCE = 'ALLIANCE',               // 동맹 조약
  CEASEFIRE = 'CEASEFIRE',             // 휴전 협정
  MUTUAL_DEFENSE = 'MUTUAL_DEFENSE',   // 상호방위 조약
  TRIBUTE = 'TRIBUTE',                 // 조공 협정
}

export enum DiplomaticAction {
  PROPOSE_TREATY = 'PROPOSE_TREATY',
  ACCEPT_TREATY = 'ACCEPT_TREATY',
  REJECT_TREATY = 'REJECT_TREATY',
  BREAK_TREATY = 'BREAK_TREATY',
  DECLARE_WAR = 'DECLARE_WAR',
  REQUEST_CEASEFIRE = 'REQUEST_CEASEFIRE',
  ACCEPT_CEASEFIRE = 'ACCEPT_CEASEFIRE',
  REJECT_CEASEFIRE = 'REJECT_CEASEFIRE',
  SEND_MESSAGE = 'SEND_MESSAGE',
  SEND_ULTIMATUM = 'SEND_ULTIMATUM',
  OFFER_TRIBUTE = 'OFFER_TRIBUTE',
}

export interface Treaty {
  treatyId: string;
  type: TreatyType;
  parties: string[];           // 참여 세력 ID
  terms: TreatyTerms;
  signedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  breakCost: number;           // 파기 시 명성 비용
  renewalCount: number;
}

export interface TreatyTerms {
  description: string;
  tradeBonus?: number;         // 무역 보너스 (%)
  tariffReduction?: number;    // 관세 감면 (%)
  tributeAmount?: number;      // 조공액
  tributeInterval?: number;    // 조공 주기 (일)
  mutualDefense?: boolean;     // 상호방위 조항
  noFirstStrike?: boolean;     // 선제공격 금지
  territoryAccess?: boolean;   // 영토 통행 허용
  durationDays?: number;       // 조약 기간
}

export interface DiplomaticMessage {
  messageId: string;
  sessionId: string;
  fromFactionId: string;
  toFactionId: string;
  fromCharacterId?: string;    // 발신자 (외교관)
  type: 'FORMAL' | 'INFORMAL' | 'ULTIMATUM' | 'PROPOSAL' | 'RESPONSE';
  subject: string;
  content: string;
  attachedTreatyId?: string;   // 첨부된 조약 제안
  sentAt: Date;
  readAt?: Date;
  responseTo?: string;         // 답장 대상 메시지
}

export interface DiplomaticRelation {
  sessionId: string;
  factionA: string;
  factionB: string;
  status: DiplomaticStatus;
  relationScore: number;       // -100 ~ 100
  treaties: string[];          // 활성 조약 ID
  warStartDate?: Date;
  ceasefireEndDate?: Date;
  lastInteraction: Date;
  incidentHistory: DiplomaticIncident[];
}

export interface DiplomaticIncident {
  incidentId: string;
  type: 'TREATY_BROKEN' | 'BORDER_VIOLATION' | 'ESPIONAGE_CAUGHT' | 
        'TRADE_DISPUTE' | 'WAR_DECLARED' | 'CIVILIAN_CASUALTY';
  causedBy: string;
  description: string;
  relationImpact: number;
  occurredAt: Date;
}

export interface WarDeclaration {
  warId: string;
  sessionId: string;
  declaringFaction: string;
  targetFaction: string;
  declaredAt: Date;
  caususBelli: string;         // 전쟁 명분
  isActive: boolean;
  endedAt?: Date;
  victor?: string;
  peaceTreaty?: string;
}

export interface CeasefireProposal {
  proposalId: string;
  sessionId: string;
  proposingFaction: string;
  targetFaction: string;
  terms: CeasefireTerms;
  proposedAt: Date;
  expiresAt: Date;             // 제안 만료 시간
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

export interface CeasefireTerms {
  durationDays: number;        // 휴전 기간
  territorialStatus: 'STATUS_QUO' | 'CURRENT_LINES' | 'CUSTOM';
  reparations?: number;        // 배상금
  prisonerExchange?: boolean;  // 포로 교환
  demilitarizedZones?: string[]; // 비무장지대
}

// ============================================================
// Constants
// ============================================================

const TREATY_BREAK_REPUTATION_COST: Record<TreatyType, number> = {
  [TreatyType.TRADE]: 200,
  [TreatyType.NON_AGGRESSION]: 500,
  [TreatyType.ALLIANCE]: 1000,
  [TreatyType.CEASEFIRE]: 800,
  [TreatyType.MUTUAL_DEFENSE]: 1500,
  [TreatyType.TRIBUTE]: 300,
};

const RELATION_THRESHOLDS = {
  ALLIED: 80,
  FRIENDLY: 40,
  NEUTRAL: -20,
  HOSTILE: -60,
  // AT_WAR는 명시적 선언 필요
};

const DEFAULT_CEASEFIRE_DURATION = 30; // 30일

// ============================================================
// DiplomacyService Class
// ============================================================

export class DiplomacyService extends EventEmitter {
  private static instance: DiplomacyService;

  // 세션별 데이터 캐시
  private relations: Map<string, DiplomaticRelation[]> = new Map();
  private treaties: Map<string, Treaty[]> = new Map();
  private messages: Map<string, DiplomaticMessage[]> = new Map();
  private wars: Map<string, WarDeclaration[]> = new Map();
  private ceasefireProposals: Map<string, CeasefireProposal[]> = new Map();

  private constructor() {
    super();
    logger.info('[DiplomacyService] Initialized');
  }

  public static getInstance(): DiplomacyService {
    if (!DiplomacyService.instance) {
      DiplomacyService.instance = new DiplomacyService();
    }
    return DiplomacyService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.relations.set(sessionId, []);
    this.treaties.set(sessionId, []);
    this.messages.set(sessionId, []);
    this.wars.set(sessionId, []);
    this.ceasefireProposals.set(sessionId, []);

    // 기본 외교 관계 설정 (제국 vs 동맹)
    this.initializeDefaultRelations(sessionId);

    logger.info(`[DiplomacyService] Session ${sessionId} initialized`);
  }

  private initializeDefaultRelations(sessionId: string): void {
    // 제국-동맹 기본 관계 (적대)
    const empireAllianceRelation: DiplomaticRelation = {
      sessionId,
      factionA: 'empire',
      factionB: 'alliance',
      status: DiplomaticStatus.AT_WAR,
      relationScore: -80,
      treaties: [],
      warStartDate: new Date('2796-01-01'), // 게임 시작 시 이미 전쟁 중
      lastInteraction: new Date(),
      incidentHistory: [],
    };

    // 제국-페잔 관계 (중립)
    const empireFezzanRelation: DiplomaticRelation = {
      sessionId,
      factionA: 'empire',
      factionB: 'fezzan',
      status: DiplomaticStatus.NEUTRAL,
      relationScore: 20,
      treaties: [],
      lastInteraction: new Date(),
      incidentHistory: [],
    };

    // 동맹-페잔 관계 (중립)
    const allianceFezzanRelation: DiplomaticRelation = {
      sessionId,
      factionA: 'alliance',
      factionB: 'fezzan',
      status: DiplomaticStatus.NEUTRAL,
      relationScore: 30,
      treaties: [],
      lastInteraction: new Date(),
      incidentHistory: [],
    };

    const relations = this.relations.get(sessionId) || [];
    relations.push(empireAllianceRelation, empireFezzanRelation, allianceFezzanRelation);
    this.relations.set(sessionId, relations);
  }

  public cleanupSession(sessionId: string): void {
    this.relations.delete(sessionId);
    this.treaties.delete(sessionId);
    this.messages.delete(sessionId);
    this.wars.delete(sessionId);
    this.ceasefireProposals.delete(sessionId);
    logger.info(`[DiplomacyService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // DB 동기화
  // ============================================================

  /**
   * 세션 데이터를 DB에서 로드
   */
  public async loadFromDB(sessionId: string): Promise<void> {
    try {
      const dbState = await DiplomacyState.findOne({ sessionId });
      if (dbState) {
        // DB에서 조약 로드
        const treaties: Treaty[] = dbState.treaties.map(t => ({
          treatyId: t.treatyId,
          type: t.type as TreatyType,
          parties: t.parties,
          terms: t.terms,
          signedAt: t.signedAt,
          expiresAt: t.expiresAt,
          isActive: t.isActive,
          breakCost: t.breakCost,
          renewalCount: t.renewalCount,
        }));
        this.treaties.set(sessionId, treaties);

        // DB에서 전쟁 로드
        const wars: WarDeclaration[] = dbState.wars.map(w => ({
          warId: w.warId,
          sessionId: w.sessionId,
          declaringFaction: w.declaringFaction,
          targetFaction: w.targetFaction,
          declaredAt: w.declaredAt,
          caususBelli: w.caususBelli,
          isActive: w.isActive,
          endedAt: w.endedAt,
          victor: w.victor,
          peaceTreaty: w.peaceTreaty,
        }));
        this.wars.set(sessionId, wars);

        // DB에서 메시지 로드
        const messages: DiplomaticMessage[] = dbState.messages.map(m => ({
          messageId: m.messageId,
          sessionId: m.sessionId,
          fromFactionId: m.fromFactionId,
          toFactionId: m.toFactionId,
          fromCharacterId: m.fromCharacterId,
          type: m.type,
          subject: m.subject,
          content: m.content,
          attachedTreatyId: m.attachedTreatyId,
          sentAt: m.sentAt,
          readAt: m.readAt,
          responseTo: m.responseTo,
        }));
        this.messages.set(sessionId, messages);

        logger.info(`[DiplomacyService] Loaded session ${sessionId} from DB`);
      } else {
        // DB에 없으면 새로 초기화
        this.initializeSession(sessionId);
      }
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to load session ${sessionId} from DB:`, error);
      // 에러 시 기본 초기화
      this.initializeSession(sessionId);
    }
  }

  /**
   * 세션 데이터를 DB에 저장
   */
  public async saveToDB(sessionId: string): Promise<void> {
    try {
      const treaties = this.treaties.get(sessionId) || [];
      const wars = this.wars.get(sessionId) || [];
      const messages = this.messages.get(sessionId) || [];

      await DiplomacyState.findOneAndUpdate(
        { sessionId },
        {
          sessionId,
          treaties,
          wars,
          messages,
        },
        { upsert: true, new: true }
      );

      logger.info(`[DiplomacyService] Saved session ${sessionId} to DB`);
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to save session ${sessionId} to DB:`, error);
    }
  }

  /**
   * 조약을 DB에 저장
   */
  private async saveTreatyToDB(sessionId: string, treaty: Treaty): Promise<void> {
    try {
      await DiplomacyState.findOneAndUpdate(
        { sessionId },
        { 
          $push: { treaties: treaty },
          $setOnInsert: { sessionId }
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to save treaty to DB:`, error);
    }
  }

  /**
   * 조약 상태를 DB에 업데이트
   */
  private async updateTreatyInDB(sessionId: string, treatyId: string, updates: Partial<Treaty>): Promise<void> {
    try {
      const updateFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        updateFields[`treaties.$.${key}`] = value;
      }

      await DiplomacyState.findOneAndUpdate(
        { sessionId, 'treaties.treatyId': treatyId },
        { $set: updateFields }
      );
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to update treaty in DB:`, error);
    }
  }

  /**
   * 전쟁 선언을 DB에 저장
   */
  private async saveWarToDB(sessionId: string, war: WarDeclaration): Promise<void> {
    try {
      await DiplomacyState.findOneAndUpdate(
        { sessionId },
        { 
          $push: { wars: war },
          $setOnInsert: { sessionId }
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to save war to DB:`, error);
    }
  }

  /**
   * 전쟁 상태를 DB에 업데이트
   */
  private async updateWarInDB(sessionId: string, warId: string, updates: Partial<WarDeclaration>): Promise<void> {
    try {
      const updateFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        updateFields[`wars.$.${key}`] = value;
      }

      await DiplomacyState.findOneAndUpdate(
        { sessionId, 'wars.warId': warId },
        { $set: updateFields }
      );
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to update war in DB:`, error);
    }
  }

  /**
   * 외교 메시지를 DB에 저장
   */
  private async saveMessageToDB(sessionId: string, message: DiplomaticMessage): Promise<void> {
    try {
      await DiplomacyState.findOneAndUpdate(
        { sessionId },
        { 
          $push: { messages: message },
          $setOnInsert: { sessionId }
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to save message to DB:`, error);
    }
  }

  /**
   * Faction 모델의 relations도 동기화
   */
  public async syncRelationToFaction(
    sessionId: string,
    factionA: string,
    factionB: string,
    relationValue: number,
    stance: 'allied' | 'friendly' | 'neutral' | 'hostile' | 'enemy'
  ): Promise<void> {
    try {
      // factionA의 relations 업데이트
      await Faction.findOneAndUpdate(
        { sessionId, factionId: factionA },
        {
          $set: {
            'relations.$[elem].relationValue': relationValue,
            'relations.$[elem].stance': stance,
          }
        },
        {
          arrayFilters: [{ 'elem.targetFactionId': factionB }],
        }
      );

      // 없으면 추가
      await Faction.findOneAndUpdate(
        { 
          sessionId, 
          factionId: factionA,
          'relations.targetFactionId': { $ne: factionB }
        },
        {
          $push: {
            relations: {
              targetFactionId: factionB,
              stance,
              relationValue,
            }
          }
        }
      );

      // factionB의 relations도 양방향 업데이트
      await Faction.findOneAndUpdate(
        { sessionId, factionId: factionB },
        {
          $set: {
            'relations.$[elem].relationValue': relationValue,
            'relations.$[elem].stance': stance,
          }
        },
        {
          arrayFilters: [{ 'elem.targetFactionId': factionA }],
        }
      );

      await Faction.findOneAndUpdate(
        { 
          sessionId, 
          factionId: factionB,
          'relations.targetFactionId': { $ne: factionA }
        },
        {
          $push: {
            relations: {
              targetFactionId: factionA,
              stance,
              relationValue,
            }
          }
        }
      );
    } catch (error) {
      logger.error(`[DiplomacyService] Failed to sync relation to Faction model:`, error);
    }
  }

  // ============================================================
  // 외교 상태 관리
  // ============================================================

  /**
   * 두 세력 간 외교 상태 조회
   */
  public getDiplomaticStatus(
    sessionId: string,
    factionA: string,
    factionB: string,
  ): DiplomaticStatus {
    const relation = this.getRelation(sessionId, factionA, factionB);
    return relation?.status || DiplomaticStatus.NEUTRAL;
  }

  /**
   * 외교 관계 조회
   */
  public getRelation(
    sessionId: string,
    factionA: string,
    factionB: string,
  ): DiplomaticRelation | undefined {
    const relations = this.relations.get(sessionId) || [];
    return relations.find(r =>
      (r.factionA === factionA && r.factionB === factionB) ||
      (r.factionA === factionB && r.factionB === factionA)
    );
  }

  /**
   * 관계 점수 변경
   */
  public modifyRelationScore(
    sessionId: string,
    factionA: string,
    factionB: string,
    delta: number,
    reason: string,
  ): { success: boolean; newScore: number; statusChanged?: DiplomaticStatus } {
    let relation = this.getRelation(sessionId, factionA, factionB);

    if (!relation) {
      // 새 관계 생성
      relation = {
        sessionId,
        factionA,
        factionB,
        status: DiplomaticStatus.NEUTRAL,
        relationScore: 0,
        treaties: [],
        lastInteraction: new Date(),
        incidentHistory: [],
      };
      const relations = this.relations.get(sessionId) || [];
      relations.push(relation);
      this.relations.set(sessionId, relations);
    }

    const oldStatus = relation.status;
    relation.relationScore = Math.max(-100, Math.min(100, relation.relationScore + delta));
    relation.lastInteraction = new Date();

    // 자동 상태 변경 (전쟁/휴전 상태가 아닐 때만)
    if (oldStatus !== DiplomaticStatus.AT_WAR && oldStatus !== DiplomaticStatus.CEASEFIRE) {
      const newStatus = this.calculateStatusFromScore(relation.relationScore);
      if (newStatus !== oldStatus) {
        relation.status = newStatus;
        this.emit('diplomacy:statusChanged', {
          sessionId,
          factionA,
          factionB,
          oldStatus,
          newStatus,
          reason,
        });
      }
    }

    logger.info(`[DiplomacyService] Relation ${factionA}-${factionB} modified: ${delta} (${reason})`);

    // Faction 모델에도 동기화 (비동기, 실패해도 캐시 데이터는 유지)
    const stance = this.statusToStance(relation.status);
    this.syncRelationToFaction(sessionId, factionA, factionB, relation.relationScore, stance)
      .catch(err => logger.warn('[DiplomacyService] Failed to sync relation to Faction:', err));

    return {
      success: true,
      newScore: relation.relationScore,
      statusChanged: relation.status !== oldStatus ? relation.status : undefined,
    };
  }

  /**
   * DiplomaticStatus를 Faction stance로 변환
   */
  private statusToStance(status: DiplomaticStatus): 'allied' | 'friendly' | 'neutral' | 'hostile' | 'enemy' {
    switch (status) {
      case DiplomaticStatus.ALLIED: return 'allied';
      case DiplomaticStatus.FRIENDLY: return 'friendly';
      case DiplomaticStatus.NEUTRAL:
      case DiplomaticStatus.CEASEFIRE: return 'neutral';
      case DiplomaticStatus.HOSTILE: return 'hostile';
      case DiplomaticStatus.AT_WAR: return 'enemy';
      default: return 'neutral';
    }
  }

  private calculateStatusFromScore(score: number): DiplomaticStatus {
    if (score >= RELATION_THRESHOLDS.ALLIED) return DiplomaticStatus.ALLIED;
    if (score >= RELATION_THRESHOLDS.FRIENDLY) return DiplomaticStatus.FRIENDLY;
    if (score >= RELATION_THRESHOLDS.NEUTRAL) return DiplomaticStatus.NEUTRAL;
    return DiplomaticStatus.HOSTILE;
  }

  // ============================================================
  // 조약 시스템
  // ============================================================

  /**
   * 조약 체결 제안
   */
  public async proposeTreaty(
    sessionId: string,
    proposingFaction: string,
    targetFaction: string,
    type: TreatyType,
    terms: Partial<TreatyTerms>,
  ): Promise<{ success: boolean; treaty?: Treaty; error?: string }> {
    const relation = this.getRelation(sessionId, proposingFaction, targetFaction);

    // 전쟁 중에는 조약 불가 (휴전 제외)
    if (relation?.status === DiplomaticStatus.AT_WAR && type !== TreatyType.CEASEFIRE) {
      return { success: false, error: '전쟁 중에는 휴전 외의 조약을 체결할 수 없습니다.' };
    }

    // 이미 같은 유형의 활성 조약이 있는지 확인
    const existingTreaties = this.treaties.get(sessionId) || [];
    const duplicateTreaty = existingTreaties.find(t =>
      t.isActive &&
      t.type === type &&
      t.parties.includes(proposingFaction) &&
      t.parties.includes(targetFaction)
    );

    if (duplicateTreaty) {
      return { success: false, error: '동일한 유형의 조약이 이미 체결되어 있습니다.' };
    }

    // 조약 생성 (대기 상태)
    const treaty: Treaty = {
      treatyId: `TREATY-${uuidv4().slice(0, 8)}`,
      type,
      parties: [proposingFaction, targetFaction],
      terms: {
        description: this.generateTreatyDescription(type, terms),
        ...terms,
      },
      signedAt: new Date(),
      expiresAt: terms.durationDays
        ? new Date(Date.now() + terms.durationDays * 24 * 60 * 60 * 1000)
        : undefined,
      isActive: false, // 상대방 수락 전
      breakCost: TREATY_BREAK_REPUTATION_COST[type],
      renewalCount: 0,
    };

    existingTreaties.push(treaty);
    this.treaties.set(sessionId, existingTreaties);

    // DB에 저장
    await this.saveTreatyToDB(sessionId, treaty);

    // 외교 메시지 발송
    await this.sendDiplomaticMessage(sessionId, {
      fromFactionId: proposingFaction,
      toFactionId: targetFaction,
      type: 'PROPOSAL',
      subject: `${this.getTreatyTypeName(type)} 체결 제안`,
      content: `${proposingFaction}이(가) ${this.getTreatyTypeName(type)} 체결을 제안합니다.`,
      attachedTreatyId: treaty.treatyId,
    });

    this.emit('diplomacy:treatyProposed', { sessionId, treaty });
    logger.info(`[DiplomacyService] Treaty proposed: ${type} between ${proposingFaction} and ${targetFaction}`);

    return { success: true, treaty };
  }

  /**
   * 조약 수락
   */
  public async acceptTreaty(
    sessionId: string,
    treatyId: string,
    acceptingFaction: string,
  ): Promise<{ success: boolean; treaty?: Treaty; error?: string }> {
    const treaties = this.treaties.get(sessionId) || [];
    const treaty = treaties.find(t => t.treatyId === treatyId);

    if (!treaty) {
      return { success: false, error: '조약을 찾을 수 없습니다.' };
    }

    if (!treaty.parties.includes(acceptingFaction)) {
      return { success: false, error: '이 조약의 당사자가 아닙니다.' };
    }

    if (treaty.isActive) {
      return { success: false, error: '이미 체결된 조약입니다.' };
    }

    // 조약 활성화
    treaty.isActive = true;
    treaty.signedAt = new Date();

    // DB에 업데이트
    await this.updateTreatyInDB(sessionId, treatyId, { isActive: true, signedAt: treaty.signedAt });

    // 외교 관계 업데이트
    const otherFaction = treaty.parties.find(p => p !== acceptingFaction)!;
    const relation = this.getRelation(sessionId, acceptingFaction, otherFaction);

    if (relation) {
      relation.treaties.push(treatyId);
      
      // 조약 유형에 따른 관계 개선
      const relationBonus = this.getTreatyRelationBonus(treaty.type);
      this.modifyRelationScore(sessionId, acceptingFaction, otherFaction, relationBonus, '조약 체결');

      // 휴전 조약인 경우 상태 변경
      if (treaty.type === TreatyType.CEASEFIRE) {
        relation.status = DiplomaticStatus.CEASEFIRE;
        relation.ceasefireEndDate = treaty.expiresAt;
      } else if (treaty.type === TreatyType.ALLIANCE) {
        relation.status = DiplomaticStatus.ALLIED;
      }
    }

    this.emit('diplomacy:treatySigned', { sessionId, treaty });
    logger.info(`[DiplomacyService] Treaty accepted: ${treatyId}`);

    return { success: true, treaty };
  }

  /**
   * 조약 파기
   */
  public async breakTreaty(
    sessionId: string,
    treatyId: string,
    breakingFaction: string,
    reason: string,
  ): Promise<{ success: boolean; reputationLoss: number; error?: string }> {
    const treaties = this.treaties.get(sessionId) || [];
    const treaty = treaties.find(t => t.treatyId === treatyId);

    if (!treaty) {
      return { success: false, reputationLoss: 0, error: '조약을 찾을 수 없습니다.' };
    }

    if (!treaty.parties.includes(breakingFaction)) {
      return { success: false, reputationLoss: 0, error: '이 조약의 당사자가 아닙니다.' };
    }

    if (!treaty.isActive) {
      return { success: false, reputationLoss: 0, error: '활성화되지 않은 조약입니다.' };
    }

    // 조약 비활성화
    treaty.isActive = false;

    // DB에 업데이트
    await this.updateTreatyInDB(sessionId, treatyId, { isActive: false });

    // 외교 관계 악화
    const otherFaction = treaty.parties.find(p => p !== breakingFaction)!;
    const relation = this.getRelation(sessionId, breakingFaction, otherFaction);

    if (relation) {
      relation.treaties = relation.treaties.filter(id => id !== treatyId);

      // 관계 악화
      const relationPenalty = -this.getTreatyRelationBonus(treaty.type) * 2;
      this.modifyRelationScore(sessionId, breakingFaction, otherFaction, relationPenalty, '조약 파기');

      // 사건 기록
      relation.incidentHistory.push({
        incidentId: `INCIDENT-${uuidv4().slice(0, 8)}`,
        type: 'TREATY_BROKEN',
        causedBy: breakingFaction,
        description: `${this.getTreatyTypeName(treaty.type)} 파기: ${reason}`,
        relationImpact: relationPenalty,
        occurredAt: new Date(),
      });
    }

    // 명성 손실
    const reputationLoss = treaty.breakCost;

    this.emit('diplomacy:treatyBroken', {
      sessionId,
      treaty,
      breakingFaction,
      reason,
      reputationLoss,
    });

    logger.warn(`[DiplomacyService] Treaty broken: ${treatyId} by ${breakingFaction}`);

    return { success: true, reputationLoss };
  }

  /**
   * 조약 조회
   */
  public getTreaties(sessionId: string, factionId?: string): Treaty[] {
    const treaties = this.treaties.get(sessionId) || [];

    if (factionId) {
      return treaties.filter(t => t.parties.includes(factionId) && t.isActive);
    }

    return treaties.filter(t => t.isActive);
  }

  // ============================================================
  // 전쟁 선포
  // ============================================================

  /**
   * 전쟁 선포
   */
  public async declareWar(
    sessionId: string,
    declaringFaction: string,
    targetFaction: string,
    caususBelli: string,
  ): Promise<{ success: boolean; war?: WarDeclaration; brokenTreaties: Treaty[]; error?: string }> {
    const relation = this.getRelation(sessionId, declaringFaction, targetFaction);

    if (relation?.status === DiplomaticStatus.AT_WAR) {
      return { success: false, brokenTreaties: [], error: '이미 전쟁 중입니다.' };
    }

    if (relation?.status === DiplomaticStatus.ALLIED) {
      return { success: false, brokenTreaties: [], error: '동맹국에 전쟁을 선포할 수 없습니다. 먼저 동맹을 파기하세요.' };
    }

    // 기존 조약 자동 파기
    const brokenTreaties: Treaty[] = [];
    const treaties = this.treaties.get(sessionId) || [];

    for (const treaty of treaties) {
      if (
        treaty.isActive &&
        treaty.parties.includes(declaringFaction) &&
        treaty.parties.includes(targetFaction)
      ) {
        treaty.isActive = false;
        brokenTreaties.push(treaty);
      }
    }

    // 전쟁 선언 생성
    const war: WarDeclaration = {
      warId: `WAR-${uuidv4().slice(0, 8)}`,
      sessionId,
      declaringFaction,
      targetFaction,
      declaredAt: new Date(),
      caususBelli,
      isActive: true,
    };

    const wars = this.wars.get(sessionId) || [];
    wars.push(war);
    this.wars.set(sessionId, wars);

    // DB에 저장
    await this.saveWarToDB(sessionId, war);

    // 외교 관계 업데이트
    if (relation) {
      relation.status = DiplomaticStatus.AT_WAR;
      relation.warStartDate = new Date();
      relation.treaties = [];
      relation.relationScore = Math.min(relation.relationScore, -80);

      relation.incidentHistory.push({
        incidentId: `INCIDENT-${uuidv4().slice(0, 8)}`,
        type: 'WAR_DECLARED',
        causedBy: declaringFaction,
        description: `전쟁 선포: ${caususBelli}`,
        relationImpact: -50,
        occurredAt: new Date(),
      });
    }

    this.emit('diplomacy:warDeclared', {
      sessionId,
      war,
      brokenTreaties,
    });

    logger.warn(`[DiplomacyService] WAR DECLARED: ${declaringFaction} -> ${targetFaction} (${caususBelli})`);

    return { success: true, war, brokenTreaties };
  }

  // ============================================================
  // 휴전 협상
  // ============================================================

  /**
   * 휴전 제안
   */
  public async proposeCeasefire(
    sessionId: string,
    proposingFaction: string,
    targetFaction: string,
    terms: CeasefireTerms,
  ): Promise<{ success: boolean; proposal?: CeasefireProposal; error?: string }> {
    const relation = this.getRelation(sessionId, proposingFaction, targetFaction);

    if (relation?.status !== DiplomaticStatus.AT_WAR) {
      return { success: false, error: '전쟁 중이 아니면 휴전을 제안할 수 없습니다.' };
    }

    // 이미 대기 중인 제안이 있는지 확인
    const proposals = this.ceasefireProposals.get(sessionId) || [];
    const pendingProposal = proposals.find(p =>
      p.status === 'PENDING' &&
      ((p.proposingFaction === proposingFaction && p.targetFaction === targetFaction) ||
       (p.proposingFaction === targetFaction && p.targetFaction === proposingFaction))
    );

    if (pendingProposal) {
      return { success: false, error: '이미 진행 중인 휴전 협상이 있습니다.' };
    }

    const proposal: CeasefireProposal = {
      proposalId: `CEASEFIRE-${uuidv4().slice(0, 8)}`,
      sessionId,
      proposingFaction,
      targetFaction,
      terms,
      proposedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후 만료
      status: 'PENDING',
    };

    proposals.push(proposal);
    this.ceasefireProposals.set(sessionId, proposals);

    // 외교 메시지 발송
    await this.sendDiplomaticMessage(sessionId, {
      fromFactionId: proposingFaction,
      toFactionId: targetFaction,
      type: 'PROPOSAL',
      subject: '휴전 협상 제안',
      content: `${proposingFaction}이(가) ${terms.durationDays}일간의 휴전을 제안합니다.`,
    });

    this.emit('diplomacy:ceasefireProposed', { sessionId, proposal });
    logger.info(`[DiplomacyService] Ceasefire proposed by ${proposingFaction}`);

    return { success: true, proposal };
  }

  /**
   * 휴전 수락
   */
  public async acceptCeasefire(
    sessionId: string,
    proposalId: string,
    acceptingFaction: string,
  ): Promise<{ success: boolean; treaty?: Treaty; error?: string }> {
    const proposals = this.ceasefireProposals.get(sessionId) || [];
    const proposal = proposals.find(p => p.proposalId === proposalId);

    if (!proposal) {
      return { success: false, error: '휴전 제안을 찾을 수 없습니다.' };
    }

    if (proposal.targetFaction !== acceptingFaction) {
      return { success: false, error: '이 휴전 제안의 수신자가 아닙니다.' };
    }

    if (proposal.status !== 'PENDING') {
      return { success: false, error: '이미 처리된 제안입니다.' };
    }

    if (new Date() > proposal.expiresAt) {
      proposal.status = 'EXPIRED';
      return { success: false, error: '만료된 제안입니다.' };
    }

    // 제안 수락
    proposal.status = 'ACCEPTED';

    // 휴전 조약 생성
    const treatyResult = await this.proposeTreaty(
      sessionId,
      proposal.proposingFaction,
      proposal.targetFaction,
      TreatyType.CEASEFIRE,
      {
        description: '휴전 협정',
        durationDays: proposal.terms.durationDays,
      },
    );

    if (treatyResult.treaty) {
      // 자동 수락
      await this.acceptTreaty(sessionId, treatyResult.treaty.treatyId, acceptingFaction);

      // 전쟁 종료 처리
      const wars = this.wars.get(sessionId) || [];
      const activeWar = wars.find(w =>
        w.isActive &&
        ((w.declaringFaction === proposal.proposingFaction && w.targetFaction === proposal.targetFaction) ||
         (w.declaringFaction === proposal.targetFaction && w.targetFaction === proposal.proposingFaction))
      );

      if (activeWar) {
        activeWar.isActive = false;
        activeWar.endedAt = new Date();
        activeWar.peaceTreaty = treatyResult.treaty.treatyId;

        // DB에 업데이트
        await this.updateWarInDB(sessionId, activeWar.warId, {
          isActive: false,
          endedAt: activeWar.endedAt,
          peaceTreaty: activeWar.peaceTreaty,
        });
      }
    }

    this.emit('diplomacy:ceasefireAccepted', { sessionId, proposal, treaty: treatyResult.treaty });
    logger.info(`[DiplomacyService] Ceasefire accepted: ${proposalId}`);

    return { success: true, treaty: treatyResult.treaty };
  }

  /**
   * 휴전 거절
   */
  public async rejectCeasefire(
    sessionId: string,
    proposalId: string,
    rejectingFaction: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const proposals = this.ceasefireProposals.get(sessionId) || [];
    const proposal = proposals.find(p => p.proposalId === proposalId);

    if (!proposal) {
      return { success: false, error: '휴전 제안을 찾을 수 없습니다.' };
    }

    if (proposal.targetFaction !== rejectingFaction) {
      return { success: false, error: '이 휴전 제안의 수신자가 아닙니다.' };
    }

    proposal.status = 'REJECTED';

    // 외교 메시지 발송
    await this.sendDiplomaticMessage(sessionId, {
      fromFactionId: rejectingFaction,
      toFactionId: proposal.proposingFaction,
      type: 'RESPONSE',
      subject: '휴전 제안 거절',
      content: reason || '귀측의 휴전 제안을 수락할 수 없습니다.',
    });

    this.emit('diplomacy:ceasefireRejected', { sessionId, proposal, reason });
    logger.info(`[DiplomacyService] Ceasefire rejected: ${proposalId}`);

    return { success: true };
  }

  // ============================================================
  // 외교 메시지
  // ============================================================

  /**
   * 외교 메시지 발송
   */
  public async sendDiplomaticMessage(
    sessionId: string,
    message: Omit<DiplomaticMessage, 'messageId' | 'sessionId' | 'sentAt'>,
  ): Promise<{ success: boolean; message?: DiplomaticMessage }> {
    const fullMessage: DiplomaticMessage = {
      messageId: `MSG-${uuidv4().slice(0, 8)}`,
      sessionId,
      ...message,
      sentAt: new Date(),
    };

    const messages = this.messages.get(sessionId) || [];
    messages.push(fullMessage);
    this.messages.set(sessionId, messages);

    // DB에 저장
    await this.saveMessageToDB(sessionId, fullMessage);

    this.emit('diplomacy:messageSent', { sessionId, message: fullMessage });
    logger.info(`[DiplomacyService] Message sent from ${message.fromFactionId} to ${message.toFactionId}`);

    return { success: true, message: fullMessage };
  }

  /**
   * 최후통첩 발송
   */
  public async sendUltimatum(
    sessionId: string,
    fromFactionId: string,
    toFactionId: string,
    demands: string,
    deadline: Date,
  ): Promise<{ success: boolean; message?: DiplomaticMessage }> {
    const result = await this.sendDiplomaticMessage(sessionId, {
      fromFactionId,
      toFactionId,
      type: 'ULTIMATUM',
      subject: '최후통첩',
      content: `${demands}\n\n응답 기한: ${deadline.toISOString()}`,
    });

    if (result.success) {
      // 관계 악화
      this.modifyRelationScore(sessionId, fromFactionId, toFactionId, -10, '최후통첩 발송');
    }

    return result;
  }

  /**
   * 메시지 조회
   */
  public getMessages(sessionId: string, factionId: string): DiplomaticMessage[] {
    const messages = this.messages.get(sessionId) || [];
    return messages.filter(m =>
      m.toFactionId === factionId || m.fromFactionId === factionId
    ).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  /**
   * 메시지 읽음 처리
   */
  public markMessageAsRead(sessionId: string, messageId: string): void {
    const messages = this.messages.get(sessionId) || [];
    const message = messages.find(m => m.messageId === messageId);
    if (message && !message.readAt) {
      message.readAt = new Date();
    }
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  private getTreatyTypeName(type: TreatyType): string {
    const names: Record<TreatyType, string> = {
      [TreatyType.TRADE]: '무역 협정',
      [TreatyType.NON_AGGRESSION]: '불가침 조약',
      [TreatyType.ALLIANCE]: '동맹 조약',
      [TreatyType.CEASEFIRE]: '휴전 협정',
      [TreatyType.MUTUAL_DEFENSE]: '상호방위 조약',
      [TreatyType.TRIBUTE]: '조공 협정',
    };
    return names[type] || '조약';
  }

  private getTreatyRelationBonus(type: TreatyType): number {
    const bonuses: Record<TreatyType, number> = {
      [TreatyType.TRADE]: 10,
      [TreatyType.NON_AGGRESSION]: 15,
      [TreatyType.ALLIANCE]: 30,
      [TreatyType.CEASEFIRE]: 20,
      [TreatyType.MUTUAL_DEFENSE]: 25,
      [TreatyType.TRIBUTE]: 5,
    };
    return bonuses[type] || 10;
  }

  private generateTreatyDescription(type: TreatyType, terms: Partial<TreatyTerms>): string {
    let desc = `${this.getTreatyTypeName(type)}`;

    if (terms.durationDays) {
      desc += ` (${terms.durationDays}일)`;
    }

    if (terms.tradeBonus) {
      desc += `, 무역 보너스 ${terms.tradeBonus}%`;
    }

    if (terms.mutualDefense) {
      desc += ', 상호방위 조항 포함';
    }

    return desc;
  }

  // ============================================================
  // 매 틱 처리
  // ============================================================

  /**
   * 휴전 만료 처리
   */
  public processCeasefireExpiry(sessionId: string): void {
    const now = new Date();
    const treaties = this.treaties.get(sessionId) || [];

    for (const treaty of treaties) {
      if (
        treaty.isActive &&
        treaty.type === TreatyType.CEASEFIRE &&
        treaty.expiresAt &&
        treaty.expiresAt <= now
      ) {
        // 휴전 만료
        treaty.isActive = false;

        const [factionA, factionB] = treaty.parties;
        const relation = this.getRelation(sessionId, factionA, factionB);

        if (relation) {
          // 휴전 종료 후 관계에 따라 상태 결정
          if (relation.relationScore < RELATION_THRESHOLDS.HOSTILE) {
            relation.status = DiplomaticStatus.HOSTILE;
          } else {
            relation.status = DiplomaticStatus.NEUTRAL;
          }
          relation.ceasefireEndDate = undefined;
        }

        this.emit('diplomacy:ceasefireExpired', { sessionId, treaty });
        logger.info(`[DiplomacyService] Ceasefire expired: ${treaty.treatyId}`);
      }
    }
  }

  /**
   * 조약 만료 처리
   */
  public processTreatyExpiry(sessionId: string): void {
    const now = new Date();
    const treaties = this.treaties.get(sessionId) || [];

    for (const treaty of treaties) {
      if (treaty.isActive && treaty.expiresAt && treaty.expiresAt <= now) {
        treaty.isActive = false;

        const [factionA, factionB] = treaty.parties;
        const relation = this.getRelation(sessionId, factionA, factionB);

        if (relation) {
          relation.treaties = relation.treaties.filter(id => id !== treaty.treatyId);
        }

        this.emit('diplomacy:treatyExpired', { sessionId, treaty });
        logger.info(`[DiplomacyService] Treaty expired: ${treaty.treatyId}`);
      }
    }
  }

  // ============================================================
  // 조회 API
  // ============================================================

  public getAllRelations(sessionId: string): DiplomaticRelation[] {
    return this.relations.get(sessionId) || [];
  }

  public getActiveWars(sessionId: string): WarDeclaration[] {
    const wars = this.wars.get(sessionId) || [];
    return wars.filter(w => w.isActive);
  }

  public getPendingCeasefireProposals(sessionId: string, factionId: string): CeasefireProposal[] {
    const proposals = this.ceasefireProposals.get(sessionId) || [];
    return proposals.filter(p =>
      p.status === 'PENDING' &&
      (p.proposingFaction === factionId || p.targetFaction === factionId)
    );
  }
}

export const diplomacyService = DiplomacyService.getInstance();
export default DiplomacyService;





