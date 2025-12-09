/**
 * SecessionService - 분리독립 시스템 서비스
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 주요 기능:
 * - 독립 선언 (행성/성계 단위)
 * - 새로운 세력 생성
 * - 내전 트리거 연동
 * - 자산(행성/함대/캐릭터) 소속 변경
 *
 * 원작 예시: 엘 파실 독립정부, 이제를론 공화국
 */

import { EventEmitter } from 'events';
import { Gin7Character } from '../../models/gin7/Character';
import { Fleet } from '../../models/logh/Fleet.model';
import { Planet } from '../../models/logh/Planet.model';
import { Faction, IFaction } from '../../models/gin7/Faction';
import { Fleet as Gin7Fleet, IFleet as IGin7Fleet } from '../../models/gin7/Fleet';
import { Planet as Gin7Planet, IPlanet as IGin7Planet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';
import {
  CivilWarTriggerType,
  LegitimacyClaim,
  FactionRelation,
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
 * 분리독립 타입
 */
export enum SecessionType {
  INDEPENDENCE = 'INDEPENDENCE', // 완전 독립 (새 세력 탄생)
  AUTONOMY = 'AUTONOMY', // 자치령 전환 (기존 세력 내 자치)
  DEFECTION = 'DEFECTION', // 적 세력에 귀순
}

/**
 * 분리독립 상태
 */
export enum SecessionStatus {
  PREPARING = 'PREPARING', // 준비 중
  DECLARED = 'DECLARED', // 독립 선언됨
  ACTIVE = 'ACTIVE', // 전쟁 중 (중앙정부 진압)
  RESOLVED = 'RESOLVED', // 종결됨
}

/**
 * 분리독립 요청 인터페이스
 */
export interface SecessionRequest {
  sessionId: string;
  type: SecessionType;
  leaderCharacterId: string;
  
  // 분리 대상
  targetPlanetIds: string[];
  targetSystemId?: string; // 성계 단위 독립 시
  
  // 새 세력 정보 (INDEPENDENCE 시)
  newFactionName?: string;
  legitimacyClaim: LegitimacyClaim;
  
  // 귀순 대상 (DEFECTION 시)
  defectionTargetFaction?: 'IMPERIAL' | 'ALLIANCE';
}

/**
 * 분리독립 정보 인터페이스
 */
export interface Secession {
  secessionId: string;
  sessionId: string;
  type: SecessionType;
  status: SecessionStatus;
  
  // 기본 정보
  originFaction: 'IMPERIAL' | 'ALLIANCE';
  leaderCharacterId: string;
  leaderName: string;
  
  // 분리 대상
  targetPlanetIds: string[];
  targetSystemId?: string;
  
  // 새 세력 (INDEPENDENCE 시)
  newFactionId?: string;
  newFactionName?: string;
  legitimacyClaim: LegitimacyClaim;
  
  // 지지율/조건
  popularSupport: number; // 해당 행성 주민 지지율 (0-100)
  militaryStrength: number; // 독립파 군사력
  
  // 타임스탬프
  preparedAt: Date;
  declaredAt?: Date;
  resolvedAt?: Date;
  
  // 결과
  result?: 'SUCCESS' | 'SUPPRESSED' | 'NEGOTIATED';
  civilWarId?: string; // 발생한 내전 ID
}

/**
 * 분리독립 결과
 */
export interface SecessionResult {
  success: boolean;
  error?: string;
  secession?: Secession;
  cpCost?: number;
}

/**
 * 분리독립 선언 조건
 */
const SECESSION_CONDITIONS = {
  MIN_POPULAR_SUPPORT: 40, // 최소 주민 지지율
  MIN_MILITARY_STRENGTH: 30, // 최소 군사력
  MAX_PUBLIC_ORDER: 30, // 치안이 이 이하여야 독립 선언 가능
  CP_COST_PREPARE: 160, // 준비 CP 비용
  CP_COST_DECLARE: 320, // 선언 CP 비용
  
  // 행성 후보 조건
  MIN_PLANET_LOYALTY_THRESHOLD: 40, // 충성도가 이 이하면 독립 후보
  MIN_PLANET_UNREST_THRESHOLD: 30, // 민심 불안이 이 이상이면 독립 후보
  MIN_APPROVAL_THRESHOLD: 50, // 정부 지지율이 이 이하면 독립 후보
};

/**
 * 분리독립 후보 행성 조건 인터페이스
 */
export interface SecessionCandidateCriteria {
  maxLoyalty?: number;        // 충성도 상한 (이하인 행성만)
  minUnrest?: number;         // 민심 불안 하한 (이상인 행성만)
  maxApprovalRating?: number; // 정부 지지율 상한
  systemId?: string;          // 특정 성계만
  excludeCapitals?: boolean;  // 수도 제외 여부
}

/**
 * 새 세력 생성 요청
 */
export interface NewFactionRequest {
  sessionId: string;
  factionId: string;
  name: string;
  nameKo: string;
  type: 'rebel' | 'minor';
  leaderId: string;
  leaderName: string;
  color?: string;
  initialPlanets: string[];
  initialFleets: string[];
  initialCharacters: string[];
}

/**
 * SecessionService 클래스
 */
export class SecessionService extends EventEmitter {
  private static instance: SecessionService;
  
  // 메모리 내 저장소
  private secessions: Map<string, Secession> = new Map();

  private constructor() {
    super();
    logger.info('[SecessionService] Initialized');
  }

  public static getInstance(): SecessionService {
    if (!SecessionService.instance) {
      SecessionService.instance = new SecessionService();
    }
    return SecessionService.instance;
  }

  /**
   * 분리독립 준비 (모의)
   */
  public async prepareSecession(request: SecessionRequest): Promise<SecessionResult> {
    try {
      const { sessionId, leaderCharacterId, targetPlanetIds } = request;

      // 지도자 확인
      const leader = await Gin7Character.findOne({ sessionId, characterId: leaderCharacterId });
      if (!leader) {
        return { success: false, error: '지도자를 찾을 수 없습니다.' };
      }

      // 이미 진행 중인 독립 운동 확인
      const existing = Array.from(this.secessions.values()).find(
        s => s.sessionId === sessionId &&
          s.leaderCharacterId === leaderCharacterId &&
          s.status !== SecessionStatus.RESOLVED
      );

      if (existing) {
        return { success: false, error: '이미 진행 중인 독립 운동이 있습니다.' };
      }

      // 지지율/군사력 계산
      const popularSupport = await this.calculatePopularSupport(sessionId, targetPlanetIds);
      const militaryStrength = await this.calculateMilitaryStrength(sessionId, leaderCharacterId);

      const secessionId = `SEC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date();

      const secession: Secession = {
        secessionId,
        sessionId,
        type: request.type,
        status: SecessionStatus.PREPARING,
        originFaction: (leader as any).faction || 'ALLIANCE',
        leaderCharacterId,
        leaderName: leader.name,
        targetPlanetIds,
        targetSystemId: request.targetSystemId,
        newFactionName: request.newFactionName,
        legitimacyClaim: request.legitimacyClaim,
        popularSupport,
        militaryStrength,
        preparedAt: now,
      };

      this.secessions.set(secessionId, secession);

      this.emit('SECESSION_PREPARED', {
        sessionId,
        secessionId,
        leaderCharacterId,
        type: request.type,
      });

      logger.info(`[SecessionService] Secession prepared: ${secessionId} by ${leader.name}`);

      return {
        success: true,
        secession,
        cpCost: SECESSION_CONDITIONS.CP_COST_PREPARE,
      };
    } catch (error: any) {
      logger.error(`[SecessionService] Error preparing secession: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 독립 선언
   */
  public async declareIndependence(
    sessionId: string,
    secessionId: string,
  ): Promise<SecessionResult> {
    try {
      const secession = this.secessions.get(secessionId);
      if (!secession || secession.sessionId !== sessionId) {
        return { success: false, error: '분리독립 정보를 찾을 수 없습니다.' };
      }

      if (secession.status !== SecessionStatus.PREPARING) {
        return { success: false, error: '준비 단계가 아닙니다.' };
      }

      // 조건 확인
      if (secession.popularSupport < SECESSION_CONDITIONS.MIN_POPULAR_SUPPORT) {
        return {
          success: false,
          error: `주민 지지율이 ${SECESSION_CONDITIONS.MIN_POPULAR_SUPPORT}% 이상이어야 합니다. (현재: ${secession.popularSupport}%)`,
        };
      }

      if (secession.militaryStrength < SECESSION_CONDITIONS.MIN_MILITARY_STRENGTH) {
        return {
          success: false,
          error: `군사력이 ${SECESSION_CONDITIONS.MIN_MILITARY_STRENGTH}% 이상이어야 합니다. (현재: ${secession.militaryStrength}%)`,
        };
      }

      secession.status = SecessionStatus.DECLARED;
      secession.declaredAt = new Date();

      // 새 세력 ID 생성 (INDEPENDENCE 타입인 경우)
      if (secession.type === SecessionType.INDEPENDENCE) {
        secession.newFactionId = `FACTION-IND-${secessionId}`;
      }

      this.emit('INDEPENDENCE_DECLARED', {
        sessionId,
        secessionId,
        leaderCharacterId: secession.leaderCharacterId,
        newFactionId: secession.newFactionId,
        targetPlanetIds: secession.targetPlanetIds,
      });

      // 내전 자동 발생
      await this.triggerCivilWar(secession);

      logger.info(`[SecessionService] Independence declared: ${secessionId}`);

      return {
        success: true,
        secession,
        cpCost: SECESSION_CONDITIONS.CP_COST_DECLARE,
      };
    } catch (error: any) {
      logger.error(`[SecessionService] Error declaring independence: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 내전 트리거
   */
  private async triggerCivilWar(secession: Secession): Promise<void> {
    try {
      const civilWarService = await getCivilWarService();

      // 중앙정부 세력 정보 조회
      const governmentForces = await this.findGovernmentForces(secession.sessionId);

      const civilWar = await civilWarService.createCivilWar({
        sessionId: secession.sessionId,
        name: `${secession.newFactionName || '독립파'} 독립전쟁`,
        originFaction: secession.originFaction,
        trigger: {
          type: CivilWarTriggerType.SECESSION,
          triggerId: secession.secessionId,
          triggerCharacterId: secession.leaderCharacterId,
        },
        insurgentFaction: {
          name: secession.newFactionName || '독립파',
          leaderCharacterId: secession.leaderCharacterId,
          memberCharacterIds: [],
          controlledPlanetIds: secession.targetPlanetIds,
          fleetIds: (await Fleet.find({
            session_id: secession.sessionId,
            dockedPlanetId: { $in: secession.targetPlanetIds }
          }).select('fleetId')).map(f => f.fleetId),
          capitalPlanetId: secession.targetPlanetIds[0],
          legitimacyClaim: secession.legitimacyClaim,
        },
        incumbentFaction: {
          name: '중앙정부',
          leaderCharacterId: governmentForces.leaderId,
          memberCharacterIds: governmentForces.characterIds,
          controlledPlanetIds: governmentForces.planetIds,
          fleetIds: governmentForces.fleetIds,
          capitalPlanetId: governmentForces.capitalId,
          legitimacyClaim: LegitimacyClaim.LEGAL_GOVERNMENT,
        },
      });

      secession.civilWarId = civilWar.warId;
      secession.status = SecessionStatus.ACTIVE;

      logger.info(`[SecessionService] Civil war triggered: ${civilWar.warId}`);
    } catch (error) {
      logger.error(`[SecessionService] Error triggering civil war: ${error}`);
    }
  }

  /**
   * 분리독립 종결 처리
   */
  public async resolveSecession(
    sessionId: string,
    secessionId: string,
    result: 'SUCCESS' | 'SUPPRESSED' | 'NEGOTIATED',
  ): Promise<boolean> {
    const secession = this.secessions.get(secessionId);
    if (!secession || secession.sessionId !== sessionId) {
      return false;
    }

    secession.status = SecessionStatus.RESOLVED;
    secession.result = result;
    secession.resolvedAt = new Date();

    this.emit('SECESSION_RESOLVED', {
      sessionId,
      secessionId,
      result,
      newFactionId: result === 'SUCCESS' ? secession.newFactionId : undefined,
    });

    logger.info(`[SecessionService] Secession resolved: ${secessionId}, result: ${result}`);

    return true;
  }

  /**
   * 분리독립 조회
   */
  public getSecession(secessionId: string): Secession | undefined {
    return this.secessions.get(secessionId);
  }

  /**
   * 활성 분리독립 목록 조회
   */
  public getActiveSecessions(sessionId: string): Secession[] {
    return Array.from(this.secessions.values()).filter(
      s => s.sessionId === sessionId && s.status !== SecessionStatus.RESOLVED
    );
  }

  // ==================== Private Helper Methods ====================

  /**
   * 주민 지지율 계산
   */
  private async calculatePopularSupport(
    sessionId: string,
    planetIds: string[],
  ): Promise<number> {
    if (planetIds.length === 0) return 0;

    const planets = await Planet.find({
      session_id: sessionId,
      planetId: { $in: planetIds }
    }).select('stats.approvalRating stats.loyalty');

    if (planets.length === 0) return 0;

    const totalSupport = planets.reduce((sum, p) => {
      // 정부 지지율의 역수 + 지역 충성도 등을 고려해야 하나 
      // 여기서는 '독립 지지율'로 해석하여, 현재 정부에 대한 지지율(approvalRating)이 낮을수록 높다고 가정
      // 혹은 별도의 independenceSupport 필드가 없다면 민심 이반도(100 - approval) 사용
      const dissent = 100 - (p.stats.approvalRating || 50);
      return sum + dissent;
    }, 0);

    return Math.floor(totalSupport / planets.length);
  }

  /**
   * 군사력 계산
   */
  private async calculateMilitaryStrength(
    sessionId: string,
    leaderCharacterId: string,
  ): Promise<number> {
    // 지도자가 지휘하는 함대 전력
    const fleets = await Fleet.find({
      session_id: sessionId,
      commanderId: leaderCharacterId
    }).select('totalStrength totalShips');

    if (fleets.length === 0) return 0;

    // 대략적인 전력 수치 (0-100 스케일로 정규화하거나 절대값 사용)
    // 여기서는 절대값으로 반환하되, 조건 체크 시 기준값과 비교
    const totalStrength = fleets.reduce((sum, f) => {
      return sum + (f.totalStrength || (f.totalShips * 300));
    }, 0);

    // 100점 만점으로 환산 (예: 10만 척 = 100점)
    // 1척당 전투력 1 가정 시, 30,000,000이 100점?
    // 너무 복잡하므로 단순하게 함선 수 기준으로 스케일링
    // 표준 함대(15000척) 1개 = 약 15점?
    // 30%가 최소 조건이므로, 약 2개 함대 정도면 충족하도록
    return Math.min(100, Math.floor(totalStrength / 1000)); 
  }

  /**
   * 중앙정부 세력 정보 조회
   */
  private async findGovernmentForces(
    sessionId: string,
  ): Promise<{
    leaderId: string;
    characterIds: string[];
    fleetIds: string[];
    planetIds: string[];
    capitalId: string;
  }> {
    // 현 정부(황제 또는 의장) 조회 - 랭킹 1위
    const leader = await Gin7Character.findOne({
      sessionId,
      'currentRank.tier': { $gte: 1 } // 고위직
    }).sort({ 'currentRank.tier': -1 });

    if (!leader) {
      return {
        leaderId: 'UNKNOWN',
        characterIds: [],
        fleetIds: [],
        planetIds: ['ODIN'],
        capitalId: 'ODIN',
      };
    }

    const faction = (leader as any).faction || 'empire';
    
    // 수도 조회
    const capital = await Planet.findOne({
      session_id: sessionId,
      owner: faction,
      isCapital: true
    });

    // 정부군 함대 (수도 방위군 등)
    const fleets = await Fleet.find({
      session_id: sessionId,
      commanderId: leader.characterId
    }).select('fleetId');

    return {
      leaderId: leader.characterId,
      characterIds: [leader.characterId],
      fleetIds: fleets.map(f => f.fleetId),
      planetIds: capital ? [capital.planetId] : ['ODIN'],
      capitalId: capital?.planetId || 'ODIN',
    };
  }

  // ==================== B. 분리독립 후보 행성 조회 ====================

  /**
   * 분리독립 후보 행성 조회
   * 충성도가 낮거나 민심 불안이 높은 행성들을 조회
   */
  public async findSecessionCandidatePlanets(
    sessionId: string,
    faction: 'empire' | 'alliance',
    criteria: SecessionCandidateCriteria = {},
  ): Promise<Array<{ planetId: string; name: string; loyalty: number; unrest: number; systemId: string }>> {
    const {
      maxLoyalty = SECESSION_CONDITIONS.MIN_PLANET_LOYALTY_THRESHOLD,
      minUnrest = SECESSION_CONDITIONS.MIN_PLANET_UNREST_THRESHOLD,
      maxApprovalRating = SECESSION_CONDITIONS.MIN_APPROVAL_THRESHOLD,
      systemId,
      excludeCapitals = true,
    } = criteria;

    // 쿼리 조건 구성
    const query: Record<string, any> = {
      session_id: sessionId,
      owner: faction,
      $or: [
        { 'stats.loyalty': { $lte: maxLoyalty } },
        { 'stats.unrest': { $gte: minUnrest } },
        { 'stats.approvalRating': { $lte: maxApprovalRating } },
      ],
    };

    if (systemId) {
      query.systemId = systemId;
    }

    if (excludeCapitals) {
      query.isCapital = { $ne: true };
    }

    const planets = await Planet.find(query).select(
      'planetId name stats.loyalty stats.unrest stats.approvalRating systemId'
    );

    const candidates = planets.map(p => ({
      planetId: p.planetId,
      name: p.name,
      loyalty: p.stats?.loyalty ?? 50,
      unrest: p.stats?.unrest ?? 0,
      approvalRating: p.stats?.approvalRating ?? 50,
      systemId: p.systemId,
    }));

    logger.info(`[SecessionService] Found ${candidates.length} candidate planets for secession in ${faction}`);

    return candidates;
  }

  /**
   * 특정 성계 내 모든 행성 조회 (성계 단위 독립용)
   */
  public async findPlanetsBySystem(
    sessionId: string,
    systemId: string,
  ): Promise<string[]> {
    const planets = await Planet.find({
      session_id: sessionId,
      systemId,
    }).select('planetId');

    return planets.map(p => p.planetId);
  }

  // ==================== C. 함대 데이터 조회 및 분배 ====================

  /**
   * 분리독립에 참여할 함대 조회
   * 해당 행성에 주둔 중이거나 해당 성계에 있는 함대를 조회
   */
  public async findFleetsForSecession(
    sessionId: string,
    planetIds: string[],
    systemId?: string,
  ): Promise<Array<{ fleetId: string; name: string; commanderId: string; location: string; totalShips: number }>> {
    // 조건 1: 해당 행성에 주둔(docked) 중인 함대
    const dockedFleets = await Fleet.find({
      session_id: sessionId,
      dockedPlanetId: { $in: planetIds },
    }).select('fleetId name commanderId dockedPlanetId totalShips');

    // 조건 2: 해당 성계에 있는 함대 (gin7/Fleet 모델 사용)
    let systemFleets: any[] = [];
    if (systemId) {
      systemFleets = await Gin7Fleet.find({
        sessionId,
        'location.systemId': systemId,
        status: { $in: ['IDLE', 'DOCKED'] }, // 이동 중이 아닌 함대만
      }).select('fleetId name commanderId location totalShips');
    }

    // 중복 제거 및 결합
    const fleetMap = new Map<string, any>();

    for (const fleet of dockedFleets) {
      fleetMap.set(fleet.fleetId, {
        fleetId: fleet.fleetId,
        name: fleet.name || `Fleet-${fleet.fleetId}`,
        commanderId: fleet.commanderId,
        location: fleet.dockedPlanetId || 'unknown',
        totalShips: fleet.totalShips || 0,
      });
    }

    for (const fleet of systemFleets) {
      if (!fleetMap.has(fleet.fleetId)) {
        fleetMap.set(fleet.fleetId, {
          fleetId: fleet.fleetId,
          name: fleet.name || `Fleet-${fleet.fleetId}`,
          commanderId: fleet.commanderId,
          location: fleet.location?.systemId || 'unknown',
          totalShips: fleet.totalShips || 0,
        });
      }
    }

    const result = Array.from(fleetMap.values());
    logger.info(`[SecessionService] Found ${result.length} fleets for secession`);

    return result;
  }

  // ==================== D. 새로운 세력/정부 생성 ====================

  /**
   * 새로운 세력(Faction) 생성
   * 분리독립 성공 시 새로운 세력을 DB에 생성
   */
  public async createNewFaction(request: NewFactionRequest): Promise<IFaction | null> {
    try {
      const {
        sessionId,
        factionId,
        name,
        nameKo,
        type,
        leaderId,
        leaderName,
        color = this.generateFactionColor(),
        initialPlanets,
        initialFleets,
        initialCharacters,
      } = request;

      // 이미 존재하는 세력인지 확인
      const existing = await Faction.findOne({ sessionId, factionId });
      if (existing) {
        logger.warn(`[SecessionService] Faction ${factionId} already exists`);
        return existing;
      }

      const newFaction = new Faction({
        sessionId,
        factionId,
        name,
        nameKo,
        type,
        leaderId,
        leaderName,
        members: [
          {
            characterId: leaderId,
            name: leaderName,
            role: 'leader',
            joinedAt: new Date(),
            influence: 100,
          },
        ],
        stats: {
          totalInfluence: 100,
          politicalPower: 30,
          militaryPower: initialFleets.length * 10,
          economicPower: initialPlanets.length * 5,
          popularity: 50,
        },
        territories: {
          systems: [],
          planets: initialPlanets,
          fortresses: [],
        },
        treasury: 10000, // 초기 자금
        relations: [],
        color,
        isActive: true,
        data: {
          originType: 'SECESSION',
          createdAt: new Date(),
          initialPlanets,
          initialFleets,
        },
      });

      await newFaction.save();

      logger.info(`[SecessionService] Created new faction: ${factionId} (${nameKo})`);

      this.emit('FACTION_CREATED', {
        sessionId,
        factionId,
        name: nameKo,
        type,
        leaderId,
      });

      return newFaction;
    } catch (error: any) {
      logger.error(`[SecessionService] Error creating faction: ${error.message}`);
      return null;
    }
  }

  /**
   * 자산(행성/함대/캐릭터)을 새 세력으로 이전
   */
  public async transferAssetsToNewFaction(
    sessionId: string,
    newFactionId: string,
    assets: {
      planetIds: string[];
      fleetIds: string[];
      characterIds: string[];
    },
  ): Promise<{ success: boolean; transferred: { planets: number; fleets: number; characters: number } }> {
    const result = { planets: 0, fleets: 0, characters: 0 };

    try {
      // 1. 행성 소속 변경
      if (assets.planetIds.length > 0) {
        // logh/Planet 모델 업데이트
        const planetUpdateResult = await Planet.updateMany(
          { session_id: sessionId, planetId: { $in: assets.planetIds } },
          {
            $set: {
              owner: newFactionId,
              'stats.loyalty': 70, // 독립 직후 충성도 상승
              'stats.unrest': 10, // 민심 불안 감소
            },
          }
        );
        result.planets = planetUpdateResult.modifiedCount;

        // gin7/Planet 모델도 업데이트 (있는 경우)
        await Gin7Planet.updateMany(
          { sessionId, planetId: { $in: assets.planetIds } },
          {
            $set: {
              ownerId: newFactionId,
              controllingFaction: newFactionId,
              loyalty: 70,
            },
          }
        );

        logger.info(`[SecessionService] Transferred ${result.planets} planets to ${newFactionId}`);
      }

      // 2. 함대 소속 변경
      if (assets.fleetIds.length > 0) {
        // logh/Fleet 모델 업데이트
        const fleetUpdateResult = await Fleet.updateMany(
          { session_id: sessionId, fleetId: { $in: assets.fleetIds } },
          {
            $set: {
              factionId: newFactionId,
            },
          }
        );
        result.fleets = fleetUpdateResult.modifiedCount;

        // gin7/Fleet 모델도 업데이트
        await Gin7Fleet.updateMany(
          { sessionId, fleetId: { $in: assets.fleetIds } },
          {
            $set: {
              factionId: newFactionId,
            },
          }
        );

        logger.info(`[SecessionService] Transferred ${result.fleets} fleets to ${newFactionId}`);
      }

      // 3. 캐릭터 소속 변경
      if (assets.characterIds.length > 0) {
        const charUpdateResult = await Gin7Character.updateMany(
          { sessionId, characterId: { $in: assets.characterIds } },
          {
            $set: {
              faction: newFactionId,
              'loyalty.currentFaction': newFactionId,
            },
          }
        );
        result.characters = charUpdateResult.modifiedCount;

        logger.info(`[SecessionService] Transferred ${result.characters} characters to ${newFactionId}`);
      }

      return { success: true, transferred: result };
    } catch (error: any) {
      logger.error(`[SecessionService] Error transferring assets: ${error.message}`);
      return { success: false, transferred: result };
    }
  }

  // ==================== E. 후속 처리 ====================

  /**
   * 분리독립 후 원 세력과의 관계 설정
   */
  public async establishPostSecessionRelations(
    sessionId: string,
    newFactionId: string,
    originFaction: 'empire' | 'alliance',
    relationshipType: 'WAR' | 'HOSTILE' | 'NEUTRAL' = 'WAR',
  ): Promise<void> {
    try {
      // 새 세력의 relations 업데이트
      const stanceMap: Record<string, 'enemy' | 'hostile' | 'neutral'> = {
        WAR: 'enemy',
        HOSTILE: 'hostile',
        NEUTRAL: 'neutral',
      };
      const relationValueMap: Record<string, number> = {
        WAR: -100,
        HOSTILE: -50,
        NEUTRAL: 0,
      };

      await Faction.updateOne(
        { sessionId, factionId: newFactionId },
        {
          $push: {
            relations: {
              targetFactionId: originFaction.toUpperCase(),
              stance: stanceMap[relationshipType],
              relationValue: relationValueMap[relationshipType],
            },
          },
          $set: {
            'data.originFaction': originFaction,
            'data.relationshipWithOrigin': relationshipType,
          },
        }
      );

      logger.info(
        `[SecessionService] Established ${relationshipType} relationship between ${newFactionId} and ${originFaction}`
      );

      // 이벤트 발행
      this.emit('SECESSION_RELATIONS_ESTABLISHED', {
        sessionId,
        newFactionId,
        originFaction,
        relationshipType,
      });
    } catch (error: any) {
      logger.error(`[SecessionService] Error establishing relations: ${error.message}`);
    }
  }

  /**
   * 분리독립 이벤트 기록
   * 주요 사건(어떤 행성이 독립했는지, 새 세력 ID 등)을 로그로 남김
   */
  public async recordSecessionEvent(
    sessionId: string,
    secession: Secession,
    eventType: 'PREPARED' | 'DECLARED' | 'SUCCESS' | 'SUPPRESSED',
  ): Promise<void> {
    const eventData = {
      type: `SECESSION_${eventType}`,
      sessionId,
      secessionId: secession.secessionId,
      timestamp: new Date(),
      data: {
        leaderCharacterId: secession.leaderCharacterId,
        leaderName: secession.leaderName,
        originFaction: secession.originFaction,
        targetPlanetIds: secession.targetPlanetIds,
        newFactionId: secession.newFactionId,
        newFactionName: secession.newFactionName,
        popularSupport: secession.popularSupport,
        militaryStrength: secession.militaryStrength,
      },
    };

    // 로그 기록
    logger.info(`[SecessionService] Event: ${eventType}`, eventData);

    // 이벤트 발행
    this.emit(`SECESSION_EVENT_${eventType}`, eventData);

    // 특수 이벤트 처리 (엘 파실, 이제를론 등)
    if (eventType === 'SUCCESS') {
      await this.handleSpecialSecessionEvents(secession);
    }
  }

  /**
   * 특수 분리독립 이벤트 처리 (엘 파실, 이제를론 공화국 등)
   */
  private async handleSpecialSecessionEvents(secession: Secession): Promise<void> {
    const specialPlanets = ['el_facil', 'el-facil', 'iserlohn', 'izerlohn'];
    
    const hasSpecialPlanet = secession.targetPlanetIds.some(
      id => specialPlanets.includes(id.toLowerCase())
    );

    if (hasSpecialPlanet) {
      const eventName = secession.targetPlanetIds.find(
        id => specialPlanets.includes(id.toLowerCase())
      );

      this.emit('SPECIAL_SECESSION_EVENT', {
        sessionId: secession.sessionId,
        eventName: eventName?.toUpperCase() + '_INDEPENDENCE',
        secession,
      });

      logger.info(`[SecessionService] Special secession event triggered: ${eventName}`);
    }
  }

  /**
   * 분리독립 전체 프로세스 실행
   * prepareSecession → declareIndependence를 거친 후 성공 시 호출
   */
  public async executeSecession(
    sessionId: string,
    secessionId: string,
  ): Promise<SecessionResult> {
    const secession = this.secessions.get(secessionId);
    if (!secession || secession.sessionId !== sessionId) {
      return { success: false, error: '분리독립 정보를 찾을 수 없습니다.' };
    }

    if (secession.status !== SecessionStatus.DECLARED && secession.status !== SecessionStatus.ACTIVE) {
      return { success: false, error: '분리독립이 선언되지 않았습니다.' };
    }

    try {
      // 1. 새 세력 생성
      const newFaction = await this.createNewFaction({
        sessionId,
        factionId: secession.newFactionId || `IND-${Date.now()}`,
        name: secession.newFactionName || 'Independent State',
        nameKo: secession.newFactionName || '독립 세력',
        type: 'rebel',
        leaderId: secession.leaderCharacterId,
        leaderName: secession.leaderName,
        initialPlanets: secession.targetPlanetIds,
        initialFleets: [],
        initialCharacters: [secession.leaderCharacterId],
      });

      if (!newFaction) {
        return { success: false, error: '새 세력 생성에 실패했습니다.' };
      }

      // 2. 함대 조회 및 이전
      const fleets = await this.findFleetsForSecession(
        sessionId,
        secession.targetPlanetIds,
        secession.targetSystemId
      );
      const fleetIds = fleets.map(f => f.fleetId);

      // 3. 자산 이전
      const transferResult = await this.transferAssetsToNewFaction(
        sessionId,
        newFaction.factionId,
        {
          planetIds: secession.targetPlanetIds,
          fleetIds,
          characterIds: [secession.leaderCharacterId],
        }
      );

      if (!transferResult.success) {
        return { success: false, error: '자산 이전에 실패했습니다.' };
      }

      // 4. 관계 설정
      await this.establishPostSecessionRelations(
        sessionId,
        newFaction.factionId,
        secession.originFaction.toLowerCase() as 'empire' | 'alliance',
        'WAR'
      );

      // 5. 상태 업데이트
      secession.newFactionId = newFaction.factionId;
      secession.result = 'SUCCESS';
      secession.status = SecessionStatus.RESOLVED;
      secession.resolvedAt = new Date();

      // 6. 이벤트 기록
      await this.recordSecessionEvent(sessionId, secession, 'SUCCESS');

      logger.info(`[SecessionService] Secession executed successfully: ${secessionId}`);

      return { success: true, secession };
    } catch (error: any) {
      logger.error(`[SecessionService] Error executing secession: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 세력 색상 생성 (랜덤)
   */
  private generateFactionColor(): string {
    const colors = [
      '#8B0000', // Dark Red
      '#006400', // Dark Green
      '#00008B', // Dark Blue
      '#8B008B', // Dark Magenta
      '#FF8C00', // Dark Orange
      '#2F4F4F', // Dark Slate Gray
      '#800080', // Purple
      '#008080', // Teal
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 세션의 모든 분리독립 정보 초기화 (테스트/리셋용)
   */
  public clearSessionSecessions(sessionId: string): void {
    const toDelete: string[] = [];
    for (const [id, secession] of this.secessions) {
      if (secession.sessionId === sessionId) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      this.secessions.delete(id);
    }
    logger.info(`[SecessionService] Cleared ${toDelete.length} secessions for session ${sessionId}`);
  }
}

export const secessionService = SecessionService.getInstance();
export default SecessionService;

