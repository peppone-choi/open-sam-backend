/**
 * RebellionService - 귀족반란 시스템 서비스
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 주요 기능:
 * - 귀족 반란 선언 (봉토+사병 기반)
 * - 연합 형성 (다수 귀족 참여)
 * - 내전 트리거 연동
 *
 * 원작 예시: 립슈타트 전역 (브라운슈바이크/리텐하임 연합 vs 라인하르트)
 */

import { EventEmitter } from 'events';
import { Gin7Character } from '../../models/gin7/Character';
import { Fleet } from '../../models/logh/Fleet.model';
import { Planet } from '../../models/logh/Planet.model';
import { logger } from '../../common/logger';
import {
  CivilWarTriggerType,
  LegitimacyClaim,
} from '../../constants/gin7/civil_war_definitions';

// 순환 참조 방지
let civilWarServiceInstance: any = null;
const getCivilWarService = async () => {
  if (!civilWarServiceInstance) {
    const { civilWarService } = await import('./CivilWarService');
    civilWarServiceInstance = civilWarService;
  }
  return civilWarServiceInstance;
};

/**
 * 반란 명분 타입
 */
export enum RebellionCause {
  SUCCESSION = 'SUCCESSION', // 계승권 분쟁 (황위 계승)
  TYRANNY = 'TYRANNY', // 폭정에 대한 저항
  RESTORATION = 'RESTORATION', // 구체제 복구 (골든바움 복고)
  AUTONOMY = 'AUTONOMY', // 자치권 요구
  REFORM = 'REFORM', // 개혁 요구
}

/**
 * 반란 상태
 */
export enum RebellionStatus {
  PLOTTING = 'PLOTTING', // 모의 중
  RECRUITING = 'RECRUITING', // 동조자 모집 중
  DECLARED = 'DECLARED', // 반란 선언됨
  ACTIVE = 'ACTIVE', // 내전 진행 중
  RESOLVED = 'RESOLVED', // 종결됨
}

/**
 * 반란 참가자 인터페이스
 */
export interface RebellionParticipant {
  characterId: string;
  name: string;
  nobilityTitle?: string; // 작위
  fiefdoms: string[]; // 봉토 목록
  fleetIds: string[]; // 사병/함대
  joinedAt: Date;
  role: 'LEADER' | 'CO_LEADER' | 'SUPPORTER';
}

/**
 * 반란 인터페이스
 */
export interface Rebellion {
  rebellionId: string;
  sessionId: string;
  status: RebellionStatus;

  // 기본 정보
  name: string; // '립슈타트 연합', '귀족 연합' 등
  cause: RebellionCause;
  manifesto?: string; // 선언문/명분

  // 지도부
  leaderCharacterId: string;
  leaderName: string;
  coLeaderIds: string[]; // 공동 지도자

  // 참가자
  participants: RebellionParticipant[];

  // 전력
  totalFiefdoms: string[]; // 모든 참여 봉토
  totalFleetIds: string[]; // 모든 참여 함대
  fortressIds: string[]; // 장악한 요새

  // 정당성
  legitimacyClaim: LegitimacyClaim;
  legitimacyScore: number;

  // 타임스탬프
  plottedAt: Date;
  declaredAt?: Date;
  resolvedAt?: Date;

  // 결과
  result?: 'VICTORY' | 'DEFEAT' | 'NEGOTIATED';
  civilWarId?: string;
}

/**
 * 반란 생성 요청
 */
export interface CreateRebellionRequest {
  sessionId: string;
  leaderCharacterId: string;
  name: string;
  cause: RebellionCause;
  manifesto?: string;
}

/**
 * 반란 결과
 */
export interface RebellionResult {
  success: boolean;
  error?: string;
  rebellion?: Rebellion;
  cpCost?: number;
}

/**
 * 반란 조건 상수
 */
