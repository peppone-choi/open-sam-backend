/**
 * CivilWarService - 내전 시스템 서비스
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 주요 기능:
 * - 내전 생성/관리 (쿠데타, 분리독립, 귀족반란 트리거)
 * - 다중 진영 관리
 * - 정당성 시스템
 * - 내전 전투 처리
 * - 내전 종결 및 전후 처리
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet } from '../../models/logh/Fleet.model';
import { Planet } from '../../models/logh/Planet.model';
import { Faction } from '../../models/gin7/Faction';
import { logger } from '../../common/logger';
import {
  CivilWarTriggerType,
  CivilWarStatus,
  CivilWarResolution,
  LegitimacyClaim,
  FactionRelation,
  FactionRole,
  TRIGGER_CONFIGS,
  calculateLegitimacy,
  DEFAULT_VICTORY_CONDITIONS,
  VictoryCondition,
  CIVIL_WAR_MERIT_MULTIPLIER,
} from '../../constants/gin7/civil_war_definitions';

// 순환 참조 방지를 위해 동적 import 사용
let coupServiceInstance: any = null;
const getCoupService = async () => {
  if (!coupServiceInstance) {
    const { coupService } = await import('./CoupService');
    coupServiceInstance = coupService;
  }
  return coupServiceInstance;
};

/**
 * 내전 진영 인터페이스
 */
export interface CivilWarFaction {
  factionId: string;
  name: string;
  role: FactionRole;

  // 정당성
  legitimacyClaim: LegitimacyClaim;
  legitimacyScore: number;

  // 지도부
  leaderCharacterId: string;
  leaderName: string;
  memberCharacterIds: string[];

  // 영토/전력
  controlledPlanetIds: string[];
  controlledFortressIds: string[];
  fleetIds: string[];
  capitalPlanetId: string; // 본거지

  // 외교
  relations: Map<string, FactionRelation>;

  // 전력 통계
  totalShips: number;
  totalTroops: number;
  initialStrength: number; // 내전 시작 시 전력 (궤멸률 계산용)

  // 상태
  isDefeated: boolean;
  hasSurrendered: boolean;
}

/**
 * 내전 인터페이스
 */
export interface CivilWar {
  warId: string;
  sessionId: string;

  // 기본 정보
  name: string; // '립슈타트 전역', '구국군사회의 난' 등
  originFaction: 'IMPERIAL' | 'ALLIANCE';

  // 트리거 정보
  trigger: {
    type: CivilWarTriggerType;
    triggerId: string; // 원본 쿠데타/반란 ID
    triggerCharacterId: string; // 발발 주도자
  };

  // 진영들
  factions: Map<string, CivilWarFaction>;

  // 상태
  status: CivilWarStatus;
  startedAt: Date;
  endedAt?: Date;

  // 종결
  resolution?: CivilWarResolution;
  winnerId?: string; // 승리 진영 ID
  victoryConditionMet?: VictoryCondition;

  // 전투 기록
  battleIds: string[];
  totalCasualties: {
    ships: number;
    troops: number;
    characters: number;
  };
}

/**
 * 내전 생성 요청
 */
export interface CreateCivilWarRequest {
  sessionId: string;
  name: string;
  originFaction: 'IMPERIAL' | 'ALLIANCE';
  trigger: {
    type: CivilWarTriggerType;
    triggerId: string;
    triggerCharacterId: string;
  };
  insurgentFaction: {
    name: string;
    leaderCharacterId: string;
    memberCharacterIds: string[];
    controlledPlanetIds: string[];
    fleetIds: string[];
    capitalPlanetId: string;
    legitimacyClaim: LegitimacyClaim;
  };
  incumbentFaction: {
    name: string;
    leaderCharacterId: string;
    memberCharacterIds: string[];
    controlledPlanetIds: string[];
    fleetIds: string[];
    capitalPlanetId: string;
    legitimacyClaim: LegitimacyClaim;
  };
}

/**
 * 제3세력 추가 요청
 */
export interface AddThirdPartyRequest {
  warId: string;
  name: string;
  leaderCharacterId: string;
  memberCharacterIds: string[];
  controlledPlanetIds: string[];
  fleetIds: string[];
  capitalPlanetId: string;
  legitimacyClaim: LegitimacyClaim;
  initialRelations: Array<{ factionId: string; relation: FactionRelation }>;
}

/**
 * CivilWarService 클래스
 */
export class CivilWarService extends EventEmitter {
  private static instance: CivilWarService;

  // 메모리 내 저장소 (실제로는 MongoDB 사용)
  private civilWars: Map<string, CivilWar> = new Map();

  private constructor() {
    super();
    logger.info('[CivilWarService] Initialized');
    
    // 쿠데타 성공 이벤트 구독 (내전 자동 발생)
    this.subscribeToTriggerEvents();
  }

