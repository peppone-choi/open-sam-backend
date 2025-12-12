/**
 * PostWarJusticeService - 전후 처리 서비스
 * 내전 종결 후 포로 처리, 처형, 구금, 사면 관리
 *
 * 주요 기능:
 * - 포로 관리 (포획, 이송, 석방)
 * - 재판/심판 (군사재판, 인민재판)
 * - 판결 집행 (처형, 구금, 사면, 추방)
 * - 인물 상태 변경 (사망, 구금 상태 등)
 *
 * 원작 예시:
 * - 골든바움 황족 처리 (일부 처형, 일부 귀순)
 * - 트뤼니히트의 정치적 망명
 * - 양 웬리에 대한 사면
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

/**
 * 포로 상태
 */
export enum PrisonerStatus {
  CAPTURED = 'CAPTURED', // 포획됨
  DETAINED = 'DETAINED', // 구금 중
  TRIAL_PENDING = 'TRIAL_PENDING', // 재판 대기
  SENTENCED = 'SENTENCED', // 판결 완료
  RELEASED = 'RELEASED', // 석방됨
  EXECUTED = 'EXECUTED', // 처형됨
  EXILED = 'EXILED', // 추방됨
  PARDONED = 'PARDONED', // 사면됨
}

/**
 * 죄목 타입
 */
export enum ChargeType {
  TREASON = 'TREASON', // 반역죄
  REBELLION = 'REBELLION', // 반란죄
  SEDITION = 'SEDITION', // 내란죄
  DESERTION = 'DESERTION', // 탈영죄
  INSUBORDINATION = 'INSUBORDINATION', // 명령 불복종
  WAR_CRIMES = 'WAR_CRIMES', // 전쟁범죄
  CORRUPTION = 'CORRUPTION', // 부패/횡령
  POLITICAL = 'POLITICAL', // 정치범
}

/**
 * 판결 타입
 */
export enum VerdictType {
  EXECUTION = 'EXECUTION', // 처형
  LIFE_IMPRISONMENT = 'LIFE_IMPRISONMENT', // 종신형
  IMPRISONMENT = 'IMPRISONMENT', // 유기징역
  EXILE = 'EXILE', // 추방
  DEMOTION = 'DEMOTION', // 강등
  PARDON = 'PARDON', // 사면
  ACQUITTAL = 'ACQUITTAL', // 무죄
  NOT_PROSECUTED = 'NOT_PROSECUTED', // 불기소
}

/**
 * 포로 인터페이스
 */
export interface Prisoner {
  prisonerId: string;
  characterId: string;
  characterName: string;
  sessionId: string;

  // 포로 정보
  status: PrisonerStatus;
  captor: string; // 포획한 세력/인물
  capturedAt: Date;
  capturedLocation: string; // 포획 위치
  civilWarId?: string; // 연관 내전

  // 구금 정보
  detentionFacilityId?: string; // 구금 시설
  detentionPlanetId?: string; // 구금 행성

  // 혐의
  charges: Charge[];

  // 판결
  verdict?: Verdict;

  // 메타
  previousRank?: string;
  previousPosition?: string;
  notes?: string;
}

/**
 * 혐의 인터페이스
 */
export interface Charge {
  chargeId: string;
  type: ChargeType;
  description: string;
  filedAt: Date;
  filedBy: string; // 검찰/기소자
  evidence?: string[];
}

/**
 * 판결 인터페이스
 */
export interface Verdict {
  verdictId: string;
  type: VerdictType;
  sentence?: number; // 징역 기간 (년)
  issuedAt: Date;
  issuedBy: string; // 재판관/심판관
  executedAt?: Date;
  notes?: string;
}

/**
 * 재판 결과 인터페이스
 */
export interface TrialResult {
  success: boolean;
  error?: string;
  verdict?: Verdict;
  prisoner?: Prisoner;
}

/**
 * PostWarJusticeService 클래스
 */
