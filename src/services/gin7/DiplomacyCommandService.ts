/**
 * DiplomacyCommandService - 외교 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 외교 커맨드:
 * - DIPLOMACY (外交): 외교 - 페잔 및 세력 간 외교
 * - PROPOSE_TREATY: 조약 체결 제안
 * - DECLARE_WAR: 전쟁 선포
 * - NEGOTIATE_CEASEFIRE: 휴전 협상
 * - EXERT_INFLUENCE: 영향력 행사
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Faction } from '../../models/gin7/Faction';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';
import { DiplomacyService, DiplomaticStatus, TreatyType } from './DiplomacyService';
import { BudgetService } from './BudgetService';
import { JobCardService } from './JobCardService';
import { EconomyService } from './EconomyService';

// ============================================================
// Types
// ============================================================

export interface DiplomacyRequest {
  sessionId: string;
  characterId: string;     // 실행자
  commandId: string;       // 커맨드 ID
  targetFactionId?: string; // 대상 세력
  targetCharacterId?: string; // 대상 캐릭터 (외교관)
  params?: Record<string, any>; // 추가 파라미터
}

export interface DiplomacyResult {
  success: boolean;
  commandId: string;
  effects: {
    relationChange?: number;
    treatyId?: string;
    warDeclared?: boolean;
    ceasefireAgreed?: boolean;
    influenceChange?: number;
  };
  cpCost: number;
  message?: string;
  error?: string;
}

export type CmdTreatyType =
  | 'NON_AGGRESSION'      // 불가침 조약
  | 'TRADE_AGREEMENT'     // 무역 협정
  | 'MILITARY_ALLIANCE'   // 군사 동맹
  | 'PASSAGE_RIGHTS'      // 통행권
  | 'CEASEFIRE'           // 휴전 협정
  | 'PEACE_TREATY'        // 평화 조약
  | 'TRIBUTE'             // 조공
  | 'VASSALAGE';          // 속국 관계

export type CmdDiplomaticAction =
  | 'NEGOTIATE'           // 협상
  | 'TRADE'               // 무역 협의
  | 'ALLIANCE'            // 동맹 제안
  | 'PROTEST'             // 항의
  | 'THREATEN'            // 위협
  | 'REQUEST_AID'         // 원조 요청
  | 'OFFER_AID'           // 원조 제안
  | 'INFORMATION_EXCHANGE'; // 정보 교환

export interface CmdTreaty {
  treatyId: string;
  sessionId: string;
  type: CmdTreatyType;
  parties: string[];        // 참여 세력 ID들
  partyNames: string[];     // 참여 세력 이름들
  terms: CmdTreatyTerms;
  status: 'proposed' | 'active' | 'expired' | 'violated' | 'terminated';
  proposedBy: string;
  proposedAt: Date;
  signedAt?: Date;
  expiresAt?: Date;
  violatedBy?: string;
}

export interface CmdTreatyTerms {
  duration?: number;        // 기간 (게임일)
  tribute?: {
    from: string;
    to: string;
    amount: number;
    interval: 'monthly' | 'yearly';
  };
  tradeTariff?: number;     // 관세율
  passageConditions?: string[];
  militarySupport?: boolean;
  otherTerms?: string[];
}

export interface CmdDiplomaticRelation {
  fromFactionId: string;
  toFactionId: string;
  relationValue: number;    // -100 ~ +100
  status: 'war' | 'hostile' | 'neutral' | 'friendly' | 'allied';
  treaties: string[];       // 체결된 조약 ID들
  lastInteraction?: Date;
}

export interface CmdWarDeclaration {
  declarationId: string;
  sessionId: string;
  declaringFactionId: string;
  declaringFactionName: string;
  targetFactionId: string;
  targetFactionName: string;
  reason: string;
  declaredAt: Date;
  status: 'active' | 'ceasefire' | 'ended';
}

export interface CmdCeasefireNegotiation {
  negotiationId: string;
  sessionId: string;
  proposingFactionId: string;
  proposingFactionName: string;
  receivingFactionId: string;
  receivingFactionName: string;
  terms: CmdCeasefireTerms;
  status: 'proposed' | 'accepted' | 'rejected' | 'counter_proposed';
  proposedAt: Date;
  respondedAt?: Date;
}

export interface CmdCeasefireTerms {
  duration?: number;        // 휴전 기간 (게임일)
  territorialChanges?: {
    planetId: string;
    from: string;
    to: string;
  }[];
  reparations?: number;     // 전쟁 배상금
  prisonerExchange?: boolean;
  demilitarizedZones?: string[];
}

// ============================================================
// DiplomacyCommandService Class
// ============================================================

export class DiplomacyCommandService extends EventEmitter {
  private static instance: DiplomacyCommandService;

  private constructor() {
    super();
    logger.info('[DiplomacyCommandService] Initialized');
  }

  public static getInstance(): DiplomacyCommandService {
    if (!DiplomacyCommandService.instance) {
      DiplomacyCommandService.instance = new DiplomacyCommandService();
    }
    return DiplomacyCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 외교 커맨드 라우터
   */
  public async executeDiplomacyCommand(request: DiplomacyRequest): Promise<DiplomacyResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'DIPLOMACY':
        return this.conductDiplomacy(request);
      case 'PROPOSE_TREATY':
        return this.proposeTreaty(request);
      case 'DECLARE_WAR':
        return this.declareWar(request);
      case 'NEGOTIATE_CEASEFIRE':
        return this.negotiateCeasefire(request);
      case 'EXERT_INFLUENCE':
        return this.exertInfluence(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 외교 커맨드입니다.');
    }
  }

  // ============================================================
  // 외교 커맨드 구현
  // ============================================================

  /**
   * 외교 (外交)
   * 페잔 및 세력 간 일반 외교 활동
   * CP: 320
   */
  public async conductDiplomacy(request: DiplomacyRequest): Promise<DiplomacyResult> {
    const { sessionId, characterId, targetFactionId, params } = request;
    const cpCost = this.getCommandCost('DIPLOMACY');

    if (!targetFactionId) {
      return this.errorResult('DIPLOMACY', cpCost, '외교 대상 세력이 필요합니다.');
    }

    const action = params?.action as CmdDiplomaticAction;
    if (!action) {
      return this.errorResult('DIPLOMACY', cpCost, '외교 행동 유형이 필요합니다.');
    }

    try {
      const diplomat = await Gin7Character.findOne({ sessionId, characterId });
      if (!diplomat) {
        return this.errorResult('DIPLOMACY', cpCost, '외교관을 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkDiplomaticAuthority(diplomat, 'DIPLOMACY');
      if (!hasAuthority) {
        return this.errorResult('DIPLOMACY', cpCost, '외교 권한이 없습니다.');
      }

      const sourceFactionId = diplomat.factionId;

      // 외교 행동에 따른 관계 변화 계산
      const relationChange = this.calculateRelationChange(action, params);
      
      // 외교 스탯 기반 보너스
      const politicsStat = diplomat.stats?.politics || 50;
      const charmStat = diplomat.stats?.charm || 50;
      const diplomacyBonus = (politicsStat + charmStat) / 200;
      const effectiveChange = Math.floor(relationChange * (1 + diplomacyBonus));

      // 관계 업데이트 (DiplomacyService 연동 필요)
      // TODO: 실제 관계 데이터 업데이트
      await this.updateDiplomaticRelation(sessionId, sourceFactionId, targetFactionId, effectiveChange);

      // 페잔 특수 처리
      const isFezzan = targetFactionId.toLowerCase().includes('fezzan') ||
                       targetFactionId.toLowerCase().includes('phezzan');
      
      let additionalEffects = '';
      if (isFezzan) {
        // 페잔 외교 특수 효과
        additionalEffects = await this.handleFezzanDiplomacy(sessionId, diplomat, action, params);
      }

      this.emit('diplomacy:conducted', {
        sessionId,
        diplomat: { id: characterId, name: diplomat.name, faction: sourceFactionId },
        targetFactionId,
        action,
        relationChange: effectiveChange,
        isFezzan,
        timestamp: new Date(),
      });

      logger.info(`[DiplomacyCommandService] Diplomacy conducted: ${diplomat.name} -> ${targetFactionId}, action: ${action}`);

      return {
        success: true,
        commandId: 'DIPLOMACY',
        effects: {
          relationChange: effectiveChange,
        },
        cpCost,
        message: `${targetFactionId}와(과)의 외교 활동을 수행했습니다. 관계 변화: ${effectiveChange > 0 ? '+' : ''}${effectiveChange}${additionalEffects}`,
      };
    } catch (error) {
      logger.error('[DiplomacyCommandService] Conduct diplomacy error:', error);
      return this.errorResult('DIPLOMACY', cpCost, '외교 활동 중 오류 발생');
    }
  }

  /**
   * 조약 체결 (条約締結)
   * 세력 간 조약 체결 제안
   * CP: 320
   */
  public async proposeTreaty(request: DiplomacyRequest): Promise<DiplomacyResult> {
    const { sessionId, characterId, targetFactionId, params } = request;
    const cpCost = this.getCommandCost('PROPOSE_TREATY') || 320;

    if (!targetFactionId) {
      return this.errorResult('PROPOSE_TREATY', cpCost, '조약 대상 세력이 필요합니다.');
    }

    const treatyType = params?.treatyType as CmdTreatyType;
    if (!treatyType) {
      return this.errorResult('PROPOSE_TREATY', cpCost, '조약 유형이 필요합니다.');
    }

    try {
      const diplomat = await Gin7Character.findOne({ sessionId, characterId });
      if (!diplomat) {
        return this.errorResult('PROPOSE_TREATY', cpCost, '외교관을 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkDiplomaticAuthority(diplomat, 'TREATY');
      if (!hasAuthority) {
        return this.errorResult('PROPOSE_TREATY', cpCost, '조약 체결 권한이 없습니다.');
      }

      const sourceFactionId = diplomat.factionId;
      const sourceFactionName = this.getFactionDisplayName(sourceFactionId);
      const targetFactionName = this.getFactionDisplayName(targetFactionId);

      // 기존 조약 체크
      const existingTreaty = await this.checkExistingTreaty(sessionId, sourceFactionId, targetFactionId, treatyType);
      if (existingTreaty) {
        return this.errorResult('PROPOSE_TREATY', cpCost, '동일한 조약이 이미 존재합니다.');
      }

      // 조약 생성
      const treaty: CmdTreaty = {
        treatyId: this.generateId(),
        sessionId,
        type: treatyType,
        parties: [sourceFactionId, targetFactionId],
        partyNames: [sourceFactionName, targetFactionName],
        terms: this.createTreatyTerms(treatyType, params),
        status: 'proposed',
        proposedBy: sourceFactionId,
        proposedAt: new Date(),
      };

      // 조약 제안 저장 (별도 모델 필요)
      // TODO: Treaty 모델 연동

      this.emit('diplomacy:treatyProposed', {
        sessionId,
        treaty,
        proposer: { id: characterId, name: diplomat.name, faction: sourceFactionId },
        targetFactionId,
        timestamp: new Date(),
      });

      logger.info(`[DiplomacyCommandService] Treaty proposed: ${treatyType} by ${diplomat.name} to ${targetFactionId}`);

      return {
        success: true,
        commandId: 'PROPOSE_TREATY',
        effects: {
          treatyId: treaty.treatyId,
        },
        cpCost,
        message: `${targetFactionName}에게 ${this.getTreatyDisplayName(treatyType)} 제안을 보냈습니다.`,
      };
    } catch (error) {
      logger.error('[DiplomacyCommandService] Propose treaty error:', error);
      return this.errorResult('PROPOSE_TREATY', cpCost, '조약 제안 중 오류 발생');
    }
  }

  /**
   * 전쟁 선포 (宣戦布告)
   * 세력에 대한 전쟁 선포
   * CP: 640
   */
  public async declareWar(request: DiplomacyRequest): Promise<DiplomacyResult> {
    const { sessionId, characterId, targetFactionId, params } = request;
    const cpCost = this.getCommandCost('DECLARE_WAR') || 640;

    if (!targetFactionId) {
      return this.errorResult('DECLARE_WAR', cpCost, '전쟁 대상 세력이 필요합니다.');
    }

    try {
      const declarer = await Gin7Character.findOne({ sessionId, characterId });
      if (!declarer) {
        return this.errorResult('DECLARE_WAR', cpCost, '선포자를 찾을 수 없습니다.');
      }

      // 권한 체크 (국가 원수급만 가능)
      const hasAuthority = await this.checkDiplomaticAuthority(declarer, 'WAR_DECLARATION');
      if (!hasAuthority) {
        return this.errorResult('DECLARE_WAR', cpCost, '전쟁 선포 권한이 없습니다. 국가 원수만 전쟁을 선포할 수 있습니다.');
      }

      const sourceFactionId = declarer.factionId;

      // 이미 전쟁 중인지 확인
      const existingWar = await this.checkExistingWar(sessionId, sourceFactionId, targetFactionId);
      if (existingWar) {
        return this.errorResult('DECLARE_WAR', cpCost, '이미 해당 세력과 전쟁 중입니다.');
      }

      // 동맹 관계면 선포 불가
      const isAllied = await this.checkAlliance(sessionId, sourceFactionId, targetFactionId);
      if (isAllied) {
        return this.errorResult('DECLARE_WAR', cpCost, '동맹 세력에게는 전쟁을 선포할 수 없습니다. 먼저 동맹을 파기하세요.');
      }

      // 페잔에 대한 전쟁 선포 시 중립 침해 경고
      const isFezzan = targetFactionId.toLowerCase().includes('fezzan') ||
                       targetFactionId.toLowerCase().includes('phezzan');
      if (isFezzan) {
        // 중립 침해 페널티 적용 필요
        logger.warn(`[DiplomacyCommandService] Warning: War declared on Fezzan - neutrality violation`);
      }

      // 전쟁 선포 기록
      const warDeclaration: CmdWarDeclaration = {
        declarationId: this.generateId(),
        sessionId,
        declaringFactionId: sourceFactionId,
        declaringFactionName: this.getFactionDisplayName(sourceFactionId),
        targetFactionId,
        targetFactionName: this.getFactionDisplayName(targetFactionId),
        reason: params?.reason || '선포 이유 불명',
        declaredAt: new Date(),
        status: 'active',
      };

      // 관계를 전쟁 상태로 변경
      await this.updateDiplomaticRelation(sessionId, sourceFactionId, targetFactionId, -100);

      // 기존 조약 파기
      await this.terminateAllTreaties(sessionId, sourceFactionId, targetFactionId);

      this.emit('diplomacy:warDeclared', {
        sessionId,
        warDeclaration,
        declarer: { id: characterId, name: declarer.name },
        timestamp: new Date(),
      });

      logger.info(`[DiplomacyCommandService] War declared: ${sourceFactionId} -> ${targetFactionId}`);

      return {
        success: true,
        commandId: 'DECLARE_WAR',
        effects: {
          warDeclared: true,
          relationChange: -100,
        },
        cpCost,
        message: `${this.getFactionDisplayName(targetFactionId)}에 전쟁을 선포했습니다!`,
      };
    } catch (error) {
      logger.error('[DiplomacyCommandService] Declare war error:', error);
      return this.errorResult('DECLARE_WAR', cpCost, '전쟁 선포 중 오류 발생');
    }
  }

  /**
   * 휴전 협상 (休戦協商)
   * 전쟁 중인 세력과의 휴전 협상
   * CP: 320
   */
  public async negotiateCeasefire(request: DiplomacyRequest): Promise<DiplomacyResult> {
    const { sessionId, characterId, targetFactionId, params } = request;
    const cpCost = this.getCommandCost('NEGOTIATE_CEASEFIRE') || 320;

    if (!targetFactionId) {
      return this.errorResult('NEGOTIATE_CEASEFIRE', cpCost, '휴전 대상 세력이 필요합니다.');
    }

    try {
      const negotiator = await Gin7Character.findOne({ sessionId, characterId });
      if (!negotiator) {
        return this.errorResult('NEGOTIATE_CEASEFIRE', cpCost, '협상자를 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkDiplomaticAuthority(negotiator, 'CEASEFIRE');
      if (!hasAuthority) {
        return this.errorResult('NEGOTIATE_CEASEFIRE', cpCost, '휴전 협상 권한이 없습니다.');
      }

      const sourceFactionId = negotiator.factionId;

      // 전쟁 중인지 확인
      const existingWar = await this.checkExistingWar(sessionId, sourceFactionId, targetFactionId);
      if (!existingWar) {
        return this.errorResult('NEGOTIATE_CEASEFIRE', cpCost, '해당 세력과 전쟁 상태가 아닙니다.');
      }

      // 휴전 조건 구성
      const ceasefireTerms: CmdCeasefireTerms = {
        duration: params?.duration || 30, // 기본 30일
        reparations: params?.reparations || 0,
        prisonerExchange: params?.prisonerExchange ?? true,
        territorialChanges: params?.territorialChanges || [],
        demilitarizedZones: params?.demilitarizedZones || [],
      };

      // 휴전 협상 기록
      const negotiation: CmdCeasefireNegotiation = {
        negotiationId: this.generateId(),
        sessionId,
        proposingFactionId: sourceFactionId,
        proposingFactionName: this.getFactionDisplayName(sourceFactionId),
        receivingFactionId: targetFactionId,
        receivingFactionName: this.getFactionDisplayName(targetFactionId),
        terms: ceasefireTerms,
        status: 'proposed',
        proposedAt: new Date(),
      };

      this.emit('diplomacy:ceasefireProposed', {
        sessionId,
        negotiation,
        proposer: { id: characterId, name: negotiator.name },
        timestamp: new Date(),
      });

      logger.info(`[DiplomacyCommandService] Ceasefire proposed: ${sourceFactionId} -> ${targetFactionId}`);

      return {
        success: true,
        commandId: 'NEGOTIATE_CEASEFIRE',
        effects: {
          treatyId: negotiation.negotiationId,
        },
        cpCost,
        message: `${this.getFactionDisplayName(targetFactionId)}에게 휴전 제안을 보냈습니다. (${ceasefireTerms.duration}일)`,
      };
    } catch (error) {
      logger.error('[DiplomacyCommandService] Negotiate ceasefire error:', error);
      return this.errorResult('NEGOTIATE_CEASEFIRE', cpCost, '휴전 협상 중 오류 발생');
    }
  }

  /**
   * 영향력 행사 (影響力行使)
   * 특정 세력/지역에 대한 외교적 영향력 행사
   * CP: 320
   */
  public async exertInfluence(request: DiplomacyRequest): Promise<DiplomacyResult> {
    const { sessionId, characterId, targetFactionId, params } = request;
    const cpCost = this.getCommandCost('EXERT_INFLUENCE') || 320;

    if (!targetFactionId) {
      return this.errorResult('EXERT_INFLUENCE', cpCost, '영향력 행사 대상이 필요합니다.');
    }

    const influenceType = params?.type || 'diplomatic'; // diplomatic, economic, military

    try {
      const diplomat = await Gin7Character.findOne({ sessionId, characterId });
      if (!diplomat) {
        return this.errorResult('EXERT_INFLUENCE', cpCost, '실행자를 찾을 수 없습니다.');
      }

      // 권한 체크
      const hasAuthority = await this.checkDiplomaticAuthority(diplomat, 'INFLUENCE');
      if (!hasAuthority) {
        return this.errorResult('EXERT_INFLUENCE', cpCost, '영향력 행사 권한이 없습니다.');
      }

      const sourceFactionId = diplomat.factionId;

      // 영향력 계산
      const baseInfluence = 10;
      const politicsBonus = (diplomat.stats?.politics || 50) / 100;
      const charmBonus = (diplomat.stats?.charm || 50) / 100;

      let influenceGain = baseInfluence;
      let typeModifier = 1;

      switch (influenceType) {
        case 'diplomatic':
          typeModifier = 1 + (politicsBonus + charmBonus) / 2;
          break;
        case 'economic': {
          typeModifier = 1 + politicsBonus;
          // 경제적 영향력은 자원 소모 필요 - EconomyService 연동
          const economyCost = params?.economyCost || 10000;
          const economyService = EconomyService.getInstance();
          const faction = diplomat.factionId;
          
          if (faction) {
            const treasury = economyService.getTreasury(sessionId, faction);
            if (treasury && treasury.balance < economyCost) {
              return this.errorResult('EXERT_INFLUENCE', cpCost, `국고 잔액 부족 (필요: ${economyCost.toLocaleString()}, 현재: ${treasury.balance.toLocaleString()})`);
            }
            
            // 자원 차감
            if (treasury) {
              const expenseResult = await BudgetService.processExpense(
                sessionId,
                faction,
                {
                  category: 'diplomacy',
                  amount: economyCost,
                  description: `경제적 영향력 행사: ${this.getFactionDisplayName(targetFactionId)}`,
                  authorizedBy: diplomat.characterId,
                },
                params?.gameDay || 0
              );
              
              if (!expenseResult.success) {
                return this.errorResult('EXERT_INFLUENCE', cpCost, `자원 차감 실패: ${expenseResult.error}`);
              }
              
              // 경제적 영향력은 자원 투입량에 비례해 효과 증가
              typeModifier = 1 + politicsBonus + (economyCost / 50000);
              logger.info(`[DiplomacyCommandService] Economic influence: ${economyCost} credits spent`);
            }
          }
          break;
        }
        case 'military':
          // 군사적 영향력은 위협적이지만 관계 악화 가능
          typeModifier = 1.5;
          break;
      }

      influenceGain = Math.floor(baseInfluence * typeModifier);

      // 관계 변화 (영향력 유형에 따라)
      let relationChange = 0;
      if (influenceType === 'diplomatic') {
        relationChange = Math.floor(influenceGain / 3);
      } else if (influenceType === 'military') {
        relationChange = -Math.floor(influenceGain / 5); // 위협은 관계 악화
      }

      // 영향력 업데이트
      await this.updateFactionInfluence(sessionId, sourceFactionId, targetFactionId, influenceGain);

      // 관계 업데이트
      if (relationChange !== 0) {
        await this.updateDiplomaticRelation(sessionId, sourceFactionId, targetFactionId, relationChange);
      }

      this.emit('diplomacy:influenceExerted', {
        sessionId,
        diplomat: { id: characterId, name: diplomat.name },
        sourceFactionId,
        targetFactionId,
        influenceType,
        influenceGain,
        relationChange,
        timestamp: new Date(),
      });

      logger.info(`[DiplomacyCommandService] Influence exerted: ${diplomat.name} on ${targetFactionId}, type: ${influenceType}, gain: ${influenceGain}`);

      return {
        success: true,
        commandId: 'EXERT_INFLUENCE',
        effects: {
          influenceChange: influenceGain,
          relationChange,
        },
        cpCost,
        message: `${this.getFactionDisplayName(targetFactionId)}에 대한 ${this.getInfluenceTypeDisplayName(influenceType)} 영향력을 행사했습니다. (+${influenceGain})`,
      };
    } catch (error) {
      logger.error('[DiplomacyCommandService] Exert influence error:', error);
      return this.errorResult('EXERT_INFLUENCE', cpCost, '영향력 행사 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 320;
  }

  private errorResult(commandId: string, cpCost: number, error: string): DiplomacyResult {
    return {
      success: false,
      commandId,
      effects: {},
      cpCost,
      error,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 외교 권한 체크
   * JobCardService와 연동하여 직위 권한 검증
   */
  private async checkDiplomaticAuthority(
    character: IGin7Character,
    authorityType: 'DIPLOMACY' | 'TREATY' | 'WAR_DECLARATION' | 'CEASEFIRE' | 'INFLUENCE'
  ): Promise<boolean> {
    const jobCardService = JobCardService.getInstance();

    // 커맨드 ID 매핑
    const commandMapping: Record<string, string> = {
      'DIPLOMACY': 'DIPLOMACY',
      'TREATY': 'PROPOSE_TREATY',
      'WAR_DECLARATION': 'DECLARE_WAR',
      'CEASEFIRE': 'NEGOTIATE_CEASEFIRE',
      'INFLUENCE': 'EXERT_INFLUENCE',
    };

    const commandId = commandMapping[authorityType];

    // JobCardService로 권한 체크
    const authResult = await jobCardService.checkCommandAuth(
      character.sessionId,
      character.characterId,
      commandId
    );

    if (authResult.allowed) {
      return true;
    }

    // WAR_DECLARATION은 최고 지도자만 가능 (추가 체크)
    if (authorityType === 'WAR_DECLARATION') {
      const topPositions = ['emperor', 'chairman', '황제', '의장', 'supreme_commander', '최고사령관'];
      const hasTopPosition = topPositions.some(p => 
        character.rank?.toLowerCase().includes(p) ||
        character.data?.position?.toLowerCase().includes(p) ||
        character.data?.jobCard?.id?.toLowerCase().includes(p)
      );
      
      if (!hasTopPosition) {
        logger.warn(`[DiplomacyCommandService] War declaration denied for ${character.name}: insufficient authority`);
        return false;
      }
    }

    // TREATY도 고위직만 가능
    if (authorityType === 'TREATY') {
      const highPositions = ['emperor', 'chairman', 'minister', 'chancellor', 'admiral', '대신', '원수', '제독'];
      const hasHighPosition = highPositions.some(p => 
        character.rank?.toLowerCase().includes(p) ||
        character.data?.position?.toLowerCase().includes(p) ||
        character.data?.jobCard?.id?.toLowerCase().includes(p)
      );
      
      if (!hasHighPosition) {
        logger.warn(`[DiplomacyCommandService] Treaty proposal denied for ${character.name}: insufficient authority`);
        return false;
      }
    }

    // 기본적으로 외교 권한이 있는 직위면 허용
    const diplomaticPositions = ['diplomat', 'ambassador', 'envoy', 'minister', '외교관', '대사', '특사', '대신'];
    const hasDiplomaticRole = diplomaticPositions.some(p => 
      character.data?.position?.toLowerCase().includes(p) ||
      character.data?.jobCard?.id?.toLowerCase().includes(p)
    );

    if (hasDiplomaticRole) {
      return true;
    }

    // 직위가 없어도 diplomacy authority 플래그가 있으면 허용
    const authorities = character.data?.authorities || [];
    if (Array.isArray(authorities) && authorities.includes('diplomacy')) {
      return true;
    }

    logger.info(`[DiplomacyCommandService] Authority check for ${character.name}: ${authorityType} = ${authResult.allowed}`);
    return authResult.allowed;
  }

  /**
   * 외교 행동에 따른 관계 변화 계산
   */
  private calculateRelationChange(action: CmdDiplomaticAction, params?: Record<string, any>): number {
    const changes: Record<CmdDiplomaticAction, number> = {
      'NEGOTIATE': 5,
      'TRADE': 8,
      'ALLIANCE': 15,
      'PROTEST': -10,
      'THREATEN': -20,
      'REQUEST_AID': 0,
      'OFFER_AID': 10,
      'INFORMATION_EXCHANGE': 5,
    };

    return changes[action] || 0;
  }

  /**
   * 외교 관계 업데이트
   * DiplomacyService와 Faction 모델 양쪽에 반영
   */
  private async updateDiplomaticRelation(
    sessionId: string,
    fromFactionId: string,
    toFactionId: string,
    change: number
  ): Promise<void> {
    try {
      // 1. DiplomacyService(메모리 캐시)에 반영
      const diplomacyService = DiplomacyService.getInstance();
      const result = diplomacyService.modifyRelationScore(
        sessionId,
        fromFactionId,
        toFactionId,
        change,
        'DiplomacyCommandService action'
      );

      // 2. Faction 모델의 relations 배열에도 반영
      const faction = await Faction.findOne({ sessionId, factionId: fromFactionId });
      if (faction) {
        const relationIdx = faction.relations.findIndex(r => r.targetFactionId === toFactionId);
        if (relationIdx >= 0) {
          // 기존 관계 업데이트
          const currentValue = faction.relations[relationIdx].relationValue;
          const newValue = Math.max(-100, Math.min(100, currentValue + change));
          faction.relations[relationIdx].relationValue = newValue;
          
          // 관계 상태 업데이트
          if (newValue <= -80) {
            faction.relations[relationIdx].stance = 'enemy';
          } else if (newValue <= -40) {
            faction.relations[relationIdx].stance = 'hostile';
          } else if (newValue <= 40) {
            faction.relations[relationIdx].stance = 'neutral';
          } else if (newValue <= 80) {
            faction.relations[relationIdx].stance = 'friendly';
          } else {
            faction.relations[relationIdx].stance = 'allied';
          }
        } else {
          // 새 관계 추가
          const newValue = Math.max(-100, Math.min(100, change));
          faction.relations.push({
            targetFactionId: toFactionId,
            stance: this.getStanceFromValue(newValue),
            relationValue: newValue,
          });
        }
        await faction.save();
      }

      // 대상 세력에도 동일하게 반영 (양방향 관계)
      const targetFaction = await Faction.findOne({ sessionId, factionId: toFactionId });
      if (targetFaction) {
        const relationIdx = targetFaction.relations.findIndex(r => r.targetFactionId === fromFactionId);
        if (relationIdx >= 0) {
          const currentValue = targetFaction.relations[relationIdx].relationValue;
          const newValue = Math.max(-100, Math.min(100, currentValue + change));
          targetFaction.relations[relationIdx].relationValue = newValue;
          targetFaction.relations[relationIdx].stance = this.getStanceFromValue(newValue);
        } else {
          const newValue = Math.max(-100, Math.min(100, change));
          targetFaction.relations.push({
            targetFactionId: fromFactionId,
            stance: this.getStanceFromValue(newValue),
            relationValue: newValue,
          });
        }
        await targetFaction.save();
      }

      logger.info(`[DiplomacyCommandService] Relation updated: ${fromFactionId} <-> ${toFactionId}, ${change > 0 ? '+' : ''}${change}`);
    } catch (error) {
      logger.error('[DiplomacyCommandService] Failed to update diplomatic relation:', error);
    }
  }

  /**
   * 관계 값에서 stance 문자열 반환
   */
  private getStanceFromValue(value: number): 'allied' | 'friendly' | 'neutral' | 'hostile' | 'enemy' {
    if (value <= -80) return 'enemy';
    if (value <= -40) return 'hostile';
    if (value <= 40) return 'neutral';
    if (value <= 80) return 'friendly';
    return 'allied';
  }

  /**
   * 세력 영향력 업데이트
   * Faction 모델의 data.influenceOn에 저장
   */
  private async updateFactionInfluence(
    sessionId: string,
    sourceFactionId: string,
    targetFactionId: string,
    influence: number
  ): Promise<void> {
    try {
      const faction = await Faction.findOne({ sessionId, factionId: sourceFactionId });
      if (faction) {
        if (!faction.data) faction.data = {};
        if (!faction.data.influenceOn) faction.data.influenceOn = {};
        
        const currentInfluence = faction.data.influenceOn[targetFactionId] || 0;
        faction.data.influenceOn[targetFactionId] = currentInfluence + influence;
        await faction.save();
      }

      logger.info(`[DiplomacyCommandService] Influence updated: ${sourceFactionId} on ${targetFactionId}, +${influence}`);
    } catch (error) {
      logger.error('[DiplomacyCommandService] Failed to update faction influence:', error);
    }
  }

  /**
   * 페잔 외교 특수 처리
   */
  private async handleFezzanDiplomacy(
    sessionId: string,
    diplomat: IGin7Character,
    action: CmdDiplomaticAction,
    params?: Record<string, any>
  ): Promise<string> {
    const factionId = diplomat.factionId || diplomat.faction;
    
    // 페잔과의 외교는 특수 효과
    switch (action) {
      case 'TRADE':
        return ' (페잔 무역 협정 효과 적용)';
      case 'INFORMATION_EXCHANGE':
        return ' (페잔 정보 브로커 이용 가능)';
      case 'REQUEST_AID':
        return ' (페잔 금융 서비스 이용 가능)';
      case 'OFFER_AID':
        // 원조금 지급 시 국고에서 차감
        if (params?.aidAmount && factionId) {
          const aidAmount = Number(params.aidAmount);
          if (aidAmount > 0) {
            const expenseResult = await BudgetService.processExpense(
              sessionId,
              factionId,
              {
                category: 'diplomacy',
                amount: aidAmount,
                description: `페잔 원조금 지급`,
                authorizedBy: diplomat.characterId,
              },
              params.gameDay || 0
            );
            if (expenseResult.success) {
              logger.info(`[DiplomacyCommandService] Aid payment to Fezzan: ${aidAmount} from ${factionId}`);
              return ` (${aidAmount.toLocaleString()} 크레딧 원조금 지급)`;
            } else {
              logger.warn(`[DiplomacyCommandService] Aid payment failed: ${expenseResult.error}`);
              return ` (원조금 지급 실패: ${expenseResult.error})`;
            }
          }
        }
        return '';
      default:
        return '';
    }
  }

  /**
   * 기존 조약 확인
   * DiplomacyService를 통해 확인
   */
  private async checkExistingTreaty(
    sessionId: string,
    faction1: string,
    faction2: string,
    treatyType: CmdTreatyType
  ): Promise<boolean> {
    try {
      const diplomacyService = DiplomacyService.getInstance();
      const treaties = diplomacyService.getTreaties(sessionId, faction1);
      
      // CmdTreatyType을 DiplomacyService의 TreatyType으로 매핑
      const typeMapping: Record<CmdTreatyType, TreatyType | null> = {
        'NON_AGGRESSION': TreatyType.NON_AGGRESSION,
        'TRADE_AGREEMENT': TreatyType.TRADE,
        'MILITARY_ALLIANCE': TreatyType.ALLIANCE,
        'PASSAGE_RIGHTS': null, // 별도 처리 필요
        'CEASEFIRE': TreatyType.CEASEFIRE,
        'PEACE_TREATY': null,
        'TRIBUTE': TreatyType.TRIBUTE,
        'VASSALAGE': null,
      };

      const mappedType = typeMapping[treatyType];
      if (!mappedType) return false;

      return treaties.some(t => 
        t.type === mappedType && 
        t.parties.includes(faction2) && 
        t.isActive
      );
    } catch (error) {
      logger.error('[DiplomacyCommandService] Error checking existing treaty:', error);
      return false;
    }
  }

  /**
   * 기존 전쟁 확인
   * DiplomacyService와 Faction 모델에서 확인
   */
  private async checkExistingWar(
    sessionId: string,
    faction1: string,
    faction2: string
  ): Promise<boolean> {
    try {
      // 1. DiplomacyService에서 확인
      const diplomacyService = DiplomacyService.getInstance();
      const status = diplomacyService.getDiplomaticStatus(sessionId, faction1, faction2);
      if (status === DiplomaticStatus.AT_WAR) {
        return true;
      }

      // 2. Faction 모델에서도 확인
      const faction = await Faction.findOne({ sessionId, factionId: faction1 });
      if (faction) {
        const relation = faction.relations.find(r => r.targetFactionId === faction2);
        if (relation && relation.stance === 'enemy') {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[DiplomacyCommandService] Error checking existing war:', error);
      return false;
    }
  }

  /**
   * 동맹 관계 확인
   */
  private async checkAlliance(
    sessionId: string,
    faction1: string,
    faction2: string
  ): Promise<boolean> {
    try {
      // 1. DiplomacyService에서 확인
      const diplomacyService = DiplomacyService.getInstance();
      const status = diplomacyService.getDiplomaticStatus(sessionId, faction1, faction2);
      if (status === DiplomaticStatus.ALLIED) {
        return true;
      }

      // 2. 동맹 조약이 있는지 확인
      const treaties = diplomacyService.getTreaties(sessionId, faction1);
      return treaties.some(t => 
        t.type === TreatyType.ALLIANCE && 
        t.parties.includes(faction2) && 
        t.isActive
      );
    } catch (error) {
      logger.error('[DiplomacyCommandService] Error checking alliance:', error);
      return false;
    }
  }

  /**
   * 모든 조약 파기
   * DiplomacyService를 통해 처리
   */
  private async terminateAllTreaties(
    sessionId: string,
    faction1: string,
    faction2: string
  ): Promise<void> {
    try {
      const diplomacyService = DiplomacyService.getInstance();
      const treaties = diplomacyService.getTreaties(sessionId, faction1);

      for (const treaty of treaties) {
        if (treaty.parties.includes(faction2) && treaty.isActive) {
          await diplomacyService.breakTreaty(
            sessionId,
            treaty.treatyId,
            faction1,
            '전쟁 선포로 인한 자동 파기'
          );
        }
      }

      logger.info(`[DiplomacyCommandService] All treaties terminated between ${faction1} and ${faction2}`);
    } catch (error) {
      logger.error('[DiplomacyCommandService] Error terminating treaties:', error);
    }
  }

  /**
   * 조약 조건 생성
   */
  private createTreatyTerms(type: CmdTreatyType, params?: Record<string, any>): CmdTreatyTerms {
    const baseTerms: CmdTreatyTerms = {
      duration: params?.duration || 365, // 기본 1년
      otherTerms: params?.otherTerms || [],
    };

    switch (type) {
      case 'TRADE_AGREEMENT':
        baseTerms.tradeTariff = params?.tariff || 5;
        break;
      case 'PASSAGE_RIGHTS':
        baseTerms.passageConditions = params?.conditions || ['military_passage_allowed'];
        break;
      case 'TRIBUTE':
        baseTerms.tribute = {
          from: params?.tributeFrom || '',
          to: params?.tributeTo || '',
          amount: params?.tributeAmount || 10000,
          interval: params?.tributeInterval || 'monthly',
        };
        break;
      case 'MILITARY_ALLIANCE':
        baseTerms.militarySupport = true;
        break;
    }

    return baseTerms;
  }

  /**
   * 세력 표시명 조회
   */
  private getFactionDisplayName(factionId: string): string {
    const names: Record<string, string> = {
      'galactic_empire': '은하제국',
      'free_planets_alliance': '자유행성동맹',
      'fezzan': '페잔 자치령',
      'phezzan': '페잔 자치령',
    };
    return names[factionId.toLowerCase()] || factionId;
  }

  /**
   * 조약 유형 표시명
   */
  private getTreatyDisplayName(type: CmdTreatyType): string {
    const names: Record<CmdTreatyType, string> = {
      'NON_AGGRESSION': '불가침 조약',
      'TRADE_AGREEMENT': '무역 협정',
      'MILITARY_ALLIANCE': '군사 동맹',
      'PASSAGE_RIGHTS': '통행권 협정',
      'CEASEFIRE': '휴전 협정',
      'PEACE_TREATY': '평화 조약',
      'TRIBUTE': '조공 조약',
      'VASSALAGE': '속국 조약',
    };
    return names[type] || type;
  }

  /**
   * 영향력 유형 표시명
   */
  private getInfluenceTypeDisplayName(type: string): string {
    const names: Record<string, string> = {
      'diplomatic': '외교적',
      'economic': '경제적',
      'military': '군사적',
    };
    return names[type] || type;
  }
}

export const diplomacyCommandService = DiplomacyCommandService.getInstance();
export default DiplomacyCommandService;