  /**
   * 트리거 이벤트 구독 (쿠데타, 분리독립 등)
   */
  private async subscribeToTriggerEvents(): Promise<void> {
    try {
      const coupService = await getCoupService();
      
      // 쿠데타 성공 시 내전 발생
      coupService.on('COUP_SUCCESS', async (event: {
        sessionId: string;
        coupId: string;
        mastermindId: string;
        targetPlanetId: string;
      }) => {
        await this.handleCoupSuccess(event);
      });

      // 쿠데타 전투 시작 시에도 내전 발생
      coupService.on('COUP_BATTLE_STARTED', async (event: {
        sessionId: string;
        coupId: string;
        mastermindId: string;
        targetPlanetId: string;
      }) => {
        await this.handleCoupBattle(event);
      });

      logger.info('[CivilWarService] Subscribed to CoupService events');
    } catch (error) {
      logger.warn('[CivilWarService] Failed to subscribe to CoupService events (may not be initialized yet)');
    }
  }

  /**
   * 쿠데타 성공 시 내전 처리
   * 수도를 장악했지만 반대파가 남아있으면 내전 발생
   */
  private async handleCoupSuccess(event: {
    sessionId: string;
    coupId: string;
    mastermindId: string;
    targetPlanetId: string;
  }): Promise<void> {
    const { sessionId, coupId, mastermindId, targetPlanetId } = event;

    try {
      // 쿠데타 정보 조회
      const coupService = await getCoupService();
      const coup = coupService.getCoup(coupId);
      
      if (!coup) {
        logger.warn(`[CivilWarService] Coup ${coupId} not found`);
        return;
      }

      // 쿠데타 참가자 ID 목록 추출
      const coupParticipantIds: string[] = coup.participants.map((p: any) => p.characterId);
      
      logger.info(`[CivilWarService] Coup ${coupId} has ${coupParticipantIds.length} participants`);

      // 반대파(정부군) 존재 여부 확인 (쿠데타 참가자 제외)
      const loyalistForces = await this.findLoyalistForces(
        sessionId, 
        mastermindId,
        coupParticipantIds,
      );
      
      if (loyalistForces.fleetIds.length === 0 && loyalistForces.planetIds.length === 0) {
        // 반대파 없음 - 완전 승리
        logger.info(`[CivilWarService] Coup ${coupId} - No opposition, complete victory`);
        return;
      }

      // 쿠데타 참가자 함대 조회
      const coupFleets = await Fleet.find({
        session_id: sessionId,
        commanderId: { $in: coupParticipantIds },
      }).select('fleetId');
      const coupFleetIds = coupFleets.map(f => f.fleetId);

      // 내전 생성
      const mastermind = await Gin7Character.findOne({ sessionId, characterId: mastermindId });
      const faction = (mastermind as any)?.faction || 'ALLIANCE';

      const insurgentName = faction === 'IMPERIAL' 
        ? `반란군 (${mastermind?.name || '수괴'})` 
        : `쿠데타군 (${mastermind?.name || '수괴'})`;

      const incumbentLeaderId = loyalistForces.leaderId || 'SYSTEM_LOYALIST';
      const incumbentLeader = await Gin7Character.findOne({ sessionId, characterId: incumbentLeaderId });
      const incumbentName = faction === 'IMPERIAL' 
        ? '황제군' 
        : `정부군 (${incumbentLeader?.name || '정부'})`;

      // 로깅: 내전 진영 구성 정보
      logger.info(`[CivilWarService] Creating civil war from coup ${coupId}`);
      logger.info(`[CivilWarService] Insurgent (Coup) forces:`);
      logger.info(`  - Leader: ${mastermind?.name || mastermindId}`);
      logger.info(`  - Participants: ${coupParticipantIds.length}`);
      logger.info(`  - Fleets: ${coupFleetIds.length}`);
      logger.info(`[CivilWarService] Loyalist forces:`);
      logger.info(`  - Leader: ${incumbentLeader?.name || incumbentLeaderId}`);
      logger.info(`  - Characters: ${loyalistForces.characterIds.length}`);
      logger.info(`  - Fleets: ${loyalistForces.fleetIds.length}`);
      logger.info(`  - Planets: ${loyalistForces.planetIds.length}`);

      const civilWar = await this.createCivilWar({
        sessionId,
        name: faction === 'IMPERIAL' ? '내전' : '구국전쟁',
        originFaction: faction as 'IMPERIAL' | 'ALLIANCE',
        trigger: {
          type: CivilWarTriggerType.COUP,
          triggerId: coupId,
          triggerCharacterId: mastermindId,
        },
        insurgentFaction: {
          name: insurgentName,
          leaderCharacterId: mastermindId,
          memberCharacterIds: coupParticipantIds,
          controlledPlanetIds: [targetPlanetId], // 수도만 장악
          fleetIds: coupFleetIds, // 실제 쿠데타 참가자 함대
          capitalPlanetId: targetPlanetId,
          legitimacyClaim: LegitimacyClaim.MILITARY_POWER,
        },
        incumbentFaction: {
          name: incumbentName,
          leaderCharacterId: incumbentLeaderId,
          memberCharacterIds: loyalistForces.characterIds,
          controlledPlanetIds: loyalistForces.planetIds,
          fleetIds: loyalistForces.fleetIds,
          capitalPlanetId: loyalistForces.planetIds[0] || targetPlanetId,
          legitimacyClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
        },
      });

      logger.info(`[CivilWarService] Civil war started from coup: ${civilWar.warId}`);
    } catch (error) {
      logger.error(`[CivilWarService] Error handling coup success: ${error}`);
    }
  }

