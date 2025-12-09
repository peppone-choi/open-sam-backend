/**
 * CoupService - 쿠데타 및 반란 시스템 서비스
 * 매뉴얼 4972~5022행 기반
 * 
 * 주요 기능:
 * - 쿠데타 수괴 등록 (반의)
 * - 참가자 모집 (모의)
 * - 부대 충성도 조작 (설득)
 * - 쿠데타 실행 (반란)
 * - 탐지 및 진압
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';
import {
  CoupStatus,
  CoupRole,
  COUP_CONSTANTS,
  calculateCoupSuccessChance,
  calculateConspiracySuccessChance,
  calculateArrestSuccessChance,
} from '../../constants/gin7/operation_definitions';

/**
 * 쿠데타 참가자 정보
 */
export interface CoupParticipant {
  characterId: string;
  role: CoupRole;
  joinedAt: Date;
  unitLoyalty: number;        // 소속 부대의 반란 충성도 (0-100)
}

/**
 * 쿠데타 정보
 */
export interface Coup {
  coupId: string;
  sessionId: string;
  status: CoupStatus;
  
  // 수괴 정보
  mastermindId: string;
  targetPlanetId: string;     // 대상 행성/요새 ID
  
  // 참가자
  participants: CoupParticipant[];
  
  // 진행 정보
  plannedAt: Date;
  uprisingAt?: Date;          // 봉기 시각
  resolvedAt?: Date;          // 종료 시각
  
  // 결과
  resultDetails?: string;
}

/**
 * 쿠데타 실행 결과
 */
export interface CoupResult {
  success: boolean;
  error?: string;
  coup?: Coup;
  cpCost?: number;
}

/**
 * CoupService 클래스
 */
export class CoupService extends EventEmitter {
  private static instance: CoupService;
  
  // 메모리 내 쿠데타 저장소
  private coups: Map<string, Coup> = new Map();
  // 캐릭터별 쿠데타 참여 현황
  private characterCoups: Map<string, string> = new Map(); // characterId -> coupId

  private constructor() {
    super();
    logger.info('[CoupService] Initialized');
  }

  public static getInstance(): CoupService {
    if (!CoupService.instance) {
      CoupService.instance = new CoupService();
    }
    return CoupService.instance;
  }

