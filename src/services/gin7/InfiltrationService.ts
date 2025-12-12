/**
 * InfiltrationService - 잠입 미션 관리 서비스
 * 매뉴얼 5460-5574행 기반 확장
 *
 * 잠입 공작원의 미션 계획, 실행, 발각 처리 등을 관리합니다.
 *
 * 미션 타입:
 * - RECONNAISSANCE: 정찰 - 적 정보 수집
 * - SABOTAGE: 파괴 - 시설/장비 파괴
 * - ASSASSINATION: 암살 - 핵심 인물 제거
 * - EXTRACTION: 추출 - 아군/자산 구출
 * - THEFT: 절취 - 기밀 문서/기술 탈취
 * - PROPAGANDA: 선전 - 여론 조작/선동
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

// ============================================================
// 타입 정의
// ============================================================

/**
 * 잠입 미션 타입
 */
export enum InfiltrationMissionType {
  RECONNAISSANCE = 'RECONNAISSANCE',   // 정찰 - 적 정보 수집
  SABOTAGE = 'SABOTAGE',               // 파괴 - 시설/장비 파괴
  ASSASSINATION = 'ASSASSINATION',     // 암살 - 핵심 인물 제거
  EXTRACTION = 'EXTRACTION',           // 추출 - 아군/자산 구출
  THEFT = 'THEFT',                     // 절취 - 기밀 문서/기술 탈취
  PROPAGANDA = 'PROPAGANDA',           // 선전 - 여론 조작/선동
}

/**
 * 미션 진행 단계
 */
export enum MissionPhase {
  PLANNING = 'PLANNING',           // 계획 수립 단계
  INFILTRATION = 'INFILTRATION',   // 잠입 진행 중
  EXECUTION = 'EXECUTION',         // 목표 실행 중
  EXTRACTION = 'EXTRACTION',       // 탈출 진행 중
  COMPLETED = 'COMPLETED',         // 미션 완료
  FAILED = 'FAILED',               // 미션 실패
}

/**
 * 미션 난이도
 */
export enum MissionDifficulty {
  EASY = 'EASY',           // 쉬움 - 성공률 높음
  NORMAL = 'NORMAL',       // 보통
  HARD = 'HARD',           // 어려움
  EXTREME = 'EXTREME',     // 극한 - 성공률 낮음
}

/**
 * 발각 수준
 */
export enum DiscoveryLevel {
  UNDETECTED = 'UNDETECTED',       // 미발각
  SUSPECTED = 'SUSPECTED',         // 의심받음
  DETECTED = 'DETECTED',           // 발각됨
  IDENTIFIED = 'IDENTIFIED',       // 신원 확인됨
  CAPTURED = 'CAPTURED',           // 체포됨
}

/**
 * 잠입 미션 정보
 */
export interface InfiltrationMission {
  missionId: string;
  sessionId: string;
  type: InfiltrationMissionType;
  phase: MissionPhase;
  difficulty: MissionDifficulty;

  // 미션 참여자
  operativeId: string;             // 공작원 ID
  operativeName: string;
  faction: string;                 // 소속 진영

  // 목표 정보
  targetFaction: string;           // 대상 진영
  targetPlanetId: string;          // 대상 행성
  targetFacilityId?: string;       // 대상 시설 (선택적)
  targetCharacterId?: string;      // 대상 인물 (암살/추출 시)
  targetAssetId?: string;          // 대상 자산 (절취 시)

  // 미션 상태
  discoveryLevel: DiscoveryLevel;
  discoveryRisk: number;           // 발각 위험도 (0-100)
  progressPercent: number;         // 진행률 (0-100)

  // 시간 정보
  plannedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration: number;       // 예상 소요 시간 (시간 단위)

  // 결과
  success?: boolean;
  resultDetails?: string;
  acquiredIntel?: string[];        // 획득 정보 (정찰 시)
  casualtyCount?: number;          // 피해 (실패 시)
}

/**
 * 미션 계획 요청
 */
export interface MissionPlanRequest {
  sessionId: string;
  operativeId: string;
  type: InfiltrationMissionType;
  targetPlanetId: string;
  targetFacilityId?: string;
  targetCharacterId?: string;
  targetAssetId?: string;
}