export class PostWarJusticeService extends EventEmitter {
  private static instance: PostWarJusticeService;

  // 포로 저장소
  private prisoners: Map<string, Prisoner> = new Map();
  // 캐릭터별 포로 상태
  private characterPrisoners: Map<string, string> = new Map();

  private constructor() {
    super();
    logger.info('[PostWarJusticeService] Initialized');
  }

  public static getInstance(): PostWarJusticeService {
    if (!PostWarJusticeService.instance) {
      PostWarJusticeService.instance = new PostWarJusticeService();
    }
    return PostWarJusticeService.instance;
  }

  // ==================== 포로 관리 ====================

  /**
   * 인물 포획
   */
  public async capturePrisoner(
    sessionId: string,
    characterId: string,
    captor: string,
    capturedLocation: string,
    civilWarId?: string,
  ): Promise<Prisoner | null> {
    try {
      // 이미 포로인지 확인
      if (this.characterPrisoners.has(characterId)) {
        logger.warn('[PostWarJusticeService] Character already a prisoner', { characterId });
        return null;
      }

      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        logger.warn('[PostWarJusticeService] Character not found', { characterId });
        return null;
      }

      const prisonerId = `POW-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date();

      const prisoner: Prisoner = {
        prisonerId,
        characterId,
        characterName: character.name,
        sessionId,
        status: PrisonerStatus.CAPTURED,
        captor,
        capturedAt: now,
        capturedLocation,
        civilWarId,
        charges: [],
        previousRank: (character as any).currentRank?.id,
        previousPosition: (character as any).currentPosition?.id,
      };

      this.prisoners.set(prisonerId, prisoner);
      this.characterPrisoners.set(characterId, prisonerId);

      // 캐릭터 상태 업데이트
      await Gin7Character.updateOne(
        { sessionId, characterId },
        {
          $set: {
            'status.isPrisoner': true,
            'status.prisonerId': prisonerId,
            'status.capturedAt': now,
          },
        }
      );

      this.emit('PRISONER_CAPTURED', {
        sessionId,
        prisonerId,
        characterId,
        captor,
        capturedLocation,
        civilWarId,
      });

      logger.info('[PostWarJusticeService] Prisoner captured', {
        prisonerId,
        characterId,
        characterName: character.name,
      });

      return prisoner;
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error capturing prisoner: ${error.message}`);
      return null;
    }
  }

  /**
   * 포로 구금
   */
  public async detainPrisoner(
    prisonerId: string,
    facilityId: string,
    planetId: string,
  ): Promise<boolean> {
    const prisoner = this.prisoners.get(prisonerId);
    if (!prisoner) return false;

    prisoner.status = PrisonerStatus.DETAINED;
    prisoner.detentionFacilityId = facilityId;
    prisoner.detentionPlanetId = planetId;

    this.emit('PRISONER_DETAINED', {
      prisonerId,
      characterId: prisoner.characterId,
      facilityId,
      planetId,
    });

    logger.info('[PostWarJusticeService] Prisoner detained', {
      prisonerId,
      facilityId,
      planetId,
    });

    return true;
  }

  // ==================== 혐의 관리 ====================

  /**
   * 혐의 추가
   */
  public addCharge(
    prisonerId: string,
    chargeType: ChargeType,
    description: string,
    filedBy: string,
    evidence?: string[],
  ): Charge | null {
    const prisoner = this.prisoners.get(prisonerId);
    if (!prisoner) return null;

    const chargeId = `CHG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const charge: Charge = {
      chargeId,
      type: chargeType,
      description,
      filedAt: new Date(),
      filedBy,
      evidence,
    };

    prisoner.charges.push(charge);
    prisoner.status = PrisonerStatus.TRIAL_PENDING;

    this.emit('CHARGE_FILED', {
      prisonerId,
      characterId: prisoner.characterId,
      charge,
    });

    logger.info('[PostWarJusticeService] Charge filed', {
      prisonerId,
      chargeId,
      chargeType,
    });

    return charge;
  }

  // ==================== 재판/판결 ====================

  /**
   * 재판 진행 및 판결
   */
  public async conductTrial(
    prisonerId: string,
    judgeId: string,
    verdictType: VerdictType,
    sentence?: number,
    notes?: string,
  ): Promise<TrialResult> {
    try {
      const prisoner = this.prisoners.get(prisonerId);
      if (!prisoner) {
        return { success: false, error: '포로를 찾을 수 없습니다.' };
      }

      if (prisoner.status !== PrisonerStatus.TRIAL_PENDING &&
          prisoner.status !== PrisonerStatus.DETAINED) {
        return { success: false, error: '재판 가능한 상태가 아닙니다.' };
      }

      const verdictId = `VRD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date();

      const verdict: Verdict = {
        verdictId,
        type: verdictType,
        sentence,
        issuedAt: now,
        issuedBy: judgeId,
        notes,
      };

      prisoner.verdict = verdict;
      prisoner.status = PrisonerStatus.SENTENCED;

      this.emit('VERDICT_ISSUED', {
        prisonerId,
        characterId: prisoner.characterId,
        verdict,
      });

      logger.info('[PostWarJusticeService] Verdict issued', {
        prisonerId,
        verdictId,
        verdictType,
      });

      return { success: true, verdict, prisoner };
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error conducting trial: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==================== 판결 집행 ====================

  /**
   * 처형 집행
   */
  public async executeExecution(prisonerId: string, executionerId: string): Promise<boolean> {
    try {
      const prisoner = this.prisoners.get(prisonerId);
      if (!prisoner) return false;

      if (prisoner.verdict?.type !== VerdictType.EXECUTION) {
        logger.warn('[PostWarJusticeService] No execution verdict', { prisonerId });
        return false;
      }

      prisoner.status = PrisonerStatus.EXECUTED;
      prisoner.verdict.executedAt = new Date();

      // 캐릭터 사망 처리
      await Gin7Character.updateOne(
        { sessionId: prisoner.sessionId, characterId: prisoner.characterId },
        {
          $set: {
            'status.isDead': true,
            'status.deathDate': new Date(),
            'status.deathCause': 'EXECUTION',
            'status.isPrisoner': false,
          },
        }
      );

      this.characterPrisoners.delete(prisoner.characterId);

      this.emit('EXECUTION_CARRIED_OUT', {
        sessionId: prisoner.sessionId,
        prisonerId,
        characterId: prisoner.characterId,
        characterName: prisoner.characterName,
        executionerId,
      });

      logger.info('[PostWarJusticeService] Execution carried out', {
        prisonerId,
        characterName: prisoner.characterName,
      });

      return true;
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error executing: ${error.message}`);
      return false;
    }
  }

  /**
   * 사면 집행
   */
  public async grantPardon(
    prisonerId: string,
    pardonerId: string,
    restoreRank: boolean = false,
    restorePosition: boolean = false,
  ): Promise<boolean> {
    try {
      const prisoner = this.prisoners.get(prisonerId);
      if (!prisoner) return false;

      prisoner.status = PrisonerStatus.PARDONED;

      const updateFields: any = {
        'status.isPrisoner': false,
        'status.prisonerId': null,
        'status.pardonedAt': new Date(),
        'status.pardonedBy': pardonerId,
      };

      // 계급/직위 복원
      if (restoreRank && prisoner.previousRank) {
        updateFields['currentRank.id'] = prisoner.previousRank;
      }
      if (restorePosition && prisoner.previousPosition) {
        updateFields['currentPosition.id'] = prisoner.previousPosition;
      }

      await Gin7Character.updateOne(
        { sessionId: prisoner.sessionId, characterId: prisoner.characterId },
        { $set: updateFields }
      );

      this.characterPrisoners.delete(prisoner.characterId);

      this.emit('PARDON_GRANTED', {
        sessionId: prisoner.sessionId,
        prisonerId,
        characterId: prisoner.characterId,
        characterName: prisoner.characterName,
        pardonerId,
        restoreRank,
        restorePosition,
      });

      logger.info('[PostWarJusticeService] Pardon granted', {
        prisonerId,
        characterName: prisoner.characterName,
        pardonerId,
      });

      return true;
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error granting pardon: ${error.message}`);
      return false;
    }
  }

  /**
   * 추방 집행
   */
  public async executeExile(
    prisonerId: string,
    destinationFaction: string,
    executionerId: string,
  ): Promise<boolean> {
    try {
      const prisoner = this.prisoners.get(prisonerId);
      if (!prisoner) return false;

      prisoner.status = PrisonerStatus.EXILED;
      prisoner.verdict!.executedAt = new Date();

      // 세력 변경
      await Gin7Character.updateOne(
        { sessionId: prisoner.sessionId, characterId: prisoner.characterId },
        {
          $set: {
            factionId: destinationFaction,
            'status.isPrisoner': false,
            'status.prisonerId': null,
            'status.isExiled': true,
            'status.exiledAt': new Date(),
            'status.originalFaction': prisoner.sessionId, // 원래 세력 기록
            // 계급/직위 박탈
            'currentRank': null,
            'currentPosition': null,
          },
        }
      );

      this.characterPrisoners.delete(prisoner.characterId);

      this.emit('EXILE_EXECUTED', {
        sessionId: prisoner.sessionId,
        prisonerId,
        characterId: prisoner.characterId,
        characterName: prisoner.characterName,
        destinationFaction,
        executionerId,
      });

      logger.info('[PostWarJusticeService] Exile executed', {
        prisonerId,
        characterName: prisoner.characterName,
        destinationFaction,
      });

      return true;
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error executing exile: ${error.message}`);
      return false;
    }
  }

  /**
   * 투옥 집행 (유기/무기 징역)
   */
  public async executeImprisonment(prisonerId: string): Promise<boolean> {
    try {
      const prisoner = this.prisoners.get(prisonerId);
      if (!prisoner) return false;

      if (prisoner.verdict?.type !== VerdictType.IMPRISONMENT &&
          prisoner.verdict?.type !== VerdictType.LIFE_IMPRISONMENT) {
        return false;
      }

      prisoner.status = PrisonerStatus.DETAINED;
      prisoner.verdict.executedAt = new Date();

      // 캐릭터 투옥 상태 유지
      await Gin7Character.updateOne(
        { sessionId: prisoner.sessionId, characterId: prisoner.characterId },
        {
          $set: {
            'status.isImprisoned': true,
            'status.imprisonedAt': new Date(),
            'status.sentenceYears': prisoner.verdict.sentence || 999,
            'status.releaseDate': prisoner.verdict.type === VerdictType.LIFE_IMPRISONMENT
              ? null
              : this.calculateReleaseDate(prisoner.verdict.sentence || 1),
            // 계급/직위 박탈
            'currentRank': null,
            'currentPosition': null,
          },
        }
      );

      this.emit('IMPRISONMENT_STARTED', {
        sessionId: prisoner.sessionId,
        prisonerId,
        characterId: prisoner.characterId,
        characterName: prisoner.characterName,
        sentenceYears: prisoner.verdict.sentence,
        isLifeSentence: prisoner.verdict.type === VerdictType.LIFE_IMPRISONMENT,
      });

      logger.info('[PostWarJusticeService] Imprisonment started', {
        prisonerId,
        sentenceYears: prisoner.verdict.sentence,
      });

      return true;
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error executing imprisonment: ${error.message}`);
      return false;
    }
  }

  /**
   * 석방 (형기 만료 또는 조기 석방)
   */
  public async releasePrisoner(
    prisonerId: string,
    releasedBy: string,
    reason: 'SENTENCE_COMPLETED' | 'EARLY_RELEASE' | 'AMNESTY',
  ): Promise<boolean> {
    try {
      const prisoner = this.prisoners.get(prisonerId);
      if (!prisoner) return false;

      prisoner.status = PrisonerStatus.RELEASED;

      await Gin7Character.updateOne(
        { sessionId: prisoner.sessionId, characterId: prisoner.characterId },
        {
          $set: {
            'status.isPrisoner': false,
            'status.prisonerId': null,
            'status.isImprisoned': false,
            'status.releasedAt': new Date(),
            'status.releaseReason': reason,
          },
        }
      );

      this.characterPrisoners.delete(prisoner.characterId);

      this.emit('PRISONER_RELEASED', {
        sessionId: prisoner.sessionId,
        prisonerId,
        characterId: prisoner.characterId,
        characterName: prisoner.characterName,
        releasedBy,
        reason,
      });

      logger.info('[PostWarJusticeService] Prisoner released', {
        prisonerId,
        characterName: prisoner.characterName,
        reason,
      });

      return true;
    } catch (error: any) {
      logger.error(`[PostWarJusticeService] Error releasing prisoner: ${error.message}`);
      return false;
    }
  }

  // ==================== 대량 처리 ====================

  /**
   * 대사면 (내전 종결 후)
   */
  public async declareAmnesty(
    sessionId: string,
    civilWarId: string,
    declarerId: string,
    excludeCharges?: ChargeType[],
  ): Promise<number> {
    let amnestyCount = 0;

    for (const [prisonerId, prisoner] of this.prisoners) {
      if (prisoner.sessionId !== sessionId) continue;
      if (prisoner.civilWarId !== civilWarId) continue;
      if (prisoner.status === PrisonerStatus.EXECUTED) continue;

      // 제외 혐의 확인
      if (excludeCharges && excludeCharges.length > 0) {
        const hasExcludedCharge = prisoner.charges.some(c => excludeCharges.includes(c.type));
        if (hasExcludedCharge) continue;
      }

      const pardoned = await this.grantPardon(prisonerId, declarerId, false, false);
      if (pardoned) amnestyCount++;
    }

    this.emit('AMNESTY_DECLARED', {
      sessionId,
      civilWarId,
      declarerId,
      amnestyCount,
      excludeCharges,
    });

    logger.info('[PostWarJusticeService] Amnesty declared', {
      civilWarId,
      amnestyCount,
    });

    return amnestyCount;
  }

  // ==================== 조회 ====================

  /**
   * 포로 조회
   */
  public getPrisoner(prisonerId: string): Prisoner | undefined {
    return this.prisoners.get(prisonerId);
  }

  /**
   * 캐릭터의 포로 상태 조회
   */
  public getCharacterPrisoner(characterId: string): Prisoner | undefined {
    const prisonerId = this.characterPrisoners.get(characterId);
    if (!prisonerId) return undefined;
    return this.prisoners.get(prisonerId);
  }

  /**
   * 세션 내 모든 포로 조회
   */
  public getSessionPrisoners(sessionId: string): Prisoner[] {
    return Array.from(this.prisoners.values()).filter(p => p.sessionId === sessionId);
  }

  /**
   * 내전 관련 포로 조회
   */
  public getCivilWarPrisoners(civilWarId: string): Prisoner[] {
    return Array.from(this.prisoners.values()).filter(p => p.civilWarId === civilWarId);
  }

  /**
   * 특정 상태의 포로 조회
   */
  public getPrisonersByStatus(sessionId: string, status: PrisonerStatus): Prisoner[] {
    return Array.from(this.prisoners.values()).filter(
      p => p.sessionId === sessionId && p.status === status
    );
  }

  // ==================== Helper ====================

  /**
   * 석방 예정일 계산
   */
  private calculateReleaseDate(sentenceYears: number): Date {
    const releaseDate = new Date();
    releaseDate.setFullYear(releaseDate.getFullYear() + sentenceYears);
    return releaseDate;
  }
}

export const postWarJusticeService = PostWarJusticeService.getInstance();
export default PostWarJusticeService;







