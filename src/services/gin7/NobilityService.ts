/**
 * NobilityService - 귀족/작위 시스템 서비스
 * 매뉴얼 5229~5298행 기반
 * 
 * 주요 기능:
 * - 작위 수여 (서작)
 * - 작위 박탈
 * - 계급 래더 보너스 계산
 * - 봉토 소유 자격 검증
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import {
  TitleCode,
  TitleDefinition,
  TITLE_DEFINITIONS,
  getTitleLadderBonus,
  canPromoteTitle,
  canOwnFief,
  compareTitles,
} from '../../constants/gin7/nobility_definitions';
import { logger } from '../../common/logger';

export interface TitleAwardResult {
  success: boolean;
  error?: string;
  message?: string;
  previousTitle?: TitleCode;
  newTitle?: TitleCode;
  previousRank?: string;
  newRank?: string;
  ladderBonusChange?: number;
}

export interface TitleRevocationResult {
  success: boolean;
  error?: string;
  revokedTitle?: TitleCode;
  fiefRevoked?: boolean;
}

/**
 * NobilityService 클래스
 */
export class NobilityService extends EventEmitter {
  private static instance: NobilityService;

  private constructor() {
    super();
    logger.info('[NobilityService] Initialized');
  }

  public static getInstance(): NobilityService {
    if (!NobilityService.instance) {
      NobilityService.instance = new NobilityService();
    }
    return NobilityService.instance;
  }