/**
 * 미션 결과
 */
export interface MissionResult {
  success: boolean;
  missionId?: string;
  phase?: MissionPhase;
  message: string;
  discoveryRiskChange?: number;
  acquiredIntel?: string[];
  consequences?: string[];
}

// ============================================================
// 미션 타입별 기본 설정
// ============================================================

const MISSION_TYPE_CONFIG: Record<InfiltrationMissionType, {
  baseDuration: number;          // 기본 소요 시간 (시간)
  baseSuccessRate: number;       // 기본 성공률
  baseDiscoveryRisk: number;     // 기본 발각 위험도
  requiredIntelligence: number;  // 필요 정보력
}> = {
  [InfiltrationMissionType.RECONNAISSANCE]: {
    baseDuration: 24,
    baseSuccessRate: 0.7,
    baseDiscoveryRisk: 20,
    requiredIntelligence: 50,
  },
  [InfiltrationMissionType.SABOTAGE]: {
    baseDuration: 48,
    baseSuccessRate: 0.5,
    baseDiscoveryRisk: 40,
    requiredIntelligence: 60,
  },
  [InfiltrationMissionType.ASSASSINATION]: {
    baseDuration: 72,
    baseSuccessRate: 0.3,
    baseDiscoveryRisk: 60,
    requiredIntelligence: 80,
  },
  [InfiltrationMissionType.EXTRACTION]: {
    baseDuration: 36,
    baseSuccessRate: 0.5,
    baseDiscoveryRisk: 50,
    requiredIntelligence: 65,
  },
  [InfiltrationMissionType.THEFT]: {
    baseDuration: 24,
    baseSuccessRate: 0.6,
    baseDiscoveryRisk: 35,
    requiredIntelligence: 70,
  },
  [InfiltrationMissionType.PROPAGANDA]: {
    baseDuration: 48,
    baseSuccessRate: 0.6,
    baseDiscoveryRisk: 30,
    requiredIntelligence: 55,
  },
};

const DIFFICULTY_MODIFIER: Record<MissionDifficulty, {
  successMod: number;
  discoveryMod: number;
  durationMod: number;
}> = {
  [MissionDifficulty.EASY]: { successMod: 1.3, discoveryMod: 0.7, durationMod: 0.8 },
  [MissionDifficulty.NORMAL]: { successMod: 1.0, discoveryMod: 1.0, durationMod: 1.0 },
  [MissionDifficulty.HARD]: { successMod: 0.7, discoveryMod: 1.3, durationMod: 1.2 },
  [MissionDifficulty.EXTREME]: { successMod: 0.5, discoveryMod: 1.5, durationMod: 1.5 },
};

// ============================================================
// InfiltrationService 클래스
// ============================================================

export class InfiltrationService extends EventEmitter {
  private static instance: InfiltrationService;
  private missions: Map<string, InfiltrationMission[]> = new Map(); // sessionId -> missions

  private constructor() {
    super();
    logger.info('[InfiltrationService] Initialized');
  }