const REBELLION_CONDITIONS = {
  MIN_NOBILITY_RANK: 2, // 최소 남작 이상
  MIN_PARTICIPANTS_TO_DECLARE: 2, // 선언에 필요한 최소 참가자
  MIN_FLEETS_TO_DECLARE: 3, // 선언에 필요한 최소 함대 수
  CP_COST_INITIATE: 640, // 모의 시작 CP
  CP_COST_RECRUIT: 160, // 모집 CP
  CP_COST_DECLARE: 640, // 선언 CP
};

/**
 * RebellionService 클래스
 */
export class RebellionService extends EventEmitter {
  private static instance: RebellionService;

  // 메모리 내 저장소
  private rebellions: Map<string, Rebellion> = new Map();
  // 캐릭터별 반란 참여 현황
  private characterRebellions: Map<string, string> = new Map();

  private constructor() {
    super();
    logger.info('[RebellionService] Initialized');
  }

  public static getInstance(): RebellionService {
    if (!RebellionService.instance) {
      RebellionService.instance = new RebellionService();
    }
    return RebellionService.instance;
  }

  /**
   * 반란 모의 시작
   */
  public async initiateRebellion(request: CreateRebellionRequest): Promise<RebellionResult> {
    try {
      const { sessionId, leaderCharacterId, name, cause, manifesto } = request;

      // 지도자 확인
      const leader = await Gin7Character.findOne({ sessionId, characterId: leaderCharacterId });
      if (!leader) {
        return { success: false, error: '지도자를 찾을 수 없습니다.' };
      }

      // 작위 확인 (제국군 전용, 남작 이상)
      const nobilityTitle = (leader as any).nobilityTitle;
      if (!nobilityTitle) {
        return { success: false, error: '작위가 없는 인물은 반란을 일으킬 수 없습니다.' };
      }

      // 봉토 확인
      const fiefdoms = (leader as any).nobilityTitle?.fiefdoms || [];
      if (fiefdoms.length === 0) {
        return { success: false, error: '봉토가 없으면 반란을 일으킬 수 없습니다.' };
      }

      // 이미 참여 중인 반란 확인
      if (this.characterRebellions.has(leaderCharacterId)) {
        return { success: false, error: '이미 다른 반란에 참여 중입니다.' };
      }

      const rebellionId = `REB-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date();

      // 정당성 클레임 결정
      const legitimacyClaim = this.determineLegitimacyClaim(cause);

      // 지도자의 함대 조회
      const leaderFleets = await Fleet.find({ 
        session_id: sessionId, 
        commanderId: leaderCharacterId 
      }).select('fleetId');
      const leaderFleetIds = leaderFleets.map(f => f.fleetId);

      const rebellion: Rebellion = {
        rebellionId,
        sessionId,
        status: RebellionStatus.PLOTTING,
        name,
        cause,
        manifesto,
        leaderCharacterId,
        leaderName: leader.name,
        coLeaderIds: [],
        participants: [
          {
            characterId: leaderCharacterId,
            name: leader.name,
            nobilityTitle: nobilityTitle?.id,
            fiefdoms,
            fleetIds: leaderFleetIds,
            joinedAt: now,
            role: 'LEADER',
          },
        ],
        totalFiefdoms: fiefdoms,
        totalFleetIds: [...leaderFleetIds], // 지도자의 함대 추가
        fortressIds: [],
        legitimacyClaim,
        legitimacyScore: this.calculateInitialLegitimacy(cause, fiefdoms.length),
        plottedAt: now,
      };

      this.rebellions.set(rebellionId, rebellion);
      this.characterRebellions.set(leaderCharacterId, rebellionId);

      this.emit('REBELLION_INITIATED', {
        sessionId,
        rebellionId,
        leaderCharacterId,
        name,
        cause,
      });

      logger.info(`[RebellionService] Rebellion initiated: ${rebellionId} by ${leader.name}`);

      return {
        success: true,
        rebellion,
        cpCost: REBELLION_CONDITIONS.CP_COST_INITIATE,
      };
    } catch (error: any) {
      logger.error(`[RebellionService] Error initiating rebellion: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 동조자 모집 (다른 귀족 참여)
   */
  public async recruitParticipant(
    sessionId: string,
    rebellionId: string,
    recruiterId: string,
    targetId: string,
  ): Promise<RebellionResult> {
    try {
      const rebellion = this.rebellions.get(rebellionId);
      if (!rebellion || rebellion.sessionId !== sessionId) {
        return { success: false, error: '반란을 찾을 수 없습니다.' };
      }

      if (rebellion.status !== RebellionStatus.PLOTTING &&
          rebellion.status !== RebellionStatus.RECRUITING) {
        return { success: false, error: '더 이상 참가자를 모집할 수 없는 상태입니다.' };
      }

      // 모집자 확인
      const isRecruiterParticipant = rebellion.participants.some(
        p => p.characterId === recruiterId
      );
      if (!isRecruiterParticipant) {
        return { success: false, error: '반란 참가자만 모집할 수 있습니다.' };
      }

      // 대상 확인
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return { success: false, error: '대상을 찾을 수 없습니다.' };
      }

      // 이미 참여 중인지 확인
      if (this.characterRebellions.has(targetId)) {
        return { success: false, error: '대상이 이미 다른 반란에 참여 중입니다.' };
      }

      // 작위 확인
      const targetNobility = (target as any).nobilityTitle;
      if (!targetNobility) {
        return { success: false, error: '작위가 없는 인물은 반란에 참여할 수 없습니다.' };
      }

      const targetFiefdoms = targetNobility?.fiefdoms || [];

      // 참가자 추가
      const participantFleets = await Fleet.find({ 
        session_id: sessionId, 
        commanderId: targetId 
      }).select('fleetId');
      
      const participant: RebellionParticipant = {
        characterId: targetId,
        name: target.name,
        nobilityTitle: targetNobility?.id,
        fiefdoms: targetFiefdoms,
        fleetIds: participantFleets.map(f => f.fleetId),
        joinedAt: new Date(),
        role: 'SUPPORTER',
      };

      rebellion.participants.push(participant);
      rebellion.totalFiefdoms.push(...targetFiefdoms);
      rebellion.totalFleetIds.push(...participant.fleetIds); // 참가자의 함대 추가
      rebellion.status = RebellionStatus.RECRUITING;

      this.characterRebellions.set(targetId, rebellionId);

      // 정당성 재계산
      rebellion.legitimacyScore = this.calculateLegitimacyWithParticipants(rebellion);

      this.emit('PARTICIPANT_RECRUITED', {
        sessionId,
        rebellionId,
        recruiterId,
        targetId,
        participantCount: rebellion.participants.length,
      });

      logger.info(`[RebellionService] Participant recruited: ${target.name} joined ${rebellionId}`);

      return {
        success: true,
        rebellion,
        cpCost: REBELLION_CONDITIONS.CP_COST_RECRUIT,
      };
    } catch (error: any) {
      logger.error(`[RebellionService] Error recruiting participant: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 공동 지도자 지정
   */
  public async designateCoLeader(
    sessionId: string,
    rebellionId: string,
    leaderId: string,
    coLeaderId: string,
  ): Promise<boolean> {
    const rebellion = this.rebellions.get(rebellionId);
    if (!rebellion || rebellion.sessionId !== sessionId) {
      return false;
    }

    if (rebellion.leaderCharacterId !== leaderId) {
      return false;
    }

    const participant = rebellion.participants.find(p => p.characterId === coLeaderId);
    if (!participant) {
      return false;
    }

    participant.role = 'CO_LEADER';
    rebellion.coLeaderIds.push(coLeaderId);

    logger.info(`[RebellionService] Co-leader designated: ${coLeaderId} in ${rebellionId}`);

    return true;
  }

  /**
   * 반란 선언 (봉기)
   */
  public async declareRebellion(
    sessionId: string,
    rebellionId: string,
    leaderId: string,
  ): Promise<RebellionResult> {
    try {
      const rebellion = this.rebellions.get(rebellionId);
      if (!rebellion || rebellion.sessionId !== sessionId) {
        return { success: false, error: '반란을 찾을 수 없습니다.' };
      }

      if (rebellion.leaderCharacterId !== leaderId) {
        return { success: false, error: '지도자만 반란을 선언할 수 있습니다.' };
      }

      if (rebellion.status !== RebellionStatus.PLOTTING &&
          rebellion.status !== RebellionStatus.RECRUITING) {
        return { success: false, error: '선언할 수 없는 상태입니다.' };
      }

      // 조건 확인
      if (rebellion.participants.length < REBELLION_CONDITIONS.MIN_PARTICIPANTS_TO_DECLARE) {
        return {
          success: false,
          error: `최소 ${REBELLION_CONDITIONS.MIN_PARTICIPANTS_TO_DECLARE}명의 참가자가 필요합니다.`,
        };
      }

      rebellion.status = RebellionStatus.DECLARED;
      rebellion.declaredAt = new Date();

      this.emit('REBELLION_DECLARED', {
        sessionId,
        rebellionId,
        leaderCharacterId: leaderId,
        name: rebellion.name,
        participantCount: rebellion.participants.length,
        totalFiefdoms: rebellion.totalFiefdoms.length,
      });

      // 내전 트리거
      await this.triggerCivilWar(rebellion);

      logger.info(`[RebellionService] Rebellion declared: ${rebellionId} (${rebellion.name})`);

      return {
        success: true,
        rebellion,
        cpCost: REBELLION_CONDITIONS.CP_COST_DECLARE,
      };
    } catch (error: any) {
      logger.error(`[RebellionService] Error declaring rebellion: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 내전 트리거
   */
  private async triggerCivilWar(rebellion: Rebellion): Promise<void> {
    try {
      const civilWarService = await getCivilWarService();

      // 봉토에서 실제 행성 ID 조회
      const rebelPlanetIds = await this.findPlanetsByFiefdoms(
        rebellion.sessionId,
        rebellion.totalFiefdoms,
      );

      // 반란 세력 요새 조회
      const rebelFortressIds = await this.findRebelFortresses(
        rebellion.sessionId,
        rebelPlanetIds,
      );
      rebellion.fortressIds = rebelFortressIds;

      // 정부/황제 측 세력 조회
      const loyalistForces = await this.findLoyalistForces(rebellion.sessionId, rebellion);

      const warName = `${rebellion.name} 전역`;

      // 로깅: 내전 진영 구성 정보
      logger.info(`[RebellionService] Triggering civil war: ${warName}`);
      logger.info(`[RebellionService] Insurgent forces:`);
      logger.info(`  - Leader: ${rebellion.leaderName} (${rebellion.leaderCharacterId})`);
      logger.info(`  - Participants: ${rebellion.participants.length}`);
      logger.info(`  - Planets: ${rebelPlanetIds.length} (${rebelPlanetIds.join(', ')})`);
      logger.info(`  - Fortresses: ${rebelFortressIds.length} (${rebelFortressIds.join(', ')})`);
      logger.info(`  - Fleets: ${rebellion.totalFleetIds.length} (${rebellion.totalFleetIds.join(', ')})`);
      logger.info(`[RebellionService] Loyalist forces:`);
      logger.info(`  - Leader: ${loyalistForces.leaderId}`);
      logger.info(`  - Characters: ${loyalistForces.characterIds.length}`);
      logger.info(`  - Planets: ${loyalistForces.planetIds.length}`);
      logger.info(`  - Fleets: ${loyalistForces.fleetIds.length}`);

      const civilWar = await civilWarService.createCivilWar({
        sessionId: rebellion.sessionId,
        name: warName,
        originFaction: 'IMPERIAL' as const,
        trigger: {
          type: CivilWarTriggerType.REBELLION,
          triggerId: rebellion.rebellionId,
          triggerCharacterId: rebellion.leaderCharacterId,
        },
        insurgentFaction: {
          name: rebellion.name,
          leaderCharacterId: rebellion.leaderCharacterId,
          memberCharacterIds: rebellion.participants.map(p => p.characterId),
          controlledPlanetIds: rebelPlanetIds.length > 0 ? rebelPlanetIds : rebellion.totalFiefdoms,
          fleetIds: rebellion.totalFleetIds,
          capitalPlanetId: rebelPlanetIds[0] || rebellion.totalFiefdoms[0] || 'REBEL_BASE',
          legitimacyClaim: rebellion.legitimacyClaim,
        },
        incumbentFaction: {
          name: '황제군',
          leaderCharacterId: loyalistForces.leaderId,
          memberCharacterIds: loyalistForces.characterIds,
          controlledPlanetIds: loyalistForces.planetIds,
          fleetIds: loyalistForces.fleetIds,
          capitalPlanetId: loyalistForces.capitalId,
          legitimacyClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
        },
      });

      rebellion.civilWarId = civilWar.warId;
      rebellion.status = RebellionStatus.ACTIVE;

      logger.info(`[RebellionService] Civil war triggered: ${civilWar.warId}`);
    } catch (error) {
      logger.error(`[RebellionService] Error triggering civil war: ${error}`);
    }
  }

  /**
   * 반란 종결 처리
   */
  public async resolveRebellion(
    sessionId: string,
    rebellionId: string,
    result: 'VICTORY' | 'DEFEAT' | 'NEGOTIATED',
  ): Promise<boolean> {
    const rebellion = this.rebellions.get(rebellionId);
    if (!rebellion || rebellion.sessionId !== sessionId) {
      return false;
    }

    rebellion.status = RebellionStatus.RESOLVED;
    rebellion.result = result;
    rebellion.resolvedAt = new Date();

    // 참가자 반란 참여 기록 해제
    for (const participant of rebellion.participants) {
      this.characterRebellions.delete(participant.characterId);
    }

    this.emit('REBELLION_RESOLVED', {
      sessionId,
      rebellionId,
      result,
      name: rebellion.name,
    });

    logger.info(`[RebellionService] Rebellion resolved: ${rebellionId}, result: ${result}`);

    return true;
  }

  /**
   * 반란 조회
   */
  public getRebellion(rebellionId: string): Rebellion | undefined {
    return this.rebellions.get(rebellionId);
  }

  /**
   * 활성 반란 목록 조회
   */
  public getActiveRebellions(sessionId: string): Rebellion[] {
    return Array.from(this.rebellions.values()).filter(
      r => r.sessionId === sessionId && r.status !== RebellionStatus.RESOLVED
    );
  }

  /**
   * 캐릭터가 참여 중인 반란 조회
   */
  public getCharacterRebellion(characterId: string): Rebellion | undefined {
    const rebellionId = this.characterRebellions.get(characterId);
    if (!rebellionId) return undefined;
    return this.rebellions.get(rebellionId);
  }

  // ==================== Private Helper Methods ====================

  /**
   * 봉토(fiefdom) 목록에서 실제 행성 조회
   * 봉토명이 행성 ID 또는 행성명과 일치하는 행성들을 반환
   */
  private async findPlanetsByFiefdoms(
    sessionId: string,
    fiefdoms: string[],
  ): Promise<string[]> {
    if (fiefdoms.length === 0) {
      return [];
    }

    // 봉토명으로 행성 조회 (planetId 또는 name으로 매칭)
    const planets = await Planet.find({
      session_id: sessionId,
      $or: [
        { planetId: { $in: fiefdoms } },
        { name: { $in: fiefdoms } },
        { nameKo: { $in: fiefdoms } },
        { nameEn: { $in: fiefdoms } },
      ],
    }).select('planetId');

    const foundPlanetIds = planets.map(p => p.planetId);

    logger.info(
      `[RebellionService] Found ${foundPlanetIds.length} planets from ${fiefdoms.length} fiefdoms`,
    );

    return foundPlanetIds;
  }

  /**
   * 반란 세력의 요새 조회
   * 봉토 행성 중 요새인 것들 반환
   */
  private async findRebelFortresses(
    sessionId: string,
    planetIds: string[],
  ): Promise<string[]> {
    if (planetIds.length === 0) {
      return [];
    }

    const fortresses = await Planet.find({
      session_id: sessionId,
      planetId: { $in: planetIds },
      isFortress: true,
    }).select('planetId');

    return fortresses.map(p => p.planetId);
  }

  /**
   * 명분에 따른 정당성 클레임 결정
   */
  private determineLegitimacyClaim(cause: RebellionCause): LegitimacyClaim {
    switch (cause) {
      case RebellionCause.SUCCESSION:
        return LegitimacyClaim.ROYAL_BLOOD;
      case RebellionCause.TYRANNY:
        return LegitimacyClaim.POPULAR_MANDATE;
      case RebellionCause.RESTORATION:
        return LegitimacyClaim.RESTORATION;
      case RebellionCause.AUTONOMY:
        return LegitimacyClaim.AUTONOMY;
      case RebellionCause.REFORM:
        return LegitimacyClaim.REVOLUTIONARY;
      default:
        return LegitimacyClaim.MILITARY_POWER;
    }
  }

  /**
   * 초기 정당성 계산
   */
  private calculateInitialLegitimacy(cause: RebellionCause, fiefdomCount: number): number {
    let base = 30;

    // 명분에 따른 보너스
    switch (cause) {
      case RebellionCause.SUCCESSION:
        base += 20;
        break;
      case RebellionCause.TYRANNY:
        base += 15;
        break;
      case RebellionCause.RESTORATION:
        base += 10;
        break;
    }

    // 봉토 수에 따른 보너스
    base += fiefdomCount * 5;

    return Math.min(100, base);
  }

  /**
   * 참가자 포함 정당성 계산
   */
  private calculateLegitimacyWithParticipants(rebellion: Rebellion): number {
    let base = this.calculateInitialLegitimacy(rebellion.cause, 0);

    // 참가자 수 보너스
    base += rebellion.participants.length * 5;

    // 총 봉토 수 보너스
    base += rebellion.totalFiefdoms.length * 3;

    // 공동 지도자 보너스
    base += rebellion.coLeaderIds.length * 10;

    return Math.min(100, base);
  }

  /**
   * 정부/황제 측 세력 조회
   */
  private async findLoyalistForces(
    sessionId: string,
    rebellion: Rebellion,
  ): Promise<{
    leaderId: string;
    characterIds: string[];
    fleetIds: string[];
    planetIds: string[];
    capitalId: string;
  }> {
    // 반란 참가자 제외한 고위 캐릭터 조회
    const participantIds = rebellion.participants.map(p => p.characterId);

    const loyalists = await Gin7Character.find({
      sessionId,
      characterId: { $nin: participantIds },
    }).sort({ 'currentRank.tier': -1 }).limit(20);

    if (loyalists.length === 0) {
      // 황제(또는 국가원수)의 수도 확인
      const capital = await Planet.findOne({ 
        session_id: sessionId, 
        isCapital: true, 
        owner: 'empire' 
      }) || { planetId: 'ODIN' };

      return {
        leaderId: 'EMPEROR',
        characterIds: [],
        fleetIds: [],
        planetIds: [capital.planetId], // 수도
        capitalId: capital.planetId,
      };
    }

    const leaderId = loyalists[0].characterId;
    
    // 충성파 함대 조회
    const loyalistFleets = await Fleet.find({
      session_id: sessionId,
      commanderId: { $in: loyalists.map(c => c.characterId) }
    }).select('fleetId');

    // 수도 조회
    const capital = await Planet.findOne({ 
      session_id: sessionId, 
      isCapital: true, 
      owner: 'empire' 
    });
    
    // 충성파 보유 행성 조회 (여기서는 단순히 수도만 포함하지만 확장 가능)
    const loyalistPlanetIds = capital ? [capital.planetId] : ['ODIN'];

    return {
      leaderId,
      characterIds: loyalists.map(c => c.characterId),
      fleetIds: loyalistFleets.map(f => f.fleetId),
      planetIds: loyalistPlanetIds,
      capitalId: capital?.planetId || 'ODIN',
    };
  }
}

export const rebellionService = RebellionService.getInstance();
export default RebellionService;