  /**
   * 작위 수여 (서작)
   * @param sessionId 세션 ID
   * @param grantorId 수여자 ID (황제)
   * @param targetId 대상자 ID
   * @param newTitle 새 작위
   */
  public async awardTitle(
    sessionId: string,
    grantorId: string,
    targetId: string,
    newTitle: TitleCode
  ): Promise<TitleAwardResult> {
    try {
      // 수여자 확인 (황제만 가능)
      const grantor = await Gin7Character.findOne({ sessionId, characterId: grantorId });
      if (!grantor) {
        return { success: false, error: '수여자를 찾을 수 없습니다.' };
      }

      // 황제 권한 확인
      const hasEmperorAuthority = grantor.position?.includes('EMPEROR') ||
        grantor.commandCards?.some(card => card.cardId === 'EMPEROR_CARD');
      
      if (!hasEmperorAuthority) {
        return { success: false, error: '서작 권한이 없습니다. 황제만 서작할 수 있습니다.' };
      }

      // 대상자 확인
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return { success: false, error: '대상자를 찾을 수 없습니다.' };
      }

      // 제국 소속 확인
      if (target.faction !== 'EMPIRE') {
        return { success: false, error: '제국 소속 캐릭터만 작위를 받을 수 있습니다.' };
      }

      // 현재 작위 확인
      const currentTitle = (target.nobility?.title as TitleCode) || TitleCode.COMMONER;

      // 서작 가능 여부 확인 (순차적 승급만 가능)
      if (!canPromoteTitle(currentTitle, newTitle)) {
        const currentDef = TITLE_DEFINITIONS[currentTitle];
        const newDef = TITLE_DEFINITIONS[newTitle];
        return {
          success: false,
          error: `${currentDef.nameKo}에서 ${newDef.nameKo}로 바로 서작할 수 없습니다. 순차적으로 서작해야 합니다.`,
        };
      }

      // 작위 수여
      const previousLadderBonus = getTitleLadderBonus(currentTitle);
      const newLadderBonus = getTitleLadderBonus(newTitle);
      const ladderBonusChange = newLadderBonus - previousLadderBonus;

      await Gin7Character.updateOne(
        { sessionId, characterId: targetId },
        {
          $set: {
            'nobility.title': newTitle,
            'nobility.titleAwardedAt': new Date(),
            'nobility.titleAwardedBy': grantorId,
          },
          $inc: {
            meritPoints: ladderBonusChange, // 계급 래더 보너스 적용
          },
        }
      );

      // 이벤트 발생
      this.emit('TITLE_AWARDED', {
        sessionId,
        targetId,
        grantorId,
        previousTitle: currentTitle,
        newTitle,
        ladderBonusChange,
      });

      logger.info(`[NobilityService] Title awarded: ${targetId} promoted from ${currentTitle} to ${newTitle}`);

      return {
        success: true,
        previousTitle: currentTitle,
        newTitle,
        ladderBonusChange,
      };
    } catch (error: any) {
      logger.error(`[NobilityService] Error awarding title: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 작위 박탈
   * @param sessionId 세션 ID
   * @param revokerId 박탈자 ID
   * @param targetId 대상자 ID
   * @param reason 박탈 사유
   */
  public async revokeTitle(
    sessionId: string,
    revokerId: string,
    targetId: string,
    reason: string
  ): Promise<TitleRevocationResult> {
    try {
      // 박탈자 확인 (황제 또는 사법부)
      const revoker = await Gin7Character.findOne({ sessionId, characterId: revokerId });
      if (!revoker) {
        return { success: false, error: '박탈자를 찾을 수 없습니다.' };
      }

      const hasAuthority = revoker.position?.includes('EMPEROR') ||
        revoker.position?.includes('JUSTICE_MINISTER') ||
        revoker.commandCards?.some(card => 
          card.cardId === 'EMPEROR_CARD' || card.cardId === 'JUSTICE_CARD'
        );

      if (!hasAuthority) {
        return { success: false, error: '작위 박탈 권한이 없습니다.' };
      }

      // 대상자 확인
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return { success: false, error: '대상자를 찾을 수 없습니다.' };
      }

      const currentTitle = (target.nobility?.title as TitleCode) || TitleCode.COMMONER;
      
      if (currentTitle === TitleCode.COMMONER) {
        return { success: false, error: '평민에게는 박탈할 작위가 없습니다.' };
      }

      // 봉토 소유 확인 (봉토 자동 몰수)
      const hadFief = !!target.nobility?.fiefPlanetId;

      // 작위 박탈 (평민으로)
      const ladderBonusLoss = getTitleLadderBonus(currentTitle);

      await Gin7Character.updateOne(
        { sessionId, characterId: targetId },
        {
          $set: {
            'nobility.title': TitleCode.COMMONER,
            'nobility.titleRevokedAt': new Date(),
            'nobility.titleRevokedBy': revokerId,
            'nobility.revocationReason': reason,
            'nobility.fiefPlanetId': null,
          },
          $inc: {
            meritPoints: -ladderBonusLoss, // 계급 래더 보너스 제거
          },
        }
      );

      // 이벤트 발생
      this.emit('TITLE_REVOKED', {
        sessionId,
        targetId,
        revokerId,
        revokedTitle: currentTitle,
        reason,
        fiefRevoked: hadFief,
      });

      logger.info(`[NobilityService] Title revoked: ${targetId} lost ${currentTitle}, reason: ${reason}`);

      return {
        success: true,
        revokedTitle: currentTitle,
        fiefRevoked: hadFief,
      };
    } catch (error: any) {
      logger.error(`[NobilityService] Error revoking title: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 캐릭터의 총 계급 래더 보너스 계산 (작위 + 훈장)
   */
  public async calculateTotalLadderBonus(
    sessionId: string,
    characterId: string
  ): Promise<number> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) return 0;

    // 작위 보너스
    const titleCode = (character.nobility?.title as TitleCode) || TitleCode.COMMONER;
    const titleBonus = getTitleLadderBonus(titleCode);

    // 훈장 보너스 (MedalService에서 처리)
    const medalBonus = character.medals?.reduce((sum, medal) => {
      // 훈장별 보너스는 MedalService에서 계산
      return sum + (medal.ladderBonus || 0);
    }, 0) || 0;

    return titleBonus + medalBonus;
  }