  /**
   * 쿠데타 전투 시작 시 내전 처리
   */
  private async handleCoupBattle(event: {
    sessionId: string;
    coupId: string;
    mastermindId: string;
    targetPlanetId: string;
  }): Promise<void> {
    // 쿠데타가 즉시 성공하지 못했을 때 (전투 발생)
    // 이 경우도 내전으로 처리
    await this.handleCoupSuccess(event);
  }

  /**
   * 충성파 세력 탐색
   * @param sessionId - 세션 ID
   * @param excludeCharacterId - 제외할 주동자 ID
   * @param coupParticipantIds - 쿠데타 참가자 ID 목록 (제외 대상)
   */
  private async findLoyalistForces(
    sessionId: string,
    excludeCharacterId: string,
    coupParticipantIds: string[] = [],
  ): Promise<{
    leaderId: string;
    characterIds: string[];
    fleetIds: string[];
    planetIds: string[];
  }> {
    // 쿠데타 참가자 + 주동자를 제외할 ID 목록으로 합침
    const excludeIds = [excludeCharacterId, ...coupParticipantIds];

    // 높은 계급의 충성파 캐릭터 찾기 (쿠데타 참가자 제외)
    const loyalists = await Gin7Character.find({
      sessionId,
      characterId: { $nin: excludeIds },
    }).sort({ 'currentRank.tier': -1 }).limit(20);

    if (loyalists.length === 0) {
      return { leaderId: '', characterIds: [], fleetIds: [], planetIds: [] };
    }

    const loyalistIds = loyalists.map(c => c.characterId);
    
    logger.info(
      `[CivilWarService] Found ${loyalistIds.length} loyalists (excluded ${excludeIds.length} coup participants)`,
    );
    
    // 충성파 함대 조회 (쿠데타 참가자 함대 제외)
    const fleets = await Fleet.find({
      session_id: sessionId,
      commanderId: { $in: loyalistIds },
    }).select('fleetId');

    // 쿠데타 참가자 함대 ID 조회 (충성파에서 제외 확인용)
    const coupFleets = await Fleet.find({
      session_id: sessionId,
      commanderId: { $in: coupParticipantIds },
    }).select('fleetId');

    const coupFleetIds = coupFleets.map(f => f.fleetId);
    const loyalistFleetIds = fleets
      .map(f => f.fleetId)
      .filter(id => !coupFleetIds.includes(id));

    logger.info(
      `[CivilWarService] Loyalist fleets: ${loyalistFleetIds.length}, Coup fleets excluded: ${coupFleetIds.length}`,
    );

    // 충성파 거점(수도 등) 조회
    const leader = loyalists[0];
    const faction = (leader as any).faction || 'empire';
    
    // 수도 조회
    const capital = await Planet.findOne({
      session_id: sessionId,
      owner: faction,
      isCapital: true,
    });

    // 충성파 지배 행성 조회 (쿠데타 참가자 봉토 제외)
    // 기본적으로 수도 + 주요 행성들
    const loyalistPlanets = await Planet.find({
      session_id: sessionId,
      owner: faction,
      strategicValue: { $in: ['critical', 'high'] },
    }).select('planetId').limit(10);

    const planetIds = [
      ...(capital ? [capital.planetId] : []),
      ...loyalistPlanets.map(p => p.planetId),
    ];

    // 중복 제거
    const uniquePlanetIds = [...new Set(planetIds)];

    return {
      leaderId: leader.characterId,
      characterIds: loyalistIds,
      fleetIds: loyalistFleetIds,
      planetIds: uniquePlanetIds,
    };
  }

  public static getInstance(): CivilWarService {
    if (!CivilWarService.instance) {
      CivilWarService.instance = new CivilWarService();
    }
    return CivilWarService.instance;
  }

