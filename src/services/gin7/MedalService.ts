/**
 * MedalService - 훈장 시스템 서비스
 * 매뉴얼 1663행 기반
 * 
 * 주요 기능:
 * - 훈장 수여 (서훈)
 * - 훈장 박탈
 * - 계급 래더 보너스 계산
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import {
  MedalCode,
  MedalDefinition,
  MEDAL_DEFINITIONS,
  getMedalLadderBonus,
  compareMedals,
  getMedalsByFaction,
} from '../../constants/gin7/nobility_definitions';
import { logger } from '../../common/logger';

/**
 * 캐릭터 훈장 정보 인터페이스
 */
export interface CharacterMedal {
  medalCode: MedalCode;
  awardedAt: Date;
  awardedBy: string;
  citation?: string;        // 수훈 사유
  ladderBonus: number;      // 래더 보너스 (캐싱)
}

/**
 * 훈장 수여 결과
 */
export interface MedalAwardResult {
  success: boolean;
  error?: string;
  medal?: CharacterMedal;
  totalLadderBonus?: number;
}

/**
 * MedalService 클래스
 */
export class MedalService extends EventEmitter {
  private static instance: MedalService;

  private constructor() {
    super();
    logger.info('[MedalService] Initialized');
  }

  public static getInstance(): MedalService {
    if (!MedalService.instance) {
      MedalService.instance = new MedalService();
    }
    return MedalService.instance;
  }

  /**
   * 훈장 수여 (서훈)
   * @param sessionId 세션 ID
   * @param grantorId 수여자 ID (황제/의장 또는 인사국장)
   * @param targetId 대상자 ID
   * @param medalCode 훈장 코드
   * @param citation 수훈 사유
   */
  public async awardMedal(
    sessionId: string,
    grantorId: string,
    targetId: string,
    medalCode: MedalCode,
    citation?: string
  ): Promise<MedalAwardResult> {
    try {
      // 수여자 확인
      const grantor = await Gin7Character.findOne({ sessionId, characterId: grantorId });
      if (!grantor) {
        return { success: false, error: '수여자를 찾을 수 없습니다.' };
      }

      // 훈장 정의 확인
      const medalDef = MEDAL_DEFINITIONS[medalCode];
      if (!medalDef) {
        return { success: false, error: '알 수 없는 훈장입니다.' };
      }

      // 수여 권한 확인
      const hasAuthority = this.checkAwardAuthority(grantor, medalDef);
      if (!hasAuthority) {
        return { success: false, error: '훈장 수여 권한이 없습니다.' };
      }

      // 대상자 확인
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return { success: false, error: '대상자를 찾을 수 없습니다.' };
      }

      // 팩션 확인
      if (medalDef.faction !== 'BOTH' && medalDef.faction !== target.faction) {
        return { success: false, error: `이 훈장은 ${medalDef.faction === 'EMPIRE' ? '제국군' : '동맹군'}에게만 수여할 수 있습니다.` };
      }

      // 계급 범위 확인
      const rankValid = this.checkRankRange(target.rank || '', medalDef);
      if (!rankValid) {
        return {
          success: false,
          error: `이 훈장은 ${medalDef.minRank}~${medalDef.maxRank} 계급에게만 수여할 수 있습니다.`,
        };
      }

      // 이미 동일 훈장 보유 확인
      const existingMedals = target.medals || [];
      if (existingMedals.some((m: any) => m.medalCode === medalCode)) {
        return { success: false, error: '대상자가 이미 해당 훈장을 보유하고 있습니다.' };
      }

      // 훈장 수여
      const newMedal: CharacterMedal = {
        medalCode,
        awardedAt: new Date(),
        awardedBy: grantorId,
        citation,
        ladderBonus: medalDef.ladderBonus,
      };

      await Gin7Character.updateOne(
        { sessionId, characterId: targetId },
        {
          $push: { medals: newMedal },
          $inc: { meritPoints: medalDef.ladderBonus },
        }
      );

      // 총 래더 보너스 계산
      const totalLadderBonus = existingMedals.reduce(
        (sum: number, m: any) => sum + (m.ladderBonus || 0),
        medalDef.ladderBonus
      );

      // 이벤트 발생
      this.emit('MEDAL_AWARDED', {
        sessionId,
        targetId,
        grantorId,
        medalCode,
        citation,
        ladderBonus: medalDef.ladderBonus,
      });

      logger.info(`[MedalService] Medal awarded: ${targetId} received ${medalCode} from ${grantorId}`);

      return {
        success: true,
        medal: newMedal,
        totalLadderBonus,
      };
    } catch (error: any) {
      logger.error(`[MedalService] Error awarding medal: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 훈장 박탈
   * @param sessionId 세션 ID
   * @param revokerId 박탈자 ID
   * @param targetId 대상자 ID
   * @param medalCode 훈장 코드
   * @param reason 박탈 사유
   */
  public async revokeMedal(
    sessionId: string,
    revokerId: string,
    targetId: string,
    medalCode: MedalCode,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 박탈자 확인 (황제/의장 또는 사법부)
      const revoker = await Gin7Character.findOne({ sessionId, characterId: revokerId });
      if (!revoker) {
        return { success: false, error: '박탈자를 찾을 수 없습니다.' };
      }

      const hasAuthority = revoker.position?.includes('EMPEROR') ||
        revoker.position?.includes('CHAIRMAN') ||
        revoker.position?.includes('JUSTICE');

      if (!hasAuthority) {
        return { success: false, error: '훈장 박탈 권한이 없습니다.' };
      }

      // 대상자 확인
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return { success: false, error: '대상자를 찾을 수 없습니다.' };
      }

      // 훈장 보유 확인
      const existingMedals = target.medals || [];
      const medalIndex = existingMedals.findIndex((m: any) => m.medalCode === medalCode);
      if (medalIndex === -1) {
        return { success: false, error: '대상자가 해당 훈장을 보유하고 있지 않습니다.' };
      }

      const medalToRevoke = existingMedals[medalIndex];
      const ladderBonusLoss = medalToRevoke.ladderBonus || 0;

      // 훈장 박탈
      await Gin7Character.updateOne(
        { sessionId, characterId: targetId },
        {
          $pull: { medals: { medalCode } },
          $inc: { meritPoints: -ladderBonusLoss },
        }
      );

      // 이벤트 발생
      this.emit('MEDAL_REVOKED', {
        sessionId,
        targetId,
        revokerId,
        medalCode,
        reason,
      });

      logger.info(`[MedalService] Medal revoked: ${targetId} lost ${medalCode}, reason: ${reason}`);

      return { success: true };
    } catch (error: any) {
      logger.error(`[MedalService] Error revoking medal: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 캐릭터의 훈장 목록 조회
   */
  public async getCharacterMedals(
    sessionId: string,
    characterId: string
  ): Promise<CharacterMedal[]> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) return [];

    return (character.medals || []).map((m: any) => ({
      medalCode: m.medalId || m.medalCode,
      awardedAt: m.awardedAt,
      awardedBy: m.awardedBy || 'unknown',
      citation: m.citation,
      ladderBonus: m.ladderBonus || getMedalLadderBonus(m.medalId || m.medalCode),
    })).sort((a: CharacterMedal, b: CharacterMedal) => 
      compareMedals(a.medalCode, b.medalCode)
    );
  }