  /**
   * 봉토 소유 자격 확인
   */
  public async canCharacterOwnFief(
    sessionId: string,
    characterId: string
  ): Promise<boolean> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) return false;

    const titleCode = (character.nobility?.title as TitleCode) || TitleCode.COMMONER;
    return canOwnFief(titleCode);
  }

  /**
   * 작위 정보 조회
   */
  public getTitleDefinition(titleCode: TitleCode): TitleDefinition | undefined {
    return TITLE_DEFINITIONS[titleCode];
  }

  /**
   * 세력 내 귀족 목록 조회
   */
  public async getNoblesInFaction(
    sessionId: string,
    faction: 'EMPIRE' | 'ALLIANCE'
  ): Promise<IGin7Character[]> {
    // 동맹에는 귀족 제도가 없음
    if (faction === 'ALLIANCE') return [];

    return Gin7Character.find({
      sessionId,
      faction,
      'nobility.title': { $ne: TitleCode.COMMONER, $exists: true },
    }).sort({ 'nobility.title': 1 }); // 작위 높은 순
  }

  /**
   * 특정 작위 보유자 목록 조회
   */
  public async getCharactersByTitle(
    sessionId: string,
    titleCode: TitleCode
  ): Promise<IGin7Character[]> {
    return Gin7Character.find({
      sessionId,
      'nobility.title': titleCode,
    });
  }

  // ============================================================
  // Routes 호환용 별칭 메서드
  // ============================================================

  /**
   * 작위 정보 조회 (routes 호환)
   */
  public async getNobilityInfo(
    sessionId: string,
    commanderNo: number
  ): Promise<{ title: string; fiefdoms: string[] } | null> {
    const character = await Gin7Character.findOne({ 
      sessionId, 
      characterId: `${commanderNo}` 
    });
    if (!character) return null;

    return {
      title: (character.nobility?.title as string) || 'COMMONER',
      fiefdoms: (character.nobility as any)?.fiefdoms || [],
    };
  }

  /**
   * 서작 (routes 호환) - awardTitle의 별칭
   */
  public async ennoble(
    sessionId: string,
    granterNo: number,
    targetNo: number,
    newRank: string
  ): Promise<TitleAwardResult> {
    return this.awardTitle(
      sessionId,
      `${granterNo}`,
      `${targetNo}`,
      newRank as TitleCode
    );
  }

  /**
   * 봉토 수여 (routes 호환)
   */
  public async grantFief(
    sessionId: string,
    granterNo: number | string,
    targetNo: number | string,
    planetId: string
  ): Promise<{ success: boolean; message?: string; error?: string; fief?: any }> {
    // FiefService에 위임
    const { fiefService } = await import('./FiefService');
    const result = await fiefService.grantFief(sessionId, String(granterNo), String(targetNo), planetId);
    return {
      success: result.success,
      message: result.success ? `행성 ${planetId}를 봉토로 수여했습니다.` : result.error,
      error: result.error,
      fief: result.success ? { planetId } : undefined
    };
  }

  /**
   * 봉토 회수 (routes 호환)
   */
  public async revokeFief(
    sessionId: string,
    revokerNo: number | string,
    targetNo: number | string,
    planetId: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    // FiefService에 위임
    const { fiefService } = await import('./FiefService');
    const result = await fiefService.revokeFief(sessionId, String(revokerNo), planetId);
    return {
      success: result.success,
      message: result.success ? `봉토가 회수되었습니다.` : (result.error || '봉토 회수 실패'),
      error: result.error
    };
  }

  /**
   * 작위 박탈 (routes 호환) - revokeTitle의 별칭
   */
  public async stripNobility(
    sessionId: string,
    granterNo: number,
    targetNo: number
  ): Promise<TitleRevocationResult> {
    return this.revokeTitle(
      sessionId,
      `${granterNo}`,
      `${targetNo}`,
      'Imperial Decree'
    );
  }

  /**
   * 작위 수여 (PersonnelCommandService 호환)
   */
  public async grantTitle(
    sessionId: string,
    targetId: string,
    titleCode: string,
    granterId: string
  ): Promise<TitleAwardResult> {
    return this.awardTitle(sessionId, granterId, targetId, titleCode as TitleCode);
  }

  /**
   * 작위에 따른 계급 래더 보너스 (MeritService 호환)
   */
  public getNobilityMeritBonus(character: IGin7Character): number {
    const titleCode = (character.nobility?.title as TitleCode) || TitleCode.COMMONER;
    return getTitleLadderBonus(titleCode);
  }
}

export const nobilityService = NobilityService.getInstance();
export default NobilityService;