  /**
   * 내전 생성
   */
  public async createCivilWar(request: CreateCivilWarRequest): Promise<CivilWar> {
    const warId = `CW-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    // 반란 진영 생성
    const insurgentFactionId = `FAC-INS-${warId}`;
    const insurgentFaction: CivilWarFaction = {
      factionId: insurgentFactionId,
      name: request.insurgentFaction.name,
      role: FactionRole.INSURGENT,
      legitimacyClaim: request.insurgentFaction.legitimacyClaim,
      legitimacyScore: calculateLegitimacy(request.insurgentFaction.legitimacyClaim, {}),
      leaderCharacterId: request.insurgentFaction.leaderCharacterId,
      leaderName: '', // 나중에 채움
      memberCharacterIds: request.insurgentFaction.memberCharacterIds,
      controlledPlanetIds: request.insurgentFaction.controlledPlanetIds,
      controlledFortressIds: [],
      fleetIds: request.insurgentFaction.fleetIds,
      capitalPlanetId: request.insurgentFaction.capitalPlanetId,
      relations: new Map(),
      totalShips: 0,
      totalTroops: 0,
      initialStrength: 0,
      isDefeated: false,
      hasSurrendered: false,
    };

    // 정부군 진영 생성
    const incumbentFactionId = `FAC-INC-${warId}`;
    const incumbentFaction: CivilWarFaction = {
      factionId: incumbentFactionId,
      name: request.incumbentFaction.name,
      role: FactionRole.INCUMBENT,
      legitimacyClaim: request.incumbentFaction.legitimacyClaim,
      legitimacyScore: calculateLegitimacy(request.incumbentFaction.legitimacyClaim, {}),
      leaderCharacterId: request.incumbentFaction.leaderCharacterId,
      leaderName: '',
      memberCharacterIds: request.incumbentFaction.memberCharacterIds,
      controlledPlanetIds: request.incumbentFaction.controlledPlanetIds,
      controlledFortressIds: [],
      fleetIds: request.incumbentFaction.fleetIds,
      capitalPlanetId: request.incumbentFaction.capitalPlanetId,
      relations: new Map(),
      totalShips: 0,
      totalTroops: 0,
      initialStrength: 0,
      isDefeated: false,
      hasSurrendered: false,
    };

    // 서로 적대 관계 설정
    insurgentFaction.relations.set(incumbentFactionId, FactionRelation.HOSTILE);
    incumbentFaction.relations.set(insurgentFactionId, FactionRelation.HOSTILE);

    // 지도자 이름 조회
    const insurgentLeader = await Gin7Character.findOne({
      sessionId: request.sessionId,
      characterId: request.insurgentFaction.leaderCharacterId,
    });
    const incumbentLeader = await Gin7Character.findOne({
      sessionId: request.sessionId,
      characterId: request.incumbentFaction.leaderCharacterId,
    });

    if (insurgentLeader) insurgentFaction.leaderName = insurgentLeader.name;
    if (incumbentLeader) incumbentFaction.leaderName = incumbentLeader.name;

    // 전력 계산
    insurgentFaction.initialStrength = await this.calculateFactionStrength(
      request.sessionId,
      insurgentFaction,
    );
    incumbentFaction.initialStrength = await this.calculateFactionStrength(
      request.sessionId,
      incumbentFaction,
    );

    // 내전 객체 생성
    const factions = new Map<string, CivilWarFaction>();
    factions.set(insurgentFactionId, insurgentFaction);
    factions.set(incumbentFactionId, incumbentFaction);

    const civilWar: CivilWar = {
      warId,
      sessionId: request.sessionId,
      name: request.name,
      originFaction: request.originFaction,
      trigger: request.trigger,
      factions,
      status: CivilWarStatus.ACTIVE,
      startedAt: now,
      battleIds: [],
      totalCasualties: { ships: 0, troops: 0, characters: 0 },
    };

    this.civilWars.set(warId, civilWar);

    // Faction 상태 업데이트
    await this.updateFactionsForCivilWar(civilWar);

    // 이벤트 발생
    this.emit('CIVIL_WAR_STARTED', {
      warId,
      sessionId: request.sessionId,
      name: request.name,
      triggerType: request.trigger.type,
      factionCount: 2,
      insurgentFaction: {
        name: insurgentFaction.name,
        leader: insurgentFaction.leaderName,
        planetCount: insurgentFaction.controlledPlanetIds.length,
        fleetCount: insurgentFaction.fleetIds.length,
      },
      incumbentFaction: {
        name: incumbentFaction.name,
        leader: incumbentFaction.leaderName,
        planetCount: incumbentFaction.controlledPlanetIds.length,
        fleetCount: incumbentFaction.fleetIds.length,
      },
    });

    logger.info(
      `[CivilWarService] Civil war started: ${warId} (${request.name}), trigger: ${request.trigger.type}`,
    );
    logger.info(
      `[CivilWarService] Insurgent: ${insurgentFaction.name} (${insurgentFaction.leaderName}) - ` +
      `${insurgentFaction.controlledPlanetIds.length} planets, ${insurgentFaction.fleetIds.length} fleets`,
    );
    logger.info(
      `[CivilWarService] Incumbent: ${incumbentFaction.name} (${incumbentFaction.leaderName}) - ` +
      `${incumbentFaction.controlledPlanetIds.length} planets, ${incumbentFaction.fleetIds.length} fleets`,
    );

    return civilWar;
  }

  /**
   * 제3세력 추가
   */
  public async addThirdParty(request: AddThirdPartyRequest): Promise<CivilWarFaction | null> {
    const civilWar = this.civilWars.get(request.warId);
    if (!civilWar || civilWar.status !== CivilWarStatus.ACTIVE) {
      return null;
    }

    const factionId = `FAC-3RD-${request.warId}-${civilWar.factions.size}`;

    const leader = await Gin7Character.findOne({
      sessionId: civilWar.sessionId,
      characterId: request.leaderCharacterId,
    });

    const thirdParty: CivilWarFaction = {
      factionId,
      name: request.name,
      role: FactionRole.THIRD_PARTY,
      legitimacyClaim: request.legitimacyClaim,
      legitimacyScore: calculateLegitimacy(request.legitimacyClaim, {}),
      leaderCharacterId: request.leaderCharacterId,
      leaderName: leader?.name || '',
      memberCharacterIds: request.memberCharacterIds,
      controlledPlanetIds: request.controlledPlanetIds,
      controlledFortressIds: [],
      fleetIds: request.fleetIds,
      capitalPlanetId: request.capitalPlanetId,
      relations: new Map(),
      totalShips: 0,
      totalTroops: 0,
      initialStrength: 0,
      isDefeated: false,
      hasSurrendered: false,
    };

    // 초기 관계 설정
    for (const rel of request.initialRelations) {
      thirdParty.relations.set(rel.factionId, rel.relation);

      // 상대 진영에도 관계 설정
      const otherFaction = civilWar.factions.get(rel.factionId);
      if (otherFaction) {
        otherFaction.relations.set(factionId, rel.relation);
      }
    }

    // 전력 계산
    thirdParty.initialStrength = await this.calculateFactionStrength(
      civilWar.sessionId,
      thirdParty,
    );

    civilWar.factions.set(factionId, thirdParty);

    // 제3세력 리더의 Faction 상태 업데이트
    const leaderFaction = await Faction.findOne({
      sessionId: civilWar.sessionId,
      $or: [
        { leaderId: request.leaderCharacterId },
        { 'members.characterId': request.leaderCharacterId },
      ],
    });

    if (leaderFaction) {
      await Faction.updateOne(
        { sessionId: civilWar.sessionId, factionId: leaderFaction.factionId },
        {
          $set: {
            inCivilWar: true,
            civilWarId: civilWar.warId,
            civilWarFactionId: factionId,
            civilWarRole: 'THIRD_PARTY',
          },
        },
      );

      logger.info(
        `[CivilWarService] Updated Faction ${leaderFaction.factionId} for third party - inCivilWar: true`,
      );
    }

    // 이벤트 발생
    this.emit('THIRD_PARTY_JOINED', {
      warId: request.warId,
      factionId,
      name: request.name,
      leaderName: thirdParty.leaderName,
      planetCount: thirdParty.controlledPlanetIds.length,
      fleetCount: thirdParty.fleetIds.length,
    });

    logger.info(`[CivilWarService] Third party joined: ${request.name} in war ${request.warId}`);
    logger.info(
      `[CivilWarService] Third party: ${request.name} (${thirdParty.leaderName}) - ` +
      `${thirdParty.controlledPlanetIds.length} planets, ${thirdParty.fleetIds.length} fleets`,
    );

    return thirdParty;
  }

  /**
   * 전투 결과 처리
   */
  public async processBattleResult(
    warId: string,
    battleId: string,
    winnerId: string,
    loserId: string,
    casualties: { ships: number; troops: number },
    capturedPlanetId?: string,
    capturedLeaderId?: string,
  ): Promise<void> {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar) return;

    civilWar.battleIds.push(battleId);
    civilWar.totalCasualties.ships += casualties.ships;
    civilWar.totalCasualties.troops += casualties.troops;

    const loserFaction = civilWar.factions.get(loserId);
    const winnerFaction = civilWar.factions.get(winnerId);

    if (!loserFaction || !winnerFaction) return;

    // 행성 점령 처리
    if (capturedPlanetId) {
      loserFaction.controlledPlanetIds = loserFaction.controlledPlanetIds.filter(
        (id) => id !== capturedPlanetId,
      );
      winnerFaction.controlledPlanetIds.push(capturedPlanetId);

      // 수도 점령 체크
      if (capturedPlanetId === loserFaction.capitalPlanetId) {
        await this.checkVictoryCondition(civilWar, winnerId, {
          type: 'CAPITAL_CAPTURE',
          description: '적 진영의 수도/본거지 점령',
        });
      }
    }

    // 지도자 포획 처리
    if (capturedLeaderId && capturedLeaderId === loserFaction.leaderCharacterId) {
      civilWar.totalCasualties.characters++;
      await this.checkVictoryCondition(civilWar, winnerId, {
        type: 'LEADER_ELIMINATION',
        description: '적 지도자 포획, 사망, 또는 항복',
      });
    }

    // 전력 궤멸 체크
    const currentStrength = await this.calculateFactionStrength(civilWar.sessionId, loserFaction);
    const destructionRate =
      ((loserFaction.initialStrength - currentStrength) / loserFaction.initialStrength) * 100;

    if (destructionRate >= 90) {
      await this.checkVictoryCondition(civilWar, winnerId, {
        type: 'FORCE_DESTRUCTION',
        description: '적 진영 전력 90% 이상 궤멸',
        threshold: 90,
      });
    }

    // 이벤트 발생
    this.emit('BATTLE_PROCESSED', {
      warId,
      battleId,
      winnerId,
      loserId,
      capturedPlanetId,
      capturedLeaderId,
    });
  }

  /**
   * 항복 선언
   */
  public async declareSurrender(warId: string, factionId: string): Promise<boolean> {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar || civilWar.status !== CivilWarStatus.ACTIVE) {
      return false;
    }

    const surrenderingFaction = civilWar.factions.get(factionId);
    if (!surrenderingFaction) return false;

    surrenderingFaction.hasSurrendered = true;
    surrenderingFaction.isDefeated = true;

    // 남은 적대 진영 중 가장 강한 진영이 승자
    const hostileFactions = Array.from(civilWar.factions.values()).filter(
      (f) =>
        !f.isDefeated &&
        f.factionId !== factionId &&
        surrenderingFaction.relations.get(f.factionId) === FactionRelation.HOSTILE,
    );

    if (hostileFactions.length === 1) {
      await this.checkVictoryCondition(civilWar, hostileFactions[0].factionId, {
        type: 'SURRENDER',
        description: '적 진영의 무조건 항복',
      });
    }

    this.emit('FACTION_SURRENDERED', {
      warId,
      factionId,
      factionName: surrenderingFaction.name,
    });

    logger.info(`[CivilWarService] Faction surrendered: ${surrenderingFaction.name} in ${warId}`);

    return true;
  }

  /**
   * 휴전 선언
   */
  public async declareCeasefire(
    warId: string,
    factionAId: string,
    factionBId: string,
  ): Promise<boolean> {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar) return false;

    const factionA = civilWar.factions.get(factionAId);
    const factionB = civilWar.factions.get(factionBId);

    if (!factionA || !factionB) return false;

    factionA.relations.set(factionBId, FactionRelation.CEASEFIRE);
    factionB.relations.set(factionAId, FactionRelation.CEASEFIRE);

    // 모든 진영이 휴전 중인지 확인
    const allCeasefire = this.checkAllCeasefire(civilWar);
    if (allCeasefire) {
      civilWar.status = CivilWarStatus.CEASEFIRE;
    }

    this.emit('CEASEFIRE_DECLARED', {
      warId,
      factionAId,
      factionBId,
    });

    return true;
  }

  /**
   * 협상 종결
   */
  public async negotiateEnd(
    warId: string,
    terms: {
      territoryDivision?: Map<string, string[]>; // factionId -> planetIds
      reparations?: Map<string, number>; // factionId -> credits
    },
  ): Promise<boolean> {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar) return false;

    civilWar.status = CivilWarStatus.RESOLVED;
    civilWar.resolution = CivilWarResolution.NEGOTIATED;
    civilWar.endedAt = new Date();

    // 영토 재분배
    if (terms.territoryDivision) {
      for (const [factionId, planetIds] of terms.territoryDivision) {
        const faction = civilWar.factions.get(factionId);
        if (faction) {
          faction.controlledPlanetIds = planetIds;
        }
      }
    }

    // Faction 상태 초기화
    await this.clearFactionsForCivilWar(civilWar);

    this.emit('CIVIL_WAR_ENDED', {
      warId,
      resolution: CivilWarResolution.NEGOTIATED,
      terms,
    });

    logger.info(`[CivilWarService] Civil war ended by negotiation: ${warId}`);

    return true;
  }

  /**
   * 내전 조회
   */
  public getCivilWar(warId: string): CivilWar | undefined {
    return this.civilWars.get(warId);
  }

  /**
   * 세션의 활성 내전 목록 조회
   */
  public getActiveCivilWars(sessionId: string): CivilWar[] {
    return Array.from(this.civilWars.values()).filter(
      (war) => war.sessionId === sessionId && war.status === CivilWarStatus.ACTIVE,
    );
  }

  /**
   * 캐릭터가 속한 진영 조회
   */
  public getCharacterFaction(
    warId: string,
    characterId: string,
  ): CivilWarFaction | undefined {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar) return undefined;

    for (const faction of civilWar.factions.values()) {
      if (
        faction.leaderCharacterId === characterId ||
        faction.memberCharacterIds.includes(characterId)
      ) {
        return faction;
      }
    }

    return undefined;
  }

  /**
   * 두 진영이 적대 관계인지 확인
   */
  public areHostile(warId: string, factionAId: string, factionBId: string): boolean {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar) return false;

    const factionA = civilWar.factions.get(factionAId);
    if (!factionA) return false;

    return factionA.relations.get(factionBId) === FactionRelation.HOSTILE;
  }

  /**
   * 내전 중 공적 보너스 계산
   */
  public calculateMeritBonus(baseAmount: number, actionType: 'SHIP' | 'PLANET' | 'LEADER'): number {
    switch (actionType) {
      case 'SHIP':
        return Math.floor(baseAmount * CIVIL_WAR_MERIT_MULTIPLIER.ENEMY_SHIP_DESTROYED);
      case 'PLANET':
        return Math.floor(baseAmount * CIVIL_WAR_MERIT_MULTIPLIER.PLANET_CAPTURED);
      case 'LEADER':
        return CIVIL_WAR_MERIT_MULTIPLIER.LEADER_CAPTURED;
      default:
        return baseAmount;
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * 승리 조건 체크 및 내전 종결
   */
  private async checkVictoryCondition(
    civilWar: CivilWar,
    winnerId: string,
    condition: VictoryCondition,
  ): Promise<void> {
    const winnerFaction = civilWar.factions.get(winnerId);
    if (!winnerFaction) return;

    // 다른 적대 진영이 모두 패배했는지 확인
    const remainingHostile = Array.from(civilWar.factions.values()).filter(
      (f) =>
        !f.isDefeated &&
        f.factionId !== winnerId &&
        winnerFaction.relations.get(f.factionId) === FactionRelation.HOSTILE,
    );

    if (remainingHostile.length === 0) {
      civilWar.status = CivilWarStatus.RESOLVED;
      civilWar.resolution = CivilWarResolution.TOTAL_VICTORY;
      civilWar.winnerId = winnerId;
      civilWar.victoryConditionMet = condition;
      civilWar.endedAt = new Date();

      // Faction 상태 초기화
      await this.clearFactionsForCivilWar(civilWar);

      this.emit('CIVIL_WAR_ENDED', {
        warId: civilWar.warId,
        resolution: CivilWarResolution.TOTAL_VICTORY,
        winnerId,
        winnerName: winnerFaction.name,
        victoryCondition: condition,
      });

      logger.info(
        `[CivilWarService] Civil war ended: ${civilWar.warId}, winner: ${winnerFaction.name}`,
      );
    } else {
      // 하나의 진영만 패배 처리
      for (const faction of civilWar.factions.values()) {
        if (
          faction.factionId !== winnerId &&
          winnerFaction.relations.get(faction.factionId) === FactionRelation.HOSTILE
        ) {
          // 조건에 해당하는 진영 패배 처리
          if (condition.type === 'CAPITAL_CAPTURE') {
            // 수도가 점령된 진영 패배
            if (!faction.controlledPlanetIds.includes(faction.capitalPlanetId)) {
              faction.isDefeated = true;
            }
          }
        }
      }
    }
  }

  /**
   * 진영 전력 계산
   */
  private async calculateFactionStrength(
    sessionId: string,
    faction: CivilWarFaction,
  ): Promise<number> {
    // 함대 전력 합산
    const fleets = await Fleet.find({
      session_id: sessionId,
      fleetId: { $in: faction.fleetIds }
    }).select('totalStrength totalShips');

    const fleetStrength = fleets.reduce((sum, fleet) => {
      // totalStrength가 있으면 사용, 없으면 함선 수 * 10 (임시 가중치)
      return sum + (fleet.totalStrength || (fleet.totalShips * 300)); 
    }, 0);

    // 행성 전력 합산 (방어력 등)
    const planets = await Planet.find({
      session_id: sessionId,
      planetId: { $in: faction.controlledPlanetIds }
    }).select('stats isFortress fortressGuns');

    const planetStrength = planets.reduce((sum, planet) => {
      let score = (planet.stats?.defense || 0) * 100;
      if (planet.isFortress) {
        score += (planet.fortressGuns || 10000) * 10; // 요새는 높은 점수
      }
      return sum + score;
    }, 0);

    return fleetStrength + planetStrength;
  }

  /**
   * 모든 진영이 휴전 중인지 확인
   */
  private checkAllCeasefire(civilWar: CivilWar): boolean {
    for (const faction of civilWar.factions.values()) {
      for (const relation of faction.relations.values()) {
        if (relation === FactionRelation.HOSTILE) {
          return false;
        }
      }
    }
    return true;
  }

  // ==================== Faction 상태 관리 ====================

  /**
   * 내전 시작 시 관련 Faction 상태 업데이트
   */
  private async updateFactionsForCivilWar(
    civilWar: CivilWar,
  ): Promise<void> {
    const { sessionId, warId, factions } = civilWar;

    for (const [factionId, cwFaction] of factions) {
      // 진영의 리더가 속한 원래 Faction 찾기
      const leaderFaction = await Faction.findOne({
        sessionId,
        $or: [
          { leaderId: cwFaction.leaderCharacterId },
          { 'members.characterId': cwFaction.leaderCharacterId },
        ],
      });

      if (leaderFaction) {
        // Faction 내전 상태 업데이트
        await Faction.updateOne(
          { sessionId, factionId: leaderFaction.factionId },
          {
            $set: {
              inCivilWar: true,
              civilWarId: warId,
              civilWarFactionId: factionId,
              civilWarRole: cwFaction.role,
            },
          },
        );

        logger.info(
          `[CivilWarService] Updated Faction ${leaderFaction.factionId} - inCivilWar: true, role: ${cwFaction.role}`,
        );
      }
    }
  }

  /**
   * 내전 종결 시 관련 Faction 상태 초기화
   */
  private async clearFactionsForCivilWar(
    civilWar: CivilWar,
  ): Promise<void> {
    const { sessionId, warId } = civilWar;

    // 해당 내전에 참여 중인 모든 Faction 상태 초기화
    const result = await Faction.updateMany(
      { sessionId, civilWarId: warId },
      {
        $set: {
          inCivilWar: false,
        },
        $unset: {
          civilWarId: '',
          civilWarFactionId: '',
          civilWarRole: '',
        },
      },
    );

    logger.info(
      `[CivilWarService] Cleared civil war status for ${result.modifiedCount} factions`,
    );
  }

  /**
   * 함대 소유권 업데이트 (진영 이동)
   */
  public async updateFleetOwnership(
    sessionId: string,
    fleetId: string,
    newFactionId: string,
    newOwner: 'empire' | 'alliance' | 'neutral',
  ): Promise<boolean> {
    try {
      const result = await Fleet.updateOne(
        { session_id: sessionId, fleetId },
        { $set: { faction: newOwner } },
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `[CivilWarService] Fleet ${fleetId} transferred to ${newOwner} (faction: ${newFactionId})`,
        );
        
        this.emit('FLEET_TRANSFERRED', {
          sessionId,
          fleetId,
          newFactionId,
          newOwner,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[CivilWarService] Error updating fleet ownership: ${error}`);
      return false;
    }
  }

  /**
   * 행성 소유권 업데이트 (진영 이동)
   */
  public async updatePlanetOwnership(
    sessionId: string,
    planetId: string,
    newFactionId: string,
    newOwner: 'empire' | 'alliance' | 'neutral',
  ): Promise<boolean> {
    try {
      const result = await Planet.updateOne(
        { session_id: sessionId, planetId },
        { $set: { owner: newOwner } },
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `[CivilWarService] Planet ${planetId} transferred to ${newOwner} (faction: ${newFactionId})`,
        );
        
        this.emit('PLANET_TRANSFERRED', {
          sessionId,
          planetId,
          newFactionId,
          newOwner,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[CivilWarService] Error updating planet ownership: ${error}`);
      return false;
    }
  }

  /**
   * 세션의 현재 내전 상태 확인
   */
  public async isSessionInCivilWar(sessionId: string): Promise<boolean> {
    const activeWars = this.getActiveCivilWars(sessionId);
    return activeWars.length > 0;
  }

  /**
   * 특정 Faction이 내전 중인지 확인
   */
  public async isFactionInCivilWar(
    sessionId: string,
    factionId: string,
  ): Promise<{ inCivilWar: boolean; civilWarId?: string; role?: string }> {
    const faction = await Faction.findOne({ sessionId, factionId });
    
    if (!faction) {
      return { inCivilWar: false };
    }

    return {
      inCivilWar: faction.inCivilWar,
      civilWarId: faction.civilWarId,
      role: faction.civilWarRole,
    };
  }

  /**
   * 내전 진영 요약 정보 조회
   */
  public getCivilWarSummary(warId: string): {
    warId: string;
    name: string;
    status: string;
    factions: Array<{
      factionId: string;
      name: string;
      role: string;
      planetCount: number;
      fleetCount: number;
      isDefeated: boolean;
    }>;
  } | null {
    const civilWar = this.civilWars.get(warId);
    if (!civilWar) return null;

    const factionSummaries = Array.from(civilWar.factions.values()).map(f => ({
      factionId: f.factionId,
      name: f.name,
      role: f.role,
      planetCount: f.controlledPlanetIds.length,
      fleetCount: f.fleetIds.length,
      isDefeated: f.isDefeated,
    }));

    return {
      warId: civilWar.warId,
      name: civilWar.name,
      status: civilWar.status,
      factions: factionSummaries,
    };
  }
}

export const civilWarService = CivilWarService.getInstance();
export default CivilWarService;