  /**
   * 캐릭터의 총 훈장 래더 보너스 계산
   */
  public async calculateMedalLadderBonus(
    sessionId: string,
    characterId: string
  ): Promise<number> {
    const medals = await this.getCharacterMedals(sessionId, characterId);
    return medals.reduce((sum, medal) => sum + (medal.ladderBonus || 0), 0);
  }

  /**
   * 팩션별 수여 가능 훈장 목록 조회
   */
  public getAvailableMedals(faction: 'EMPIRE' | 'ALLIANCE'): MedalDefinition[] {
    return getMedalsByFaction(faction);
  }

  /**
   * 훈장 정의 조회
   */
  public getMedalDefinition(medalCode: MedalCode): MedalDefinition | undefined {
    return MEDAL_DEFINITIONS[medalCode];
  }

  /**
   * 세력 내 특정 훈장 보유자 목록 조회
   */
  public async getMedalHolders(
    sessionId: string,
    medalCode: MedalCode
  ): Promise<IGin7Character[]> {
    return Gin7Character.find({
      sessionId,
      'medals.medalCode': medalCode,
    });
  }

  // ==================== Private Helper Methods ====================

  /**
   * 수여 권한 확인
   */
  private checkAwardAuthority(
    grantor: IGin7Character,
    medalDef: MedalDefinition
  ): boolean {
    // 황제/의장은 모든 훈장 수여 가능
    if (grantor.position?.includes('EMPEROR') || grantor.position?.includes('CHAIRMAN')) {
      return true;
    }

    // 인사국장은 하위 훈장만 수여 가능
    if (grantor.position?.includes('PERSONNEL')) {
      return medalDef.tier >= 3; // tier 3 이하(낮은 훈장)만 가능
    }

    return false;
  }

  /**
   * 계급 범위 확인
   */
  private checkRankRange(rank: string, medalDef: MedalDefinition): boolean {
    // TODO: 실제 계급 비교 로직 구현
    // 현재는 단순화를 위해 항상 true 반환
    return true;
  }
}

export const medalService = MedalService.getInstance();
export default MedalService;