  /**
   * 반의 (쿠데타 수괴 등록)
   */
  public async initiateRebellion(
    sessionId: string,
    mastermindId: string,
    targetPlanetId: string
  ): Promise<CoupResult> {
    try {
      // 이미 쿠데타 참여 중인지 확인
      if (this.characterCoups.has(mastermindId)) {
        return { success: false, error: '이미 다른 쿠데타에 참여 중입니다.' };
      }

      // 수괴 캐릭터 확인
      const mastermind = await Gin7Character.findOne({ sessionId, characterId: mastermindId });
      if (!mastermind) {
        return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
      }

      // 같은 행성에 대한 진행 중인 쿠데타 확인
      const existingCoup = Array.from(this.coups.values()).find(
        c => c.sessionId === sessionId &&
          c.targetPlanetId === targetPlanetId &&
          c.status !== CoupStatus.SUCCESS &&
          c.status !== CoupStatus.FAILURE &&
          c.status !== CoupStatus.SUPPRESSED
      );

      if (existingCoup) {
        return { success: false, error: '해당 행성에 이미 진행 중인 쿠데타가 있습니다.' };
      }

      // 쿠데타 생성
      const coupId = `COUP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date();

      const coup: Coup = {
        coupId,
        sessionId,
        status: CoupStatus.PLOTTING,
        mastermindId,
        targetPlanetId,
        participants: [{
          characterId: mastermindId,
          role: CoupRole.MASTERMIND,
          joinedAt: now,
          unitLoyalty: 50, // 초기 충성도
        }],
        plannedAt: now,
      };

      this.coups.set(coupId, coup);
      this.characterCoups.set(mastermindId, coupId);

      // 이벤트 발생
      this.emit('COUP_INITIATED', {
        sessionId,
        coupId,
        mastermindId,
        targetPlanetId,
      });

      logger.info(`[CoupService] Coup initiated: ${coupId} by ${mastermindId} targeting ${targetPlanetId}`);

      return {
        success: true,
        coup,
        cpCost: COUP_CONSTANTS.MASTERMIND_CP_COST,
      };
    } catch (error: any) {
      logger.error(`[CoupService] Error initiating rebellion: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 모의 (참가자 포섭)
   */
  public async conspiracy(
    sessionId: string,
    recruiterId: string,
    targetId: string
  ): Promise<CoupResult> {
    try {
      // 포섭자가 참여 중인 쿠데타 확인
      const coupId = this.characterCoups.get(recruiterId);
      if (!coupId) {
        return { success: false, error: '참여 중인 쿠데타가 없습니다.' };
      }

      const coup = this.coups.get(coupId);
      if (!coup || coup.sessionId !== sessionId) {
        return { success: false, error: '쿠데타를 찾을 수 없습니다.' };
      }

      // 수괴만 모의 가능
      if (coup.mastermindId !== recruiterId) {
        return { success: false, error: '수괴만 참가자를 포섭할 수 있습니다.' };
      }

      // 대상자 확인
      if (this.characterCoups.has(targetId)) {
        return { success: false, error: '대상자가 이미 다른 쿠데타에 참여 중입니다.' };
      }

      const recruiter = await Gin7Character.findOne({ sessionId, characterId: recruiterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!recruiter || !target) {
        return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
      }

      // 같은 스팟에 있는지 확인
      const sameLocation = recruiter.location?.facilityId === target.location?.facilityId &&
        recruiter.location?.roomId === target.location?.roomId;

      if (!sameLocation) {
        return { success: false, error: '같은 장소에 있어야 모의할 수 있습니다.' };
      }

      // 성공 확률 계산
      const successChance = calculateConspiracySuccessChance(
        recruiter.stats?.charm || 50,
        recruiter.influence || 0,
        target.stats?.charm || 50,
        target.loyalty || 50  // 현 체제 충성도
      );

      const roll = Math.random() * 100;
      const isSuccess = roll < successChance;

      if (isSuccess) {
        // 참가자 추가
        coup.participants.push({
          characterId: targetId,
          role: CoupRole.CONSPIRATOR,
          joinedAt: new Date(),
          unitLoyalty: 50,
        });
        coup.status = CoupStatus.RECRUITING;

        this.characterCoups.set(targetId, coupId);

        this.emit('CONSPIRACY_SUCCESS', {
          sessionId,
          coupId,
          recruiterId,
          targetId,
        });

        logger.info(`[CoupService] Conspiracy success: ${targetId} joined coup ${coupId}`);
      } else {
        // 실패 시 발각 위험
        const discoveryRoll = Math.random() * 100;
        if (discoveryRoll < 20) {
          // 발각됨
          this.emit('CONSPIRACY_DISCOVERED', {
            sessionId,
            coupId,
            recruiterId,
            targetId,
          });

          logger.info(`[CoupService] Conspiracy discovered: ${recruiterId} exposed by ${targetId}`);
        }
      }

      return {
        success: isSuccess,
        coup,
        cpCost: COUP_CONSTANTS.CONSPIRACY_CP_COST,
        error: isSuccess ? undefined : '포섭에 실패했습니다.',
      };
    } catch (error: any) {
      logger.error(`[CoupService] Error in conspiracy: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 설득 (부대 반란 충성도 상승)
   */
  public async persuadeUnits(
    sessionId: string,
    persuaderId: string
  ): Promise<CoupResult> {
    try {
      const coupId = this.characterCoups.get(persuaderId);
      if (!coupId) {
        return { success: false, error: '참여 중인 쿠데타가 없습니다.' };
      }

      const coup = this.coups.get(coupId);
      if (!coup || coup.sessionId !== sessionId) {
        return { success: false, error: '쿠데타를 찾을 수 없습니다.' };
      }

      // 참가자 찾기
      const participant = coup.participants.find(p => p.characterId === persuaderId);
      if (!participant) {
        return { success: false, error: '쿠데타 참가자가 아닙니다.' };
      }

      // 충성도 증가
      const increase = COUP_CONSTANTS.PERSUASION_LOYALTY_INCREASE;
      participant.unitLoyalty = Math.min(100, participant.unitLoyalty + increase);

      this.emit('UNIT_PERSUADED', {
        sessionId,
        coupId,
        persuaderId,
        newLoyalty: participant.unitLoyalty,
      });

      logger.info(`[CoupService] Units persuaded: ${persuaderId} loyalty now ${participant.unitLoyalty}`);

      return {
        success: true,
        coup,
        cpCost: COUP_CONSTANTS.PERSUASION_CP_COST,
      };
    } catch (error: any) {
      logger.error(`[CoupService] Error in persuasion: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 반란 (쿠데타 실행)
   */
  public async executeUprising(
    sessionId: string,
    mastermindId: string,
    targetPlanetSupport: number  // 대상 행성의 정부 지지율
  ): Promise<CoupResult & { battleTriggered?: boolean }> {
    try {
      const coupId = this.characterCoups.get(mastermindId);
      if (!coupId) {
        return { success: false, error: '참여 중인 쿠데타가 없습니다.' };
      }

      const coup = this.coups.get(coupId);
      if (!coup || coup.sessionId !== sessionId) {
        return { success: false, error: '쿠데타를 찾을 수 없습니다.' };
      }

      if (coup.mastermindId !== mastermindId) {
        return { success: false, error: '수괴만 반란을 실행할 수 있습니다.' };
      }

      // 조건 확인
      if (coup.participants.length < COUP_CONSTANTS.MIN_CONSPIRATORS_FOR_UPRISING) {
        return {
          success: false,
          error: `최소 ${COUP_CONSTANTS.MIN_CONSPIRATORS_FOR_UPRISING}명의 참가자가 필요합니다.`,
        };
      }

      const avgLoyalty = coup.participants.reduce((sum, p) => sum + p.unitLoyalty, 0) / 
        coup.participants.length;

      if (avgLoyalty < COUP_CONSTANTS.MIN_LOYALTY_FOR_UPRISING) {
        return {
          success: false,
          error: `평균 부대 충성도가 ${COUP_CONSTANTS.MIN_LOYALTY_FOR_UPRISING}% 이상이어야 합니다.`,
        };
      }

      // 성공 확률 계산
      const mastermind = await Gin7Character.findOne({ sessionId, characterId: mastermindId });
      if (!mastermind) {
        return { success: false, error: '수괴를 찾을 수 없습니다.' };
      }

      const successChance = calculateCoupSuccessChance(
        mastermind.influence || 0,
        coup.participants.length,
        avgLoyalty,
        targetPlanetSupport
      );

      const roll = Math.random() * 100;
      const isSuccess = roll < successChance;

      coup.uprisingAt = new Date();

      if (isSuccess) {
        coup.status = CoupStatus.SUCCESS;
        coup.resolvedAt = new Date();
        coup.resultDetails = '쿠데타 성공. 정권 장악.';

        this.emit('COUP_SUCCESS', {
          sessionId,
          coupId,
          mastermindId,
          targetPlanetId: coup.targetPlanetId,
        });

        logger.info(`[CoupService] Coup successful: ${coupId}`);
      } else {
        coup.status = CoupStatus.ACTIVE;
        coup.resultDetails = '전투 발생. 진압군과 교전 중.';

        this.emit('COUP_BATTLE_STARTED', {
          sessionId,
          coupId,
          mastermindId,
          targetPlanetId: coup.targetPlanetId,
        });

        logger.info(`[CoupService] Coup battle started: ${coupId}`);
      }

      return {
        success: isSuccess,
        coup,
        cpCost: COUP_CONSTANTS.UPRISING_CP_COST,
        battleTriggered: !isSuccess,
      };
    } catch (error: any) {
      logger.error(`[CoupService] Error executing uprising: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 사열 (쿠데타 탐지)
   */
  public async inspect(
    sessionId: string,
    inspectorId: string,
    targetPlanetId: string
  ): Promise<{
    detected: boolean;
    discoveredParticipants: string[];
  }> {
    try {
      // 해당 행성의 쿠데타 찾기
      const coup = Array.from(this.coups.values()).find(
        c => c.sessionId === sessionId &&
          c.targetPlanetId === targetPlanetId &&
          c.status !== CoupStatus.SUCCESS &&
          c.status !== CoupStatus.FAILURE &&
          c.status !== CoupStatus.SUPPRESSED
      );

      if (!coup) {
        return { detected: false, discoveredParticipants: [] };
      }

      // 탐지 확률
      const baseChance = COUP_CONSTANTS.INSPECTION_DETECTION_BASE;
      const inspector = await Gin7Character.findOne({ sessionId, characterId: inspectorId });
      const intelligenceBonus = (inspector?.stats?.intellect || 50) / 5;
      const detectionChance = baseChance + intelligenceBonus;

      const roll = Math.random() * 100;
      const detected = roll < detectionChance;

      if (!detected) {
        return { detected: false, discoveredParticipants: [] };
      }

      // 일부 참가자 노출 (30% 확률로 각 참가자 노출)
      const discoveredParticipants = coup.participants
        .filter(() => Math.random() < 0.3)
        .map(p => p.characterId);

      this.emit('COUP_DETECTED', {
        sessionId,
        coupId: coup.coupId,
        inspectorId,
        discoveredParticipants,
      });

      logger.info(`[CoupService] Coup detected: ${coup.coupId}, discovered: ${discoveredParticipants.join(', ')}`);

      return { detected: true, discoveredParticipants };
    } catch (error: any) {
      logger.error(`[CoupService] Error in inspection: ${error.message}`);
      return { detected: false, discoveredParticipants: [] };
    }
  }

  /**
   * 체포
   */
  public async arrest(
    sessionId: string,
    arrestorId: string,
    targetId: string
  ): Promise<{
    success: boolean;
    coupSuppressed?: boolean;
    error?: string;
  }> {
    try {
      // 같은 위치 확인
      const arrestor = await Gin7Character.findOne({ sessionId, characterId: arrestorId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!arrestor || !target) {
        return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
      }

      const sameLocation = arrestor.location?.facilityId === target.location?.facilityId;

      // 체포 성공 확률
      const successChance = calculateArrestSuccessChance(
        arrestor.stats?.intellect || 50,
        target.stats?.intellect || 50,
        sameLocation
      );

      const roll = Math.random() * 100;
      const success = roll < successChance;

      if (!success) {
        return { success: false, error: '체포에 실패했습니다.' };
      }

      // 쿠데타 참여 중인지 확인
      const coupId = this.characterCoups.get(targetId);
      let coupSuppressed = false;

      if (coupId) {
        const coup = this.coups.get(coupId);
        if (coup) {
          // 참가자 제거
          coup.participants = coup.participants.filter(p => p.characterId !== targetId);
          this.characterCoups.delete(targetId);

          // 수괴 체포 시 쿠데타 진압
          if (coup.mastermindId === targetId) {
            coup.status = CoupStatus.SUPPRESSED;
            coup.resolvedAt = new Date();
            coup.resultDetails = '수괴 체포로 인한 진압';
            coupSuppressed = true;

            // 모든 참가자 쿠데타 참여 해제
            coup.participants.forEach(p => {
              this.characterCoups.delete(p.characterId);
            });

            this.emit('COUP_SUPPRESSED', {
              sessionId,
              coupId,
              arrestorId,
            });

            logger.info(`[CoupService] Coup suppressed: ${coupId} (mastermind arrested)`);
          }
        }
      }

      // 대상자 상태 변경 (ARRESTED)
      await Gin7Character.updateOne(
        { sessionId, characterId: targetId },
        { $set: { status: 'ARRESTED', arrestedBy: arrestorId, arrestedAt: new Date() } }
      );

      this.emit('CHARACTER_ARRESTED', {
        sessionId,
        arrestorId,
        targetId,
        coupRelated: !!coupId,
      });

      logger.info(`[CoupService] Character arrested: ${targetId} by ${arrestorId}`);

      return { success: true, coupSuppressed };
    } catch (error: any) {
      logger.error(`[CoupService] Error in arrest: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 쿠데타 조회
   */
  public getCoup(coupId: string): Coup | undefined {
    return this.coups.get(coupId);
  }

  /**
   * 캐릭터가 참여 중인 쿠데타 조회
   */
  public getCharacterCoup(characterId: string): Coup | undefined {
    const coupId = this.characterCoups.get(characterId);
    return coupId ? this.coups.get(coupId) : undefined;
  }

  /**
   * 세션의 활성 쿠데타 목록 조회
   */
  public getActiveCoups(sessionId: string): Coup[] {
    return Array.from(this.coups.values()).filter(
      c => c.sessionId === sessionId &&
        c.status !== CoupStatus.SUCCESS &&
        c.status !== CoupStatus.FAILURE &&
        c.status !== CoupStatus.SUPPRESSED
    );
  }

  // ============================================================
  // Command wrapper methods for PersonalCommandService
  // ============================================================

  /**
   * 쿠데타 시작 가능 여부 확인
   */
  public async canAttemptCoup(
    sessionId: string,
    characterId: string
  ): Promise<{ canAttempt: boolean; reason?: string }> {
    // 이미 쿠데타에 참여 중인지 확인
    const existingCoup = this.getCharacterCoup(characterId);
    if (existingCoup) {
      return { canAttempt: false, reason: '이미 쿠데타에 참여 중입니다.' };
    }
    // TODO: 추가 조건 검증 (직위, 세력 등)
    return { canAttempt: true };
  }

  /**
   * 쿠데타 시작 - initiateRebellion 래퍼
   */
  public async initiateCoup(
    sessionId: string,
    characterId: string,
    paramsOrFactionId?: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; coupId?: string }> {
    try {
      const targetFactionId = typeof paramsOrFactionId === 'string' 
        ? paramsOrFactionId 
        : (paramsOrFactionId?.targetFactionId || 'empire');
      const result = await this.initiateRebellion(sessionId, characterId, targetFactionId);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 포섭 시도 - persuadeUnits 래퍼
   */
  public async attemptPersuasion(
    sessionId: string,
    characterId: string,
    params?: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const result = await this.persuadeUnits(sessionId, characterId);
      return { success: result.success, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 쿠데타 실행 - executeUprising 래퍼
   */
  public async executeCoup(
    sessionId: string,
    characterId: string,
    params?: Record<string, any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const targetPlanetSupport = params?.targetPlanetSupport || 50;
      const result = await this.executeUprising(sessionId, characterId, targetPlanetSupport);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 쿠데타 참가 - conspiracy 래퍼
   * recruiterId (모집자)가 characterId (참가자)를 쿠데타에 합류시킴
   */
  public async joinCoup(
    sessionId: string,
    characterId: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      if (!params.recruiterId) {
        return { success: false, error: '모집자 ID가 필요합니다.' };
      }
      const result = await this.conspiracy(sessionId, params.recruiterId, characterId);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const coupService = CoupService.getInstance();
export default CoupService;