  public static getInstance(): InfiltrationService {
    if (!InfiltrationService.instance) {
      InfiltrationService.instance = new InfiltrationService();
    }
    return InfiltrationService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.missions.set(sessionId, []);
    logger.info(`[InfiltrationService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.missions.delete(sessionId);
    logger.info(`[InfiltrationService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 미션 계획 (planMission)
  // ============================================================

  /**
   * 미션 계획 수립
   */
  public async planMission(request: MissionPlanRequest): Promise<MissionResult> {
    const { sessionId, operativeId, type, targetPlanetId } = request;

    try {
      // 공작원 검증
      const operative = await Gin7Character.findOne({ sessionId, characterId: operativeId });
      if (!operative) {
        return { success: false, message: '공작원을 찾을 수 없습니다.' };
      }

      // 대상 행성 검증
      const targetPlanet = await Planet.findOne({ sessionId, planetId: targetPlanetId });
      if (!targetPlanet) {
        return { success: false, message: '대상 행성을 찾을 수 없습니다.' };
      }

      // 정보력 요건 확인
      const config = MISSION_TYPE_CONFIG[type];
      const operativeIntelligence = operative.stats?.intellect || 50;
      if (operativeIntelligence < config.requiredIntelligence) {
        return {
          success: false,
          message: `정보력이 부족합니다. 필요: ${config.requiredIntelligence}, 현재: ${operativeIntelligence}`,
        };
      }

      // 난이도 결정 (대상 행성 방어력 기반)
      const difficulty = this.calculateMissionDifficulty(targetPlanet, type);
      const diffMod = DIFFICULTY_MODIFIER[difficulty];

      // 미션 생성
      const mission: InfiltrationMission = {
        missionId: `INF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        type,
        phase: MissionPhase.PLANNING,
        difficulty,
        operativeId,
        operativeName: operative.name,
        faction: operative.faction,
        targetFaction: targetPlanet.faction || 'unknown',
        targetPlanetId,
        targetFacilityId: request.targetFacilityId,
        targetCharacterId: request.targetCharacterId,
        targetAssetId: request.targetAssetId,
        discoveryLevel: DiscoveryLevel.UNDETECTED,
        discoveryRisk: Math.round(config.baseDiscoveryRisk * diffMod.discoveryMod),
        progressPercent: 0,
        plannedAt: new Date(),
        estimatedDuration: Math.round(config.baseDuration * diffMod.durationMod),
      };

      // 미션 저장
      if (!this.missions.has(sessionId)) {
        this.missions.set(sessionId, []);
      }
      this.missions.get(sessionId)!.push(mission);

      this.emit('infiltration:mission_planned', { sessionId, mission });
      logger.info(`[InfiltrationService] Mission ${mission.missionId} planned by ${operative.name}`);

      return {
        success: true,
        missionId: mission.missionId,
        phase: MissionPhase.PLANNING,
        message: `미션 계획이 수립되었습니다. 예상 소요 시간: ${mission.estimatedDuration}시간`,
      };
    } catch (error) {
      logger.error('[InfiltrationService] Plan mission error:', error);
      return { success: false, message: '미션 계획 중 오류가 발생했습니다.' };
    }
  }

  // ============================================================
  // 미션 시작 (startMission)
  // ============================================================

  /**
   * 미션 시작 (잠입 개시)
   */
  public async startMission(
    sessionId: string,
    missionId: string,
  ): Promise<MissionResult> {
    const mission = this.getMission(sessionId, missionId);
    if (!mission) {
      return { success: false, message: '미션을 찾을 수 없습니다.' };
    }

    if (mission.phase !== MissionPhase.PLANNING) {
      return { success: false, message: `현재 단계(${mission.phase})에서는 미션을 시작할 수 없습니다.` };
    }

    try {
      // 공작원 상태 확인
      const operative = await Gin7Character.findOne({
        sessionId,
        characterId: mission.operativeId,
      });

      if (!operative) {
        return { success: false, message: '공작원을 찾을 수 없습니다.' };
      }

      // 잠입 시작
      mission.phase = MissionPhase.INFILTRATION;
      mission.startedAt = new Date();
      mission.progressPercent = 0;

      // 초기 발각 체크
      const initialDiscovery = this.checkDiscovery(sessionId, missionId);
      if (initialDiscovery.discovered) {
        mission.discoveryLevel = DiscoveryLevel.SUSPECTED;
        mission.discoveryRisk += 10;
      }

      this.emit('infiltration:mission_started', { sessionId, mission });
      logger.info(`[InfiltrationService] Mission ${missionId} started`);

      return {
        success: true,
        missionId,
        phase: MissionPhase.INFILTRATION,
        message: '잠입을 시작했습니다.',
        discoveryRiskChange: initialDiscovery.discovered ? 10 : 0,
      };
    } catch (error) {
      logger.error('[InfiltrationService] Start mission error:', error);
      return { success: false, message: '미션 시작 중 오류가 발생했습니다.' };
    }
  }

  // ============================================================
  // 미션 실행 (executeMission)
  // ============================================================

  /**
   * 미션 실행 (목표 수행)
   */
  public async executeMission(
    sessionId: string,
    missionId: string,
  ): Promise<MissionResult> {
    const mission = this.getMission(sessionId, missionId);
    if (!mission) {
      return { success: false, message: '미션을 찾을 수 없습니다.' };
    }

    if (mission.phase !== MissionPhase.INFILTRATION) {
      return { success: false, message: `현재 단계(${mission.phase})에서는 미션을 실행할 수 없습니다.` };
    }

    try {
      // 발각 체크
      const discoveryCheck = this.checkDiscovery(sessionId, missionId);
      if (discoveryCheck.discovered && discoveryCheck.level === DiscoveryLevel.CAPTURED) {
        return this.handleDiscovery(sessionId, missionId, DiscoveryLevel.CAPTURED);
      }

      // 미션 실행 단계로 전환
      mission.phase = MissionPhase.EXECUTION;

      // 성공률 계산
      const operative = await Gin7Character.findOne({
        sessionId,
        characterId: mission.operativeId,
      });

      const config = MISSION_TYPE_CONFIG[mission.type];
      const diffMod = DIFFICULTY_MODIFIER[mission.difficulty];
      const intelligenceBonus = ((operative?.stats?.intellect || 50) - 50) / 100;
      const successRate = Math.min(0.95, config.baseSuccessRate * diffMod.successMod + intelligenceBonus);

      // 미션 성공 여부 판정
      const success = Math.random() < successRate;

      if (success) {
        mission.progressPercent = 100;

        // 미션 타입별 결과 처리
        const results = await this.processMissionSuccess(sessionId, mission);
        mission.acquiredIntel = results.acquiredIntel;
        mission.resultDetails = results.details;

        // 탈출 단계로 전환
        mission.phase = MissionPhase.EXTRACTION;

        this.emit('infiltration:mission_executed', { sessionId, mission, success: true });
        logger.info(`[InfiltrationService] Mission ${missionId} execution successful`);

        return {
          success: true,
          missionId,
          phase: MissionPhase.EXTRACTION,
          message: '미션 목표를 완수했습니다. 탈출을 준비하세요.',
          acquiredIntel: results.acquiredIntel,
          discoveryRiskChange: 20,
        };
      } else {
        // 미션 실패 처리
        mission.discoveryRisk += 30;

        // 발각 확률 증가
        if (Math.random() < 0.5) {
          return this.handleDiscovery(sessionId, missionId, DiscoveryLevel.DETECTED);
        }

        this.emit('infiltration:mission_executed', { sessionId, mission, success: false });

        return {
          success: false,
          missionId,
          phase: mission.phase,
          message: '미션 실행에 실패했습니다.',
          discoveryRiskChange: 30,
        };
      }
    } catch (error) {
      logger.error('[InfiltrationService] Execute mission error:', error);
      return { success: false, message: '미션 실행 중 오류가 발생했습니다.' };
    }
  }

  // ============================================================
  // 발각 체크 (checkDiscovery)
  // ============================================================

  /**
   * 발각 여부 체크
   */
  public checkDiscovery(
    sessionId: string,
    missionId: string,
  ): { discovered: boolean; level?: DiscoveryLevel } {
    const mission = this.getMission(sessionId, missionId);
    if (!mission) {
      return { discovered: false };
    }

    // 발각 위험도 기반 확률 계산
    const discoveryChance = mission.discoveryRisk / 100;
    const roll = Math.random();

    if (roll < discoveryChance * 0.3) {
      // 완전 발각 (체포)
      return { discovered: true, level: DiscoveryLevel.CAPTURED };
    } else if (roll < discoveryChance * 0.6) {
      // 신원 확인됨
      return { discovered: true, level: DiscoveryLevel.IDENTIFIED };
    } else if (roll < discoveryChance * 0.8) {
      // 발각됨 (정체 미확인)
      return { discovered: true, level: DiscoveryLevel.DETECTED };
    } else if (roll < discoveryChance) {
      // 의심받음
      return { discovered: true, level: DiscoveryLevel.SUSPECTED };
    }

    return { discovered: false };
  }

  // ============================================================
  // 발각 처리 (handleDiscovery)
  // ============================================================

  /**
   * 발각 시 처리
   */
  public async handleDiscovery(
    sessionId: string,
    missionId: string,
    level: DiscoveryLevel,
  ): Promise<MissionResult> {
    const mission = this.getMission(sessionId, missionId);
    if (!mission) {
      return { success: false, message: '미션을 찾을 수 없습니다.' };
    }

    mission.discoveryLevel = level;

    const consequences: string[] = [];

    switch (level) {
      case DiscoveryLevel.SUSPECTED:
        // 의심 - 발각 위험도 증가
        mission.discoveryRisk += 15;
        consequences.push('공작원에 대한 의심이 높아졌습니다.');
        break;

      case DiscoveryLevel.DETECTED:
        // 발각 - 미션 난이도 증가, 경비 강화
        mission.discoveryRisk += 25;
        consequences.push('침입자가 탐지되었습니다. 경비가 강화됩니다.');
        break;

      case DiscoveryLevel.IDENTIFIED:
        // 신원 확인 - 외교 문제, 공작원 위험
        mission.discoveryRisk += 40;
        consequences.push('공작원의 신원이 확인되었습니다.');
        consequences.push('외교적 문제가 발생할 수 있습니다.');
        break;

      case DiscoveryLevel.CAPTURED:
        // 체포 - 미션 실패, 공작원 구금
        mission.phase = MissionPhase.FAILED;
        mission.success = false;
        mission.completedAt = new Date();
        mission.resultDetails = '공작원이 체포되었습니다.';
        consequences.push('공작원이 체포되어 구금되었습니다.');
        consequences.push('미션이 실패했습니다.');
        consequences.push('심문을 통해 기밀이 노출될 수 있습니다.');

        // 공작원 상태 업데이트
        await Gin7Character.updateOne(
          { sessionId, characterId: mission.operativeId },
          {
            $set: {
              status: 'DETAINED',
              'detentionDetails.detainedBy': mission.targetFaction,
              'detentionDetails.reason': '첩보 활동 중 체포',
              'detentionDetails.detainedAt': new Date(),
            },
          },
        );

        this.emit('infiltration:operative_captured', {
          sessionId,
          mission,
          operativeId: mission.operativeId,
        });
        break;
    }

    this.emit('infiltration:discovery', {
      sessionId,
      missionId,
      level,
      consequences,
    });

    logger.warn(`[InfiltrationService] Mission ${missionId} discovery: ${level}`);

    return {
      success: level !== DiscoveryLevel.CAPTURED,
      missionId,
      phase: mission.phase,
      message: level === DiscoveryLevel.CAPTURED
        ? '공작원이 체포되었습니다. 미션 실패.'
        : `발각 수준: ${level}`,
      consequences,
    };
  }

  // ============================================================
  // 미션 완료 (탈출 성공)
  // ============================================================

  /**
   * 미션 완료 처리 (탈출 성공 시 호출)
   */
  public async completeMission(
    sessionId: string,
    missionId: string,
  ): Promise<MissionResult> {
    const mission = this.getMission(sessionId, missionId);
    if (!mission) {
      return { success: false, message: '미션을 찾을 수 없습니다.' };
    }

    if (mission.phase !== MissionPhase.EXTRACTION) {
      return { success: false, message: '탈출 단계에서만 미션을 완료할 수 있습니다.' };
    }

    // 탈출 성공 확률 계산
    const escapeChance = Math.max(0.3, 0.9 - (mission.discoveryRisk / 100));
    const escaped = Math.random() < escapeChance;

    if (escaped) {
      mission.phase = MissionPhase.COMPLETED;
      mission.success = true;
      mission.completedAt = new Date();

      this.emit('infiltration:mission_completed', { sessionId, mission });
      logger.info(`[InfiltrationService] Mission ${missionId} completed successfully`);

      return {
        success: true,
        missionId,
        phase: MissionPhase.COMPLETED,
        message: '미션을 성공적으로 완료하고 안전하게 탈출했습니다.',
        acquiredIntel: mission.acquiredIntel,
      };
    } else {
      // 탈출 실패 - 체포
      return this.handleDiscovery(sessionId, missionId, DiscoveryLevel.CAPTURED);
    }
  }

  // ============================================================
  // 유틸리티 메서드
  // ============================================================

  private getMission(sessionId: string, missionId: string): InfiltrationMission | undefined {
    return this.missions.get(sessionId)?.find(m => m.missionId === missionId);
  }

  private calculateMissionDifficulty(planet: any, type: InfiltrationMissionType): MissionDifficulty {
    // 행성 방어력/보안 수준 기반 난이도 계산
    const securityLevel = planet.security || 50;
    const population = planet.population || 1000000;

    let difficultyScore = securityLevel;

    // 미션 타입별 보정
    if (type === InfiltrationMissionType.ASSASSINATION) {
      difficultyScore += 20;
    } else if (type === InfiltrationMissionType.PROPAGANDA) {
      difficultyScore -= 10;
    }

    // 인구 기반 보정
    if (population > 10000000) difficultyScore += 10;
    if (population < 100000) difficultyScore -= 10;

    // 난이도 결정
    if (difficultyScore < 30) return MissionDifficulty.EASY;
    if (difficultyScore < 50) return MissionDifficulty.NORMAL;
    if (difficultyScore < 70) return MissionDifficulty.HARD;
    return MissionDifficulty.EXTREME;
  }

  private async processMissionSuccess(
    sessionId: string,
    mission: InfiltrationMission,
  ): Promise<{ acquiredIntel?: string[]; details: string }> {
    switch (mission.type) {
      case InfiltrationMissionType.RECONNAISSANCE:
        // 정보 수집 결과
        const intel = [
          `${mission.targetPlanetId} 군사 배치 정보`,
          `${mission.targetPlanetId} 방어 시설 현황`,
          `${mission.targetPlanetId} 경비 일정`,
        ];
        return { acquiredIntel: intel, details: '정찰 임무 완료. 정보 수집 성공.' };

      case InfiltrationMissionType.SABOTAGE:
        return { details: '파괴 공작 완료. 대상 시설에 손상을 입혔습니다.' };

      case InfiltrationMissionType.ASSASSINATION:
        return { details: '암살 임무 완료. 대상 제거 확인.' };

      case InfiltrationMissionType.EXTRACTION:
        return { details: '추출 임무 완료. 대상을 안전하게 확보했습니다.' };

      case InfiltrationMissionType.THEFT:
        const stolenData = [
          '기밀 작전 계획서',
          '암호 해독 키',
          '인사 정보 목록',
        ];
        return { acquiredIntel: stolenData, details: '절취 임무 완료. 기밀 자료 확보.' };

      case InfiltrationMissionType.PROPAGANDA:
        return { details: '선전 공작 완료. 여론 조작에 성공했습니다.' };

      default:
        return { details: '미션 완료.' };
    }
  }

  // ============================================================
  // 조회 메서드
  // ============================================================

  public getMissions(sessionId: string): InfiltrationMission[] {
    return this.missions.get(sessionId) || [];
  }

  public getMissionsByOperative(sessionId: string, operativeId: string): InfiltrationMission[] {
    return (this.missions.get(sessionId) || [])
      .filter(m => m.operativeId === operativeId);
  }

  public getActiveMissions(sessionId: string): InfiltrationMission[] {
    return (this.missions.get(sessionId) || [])
      .filter(m => ![MissionPhase.COMPLETED, MissionPhase.FAILED].includes(m.phase));
  }

  public getMissionsByFaction(sessionId: string, faction: string): InfiltrationMission[] {
    return (this.missions.get(sessionId) || [])
      .filter(m => m.faction === faction);
  }

  /**
   * 게임 틱 처리 - 진행 중인 미션 업데이트
   */
  public processGameTick(sessionId: string): void {
    const missions = this.missions.get(sessionId);
    if (!missions) return;

    for (const mission of missions) {
      if (mission.phase === MissionPhase.INFILTRATION ||
          mission.phase === MissionPhase.EXECUTION) {
        // 시간 경과에 따른 발각 위험 증가
        mission.discoveryRisk = Math.min(100, mission.discoveryRisk + 1);

        // 주기적 발각 체크
        if (Math.random() < mission.discoveryRisk / 200) {
          const discovery = this.checkDiscovery(sessionId, mission.missionId);
          if (discovery.discovered && discovery.level) {
            this.handleDiscovery(sessionId, mission.missionId, discovery.level);
          }
        }
      }
    }
  }
}

export const infiltrationService = InfiltrationService.getInstance();
export default InfiltrationService;







