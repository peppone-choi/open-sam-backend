/**
 * MeritService - 공적 포인트 및 계급 래더 관리 서비스
 * 매뉴얼 1646~1769행 기반
 *
 * 주요 기능:
 * - 공적 포인트 획득/차감
 * - 계급 래더 순위 계산
 * - 자동 승진 처리
 * - 작위/훈장 보너스 적용
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';
import { nobilityService } from './NobilityService';
import { medalService } from './MedalService';

/**
 * 공적 획득 사유 열거형
 */
export enum MeritSource {
  ENEMY_SHIP_DESTROYED = 'ENEMY_SHIP_DESTROYED', // 적 함선 격파
  PLANET_CAPTURED = 'PLANET_CAPTURED', // 행성 점령
  FORTRESS_CAPTURED = 'FORTRESS_CAPTURED', // 요새 점령
  OPERATION_SUCCESS = 'OPERATION_SUCCESS', // 작전 성공
  DEFENSE_SUCCESS = 'DEFENSE_SUCCESS', // 방어 성공
  SPECIAL_MISSION = 'SPECIAL_MISSION', // 특수 임무
  PROMOTION = 'PROMOTION', // 승진 (리셋)
  DEMOTION = 'DEMOTION', // 강등 (100으로 리셋)
  SESSION_END = 'SESSION_END', // 세션 종료 보너스
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT', // 관리자 조정
}

/**
 * 공적 변경 이벤트 페이로드
 */
export interface MeritChangePayload {
  sessionId: string;
  characterId: string;
  previousMerit: number;
  newMerit: number;
  source: MeritSource;
  description?: string;
}

/**
 * 계급 래더 엔트리
 */
export interface LadderEntry {
  characterId: string;
  name: string;
  rank: string;
  merit: number;
  effectiveMerit: number; // 작위/훈장 보너스 적용 후
  nobilityBonus: number;
  medalBonus: number;
  position: number; // 래더 내 순위 (1부터 시작)
}

/**
 * 승진 대상 정보
 */
export interface PromotionCandidate {
  characterId: string;
  name: string;
  currentRank: string;
  merit: number;
  effectiveMerit: number;
  ladderPosition: number;
  isEligible: boolean;
  reason?: string;
}

/**
 * 계급별 정원
 */
const RANK_CAPACITY: Record<string, number> = {
  MARSHAL: 5, // 원수
  SENIOR_ADMIRAL: 5, // 상급대장
  ADMIRAL: 10, // 대장
  VICE_ADMIRAL: 20, // 중장
  REAR_ADMIRAL: 40, // 소장
  COMMODORE: 80, // 준장
  CAPTAIN: Infinity, // 대좌 이하 무제한
  COMMANDER: Infinity,
  LIEUTENANT_COMMANDER: Infinity,
  LIEUTENANT: Infinity,
  ENSIGN: Infinity,
  WARRANT_OFFICER: Infinity,
  SERGEANT: Infinity,
  CORPORAL: Infinity,
  PRIVATE: Infinity,
};

/**
 * 계급 순서 (높은 순)
 */
const RANK_ORDER = [
  'MARSHAL',
  'SENIOR_ADMIRAL',
  'ADMIRAL',
  'VICE_ADMIRAL',
  'REAR_ADMIRAL',
  'COMMODORE',
  'CAPTAIN',
  'COMMANDER',
  'LIEUTENANT_COMMANDER',
  'LIEUTENANT',
  'ENSIGN',
  'WARRANT_OFFICER',
  'SERGEANT',
  'CORPORAL',
  'PRIVATE',
];

/**
 * MeritService 클래스
 */
export class MeritService extends EventEmitter {
  private static instance: MeritService;

  private constructor() {
    super();
    logger.info('[MeritService] Initialized');
  }

  public static getInstance(): MeritService {
    if (!MeritService.instance) {
      MeritService.instance = new MeritService();
    }
    return MeritService.instance;
  }

  /**
   * 공적 포인트 추가
   */
  public async addMerit(
    sessionId: string,
    characterId: string,
    amount: number,
    source: MeritSource,
    description?: string,
  ): Promise<{ success: boolean; newMerit?: number; error?: string }> {
    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, error: `캐릭터를 찾을 수 없습니다: ${characterId}` };
      }

      const previousMerit = character.meritPoints || 0;
      const newMerit = Math.max(0, previousMerit + amount);

      character.meritPoints = newMerit;
      await character.save();

      const payload: MeritChangePayload = {
        sessionId,
        characterId,
        previousMerit,
        newMerit,
        source,
        description,
      };
      this.emit('merit:changed', payload);

      logger.debug(
        `[MeritService] ${characterId} merit changed: ${previousMerit} -> ${newMerit} (${source})`,
      );
      return { success: true, newMerit };
    } catch (error) {
      logger.error(`[MeritService] Error adding merit: ${error}`);
      return { success: false, error: '공적 포인트 추가 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 공적 포인트 설정 (승진/강등 시 사용)
   */
  public async setMerit(
    sessionId: string,
    characterId: string,
    amount: number,
    source: MeritSource,
    description?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, error: `캐릭터를 찾을 수 없습니다: ${characterId}` };
      }

      const previousMerit = character.meritPoints || 0;
      character.meritPoints = Math.max(0, amount);
      await character.save();

      const payload: MeritChangePayload = {
        sessionId,
        characterId,
        previousMerit,
        newMerit: character.meritPoints,
        source,
        description,
      };
      this.emit('merit:changed', payload);

      return { success: true };
    } catch (error) {
      logger.error(`[MeritService] Error setting merit: ${error}`);
      return { success: false, error: '공적 포인트 설정 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 캐릭터의 유효 공적 포인트 계산 (작위/훈장 보너스 포함)
   */
  public async calculateEffectiveMerit(
    sessionId: string,
    character: IGin7Character,
  ): Promise<{ baseMerit: number; nobilityBonus: number; medalBonus: number; total: number }> {
    const baseMerit = character.meritPoints || 0;

    // 작위 보너스 (제국군만)
    const nobilityBonus =
      character.faction === 'IMPERIAL' ? nobilityService.getNobilityMeritBonus(character) : 0;

    // 훈장 보너스
    const medalBonus = await medalService.calculateMedalLadderBonus(sessionId, character.characterId);

    return {
      baseMerit,
      nobilityBonus,
      medalBonus,
      total: baseMerit + nobilityBonus + medalBonus,
    };
  }

  /**
   * 특정 계급의 래더 조회
   */
  public async getRankLadder(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
    rank: string,
  ): Promise<LadderEntry[]> {
    const characters = await Gin7Character.find({
      sessionId,
      faction,
      'currentRank.code': rank,
    });

    const entries: LadderEntry[] = [];

    for (const char of characters) {
      const { baseMerit, nobilityBonus, medalBonus, total } = await this.calculateEffectiveMerit(
        sessionId,
        char,
      );

      entries.push({
        characterId: char.characterId,
        name: char.name,
        rank: char.currentRank || rank,
        merit: baseMerit,
        effectiveMerit: total,
        nobilityBonus,
        medalBonus,
        position: 0, // 정렬 후 설정
      });
    }

    // 유효 공적 포인트 기준 내림차순 정렬
    entries.sort((a, b) => b.effectiveMerit - a.effectiveMerit);

    // 순위 설정
    entries.forEach((entry, index) => {
      entry.position = index + 1;
    });

    return entries;
  }

  /**
   * 진영 전체 래더 조회
   */
  public async getFactionLadder(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
  ): Promise<Map<string, LadderEntry[]>> {
    const ladderByRank = new Map<string, LadderEntry[]>();

    for (const rank of RANK_ORDER) {
      const ladder = await this.getRankLadder(sessionId, faction, rank);
      if (ladder.length > 0) {
        ladderByRank.set(rank, ladder);
      }
    }

    return ladderByRank;
  }

  /**
   * 승진 대상자 조회
   */
  public async getPromotionCandidates(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
    fromRank: string,
  ): Promise<PromotionCandidate[]> {
    const ladder = await this.getRankLadder(sessionId, faction, fromRank);
    const toRankIndex = RANK_ORDER.indexOf(fromRank) - 1;

    if (toRankIndex < 0) {
      return []; // 이미 최고 계급
    }

    const toRank = RANK_ORDER[toRankIndex];
    const toRankCapacity = RANK_CAPACITY[toRank] || Infinity;

    // 상위 계급의 현재 인원 수 확인
    const currentUpperRankCount = await Gin7Character.countDocuments({
      sessionId,
      faction,
      'currentRank.code': toRank,
    });

    const hasCapacity = currentUpperRankCount < toRankCapacity;

    return ladder.slice(0, 10).map((entry) => ({
      characterId: entry.characterId,
      name: entry.name,
      currentRank: entry.rank,
      merit: entry.merit,
      effectiveMerit: entry.effectiveMerit,
      ladderPosition: entry.position,
      isEligible: entry.position === 1 && hasCapacity,
      reason: !hasCapacity
        ? `상위 계급 정원 초과 (${currentUpperRankCount}/${toRankCapacity})`
        : entry.position !== 1
          ? '래더 1위가 아님'
          : undefined,
    }));
  }

  /**
   * 자동 승진 처리 (매월 1일 실행)
   */
  public async processAutoPromotions(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
  ): Promise<Array<{ characterId: string; fromRank: string; toRank: string }>> {
    const promotions: Array<{ characterId: string; fromRank: string; toRank: string }> = [];

    // 대좌 이하 계급에 대해 자동 승진 처리
    const autoPromoteRanks = [
      'CAPTAIN',
      'COMMANDER',
      'LIEUTENANT_COMMANDER',
      'LIEUTENANT',
      'ENSIGN',
      'WARRANT_OFFICER',
      'SERGEANT',
      'CORPORAL',
    ];

    for (const rank of autoPromoteRanks) {
      const candidates = await this.getPromotionCandidates(sessionId, faction, rank);
      const eligible = candidates.filter((c) => c.isEligible);

      for (const candidate of eligible) {
        const toRankIndex = RANK_ORDER.indexOf(rank) - 1;
        if (toRankIndex < 0) continue;

        const toRank = RANK_ORDER[toRankIndex];

        // 승진 처리
        const character = await Gin7Character.findOne({
          sessionId,
          characterId: candidate.characterId,
        });

        if (character) {
          character.currentRank = toRank;

          // 자동 승진 시 래더 평균 공적 부여
          const ladder = await this.getRankLadder(sessionId, faction, toRank);
          const averageMerit =
            ladder.length > 0
              ? Math.floor(ladder.reduce((sum, e) => sum + e.merit, 0) / ladder.length)
              : 100;

          character.meritPoints = averageMerit;
          await character.save();

          promotions.push({
            characterId: candidate.characterId,
            fromRank: rank,
            toRank,
          });

          this.emit('promotion:auto', {
            sessionId,
            characterId: candidate.characterId,
            fromRank: rank,
            toRank,
            newMerit: averageMerit,
          });

          logger.info(
            `[MeritService] Auto promotion: ${candidate.name} ${rank} -> ${toRank} (merit: ${averageMerit})`,
          );
        }
      }
    }

    return promotions;
  }

  /**
   * 승진 처리 (수동)
   */
  public async promoteCharacter(
    sessionId: string,
    characterId: string,
    promoterId: string,
  ): Promise<{ success: boolean; newRank?: string; oldRank?: string; error?: string }> {
    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, error: `캐릭터를 찾을 수 없습니다: ${characterId}` };
      }

      const currentRank = character.currentRank || 'PRIVATE';
      const currentRankIndex = RANK_ORDER.indexOf(currentRank);

      if (currentRankIndex <= 0) {
        return { success: false, error: '이미 최고 계급입니다.' };
      }

      const newRank = RANK_ORDER[currentRankIndex - 1];

      // 정원 확인
      const newRankCapacity = RANK_CAPACITY[newRank] || Infinity;
      const currentCount = await Gin7Character.countDocuments({
        sessionId,
        faction: character.faction,
        currentRank: newRank,
      });

      if (currentCount >= newRankCapacity) {
        return { success: false, error: `상위 계급 정원이 가득 찼습니다.` };
      }

      // 승진 처리
      character.currentRank = newRank;
      character.meritPoints = 0; // 승진 시 공적 리셋
      await character.save();

      this.emit('promotion:manual', {
        sessionId,
        characterId,
        fromRank: currentRank,
        toRank: newRank,
        promoterId,
      });

      logger.info(`[MeritService] Manual promotion: ${characterId} ${currentRank} -> ${newRank}`);
      return { success: true, newRank, oldRank: currentRank };
    } catch (error) {
      logger.error(`[MeritService] Error promoting character: ${error}`);
      return { success: false, error: '승진 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 강등 처리
   */
  public async demoteCharacter(
    sessionId: string,
    characterId: string,
    demoterId: string,
  ): Promise<{ success: boolean; newRank?: string; oldRank?: string; error?: string }> {
    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return { success: false, error: `캐릭터를 찾을 수 없습니다: ${characterId}` };
      }

      const currentRank = character.currentRank || 'PRIVATE';
      const currentRankIndex = RANK_ORDER.indexOf(currentRank);

      if (currentRankIndex >= RANK_ORDER.length - 1) {
        return { success: false, error: '더 이상 강등할 수 없습니다.' };
      }

      const newRank = RANK_ORDER[currentRankIndex + 1];

      // 강등 처리
      character.currentRank = newRank;
      character.meritPoints = 100; // 강등 시 공적 100으로 리셋
      await character.save();

      this.emit('demotion', {
        sessionId,
        characterId,
        fromRank: currentRank,
        toRank: newRank,
        demoterId,
      });

      logger.info(`[MeritService] Demotion: ${characterId} ${currentRank} -> ${newRank}`);
      return { success: true, newRank, oldRank: currentRank };
    } catch (error) {
      logger.error(`[MeritService] Error demoting character: ${error}`);
      return { success: false, error: '강등 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 계급 코드로 한글 이름 조회
   */
  private getRankName(rankCode: string): string {
    const names: Record<string, string> = {
      MARSHAL: '원수',
      SENIOR_ADMIRAL: '상급대장',
      ADMIRAL: '대장',
      VICE_ADMIRAL: '중장',
      REAR_ADMIRAL: '소장',
      COMMODORE: '준장',
      CAPTAIN: '대좌',
      COMMANDER: '중좌',
      LIEUTENANT_COMMANDER: '소좌',
      LIEUTENANT: '대위',
      ENSIGN: '소위',
      WARRANT_OFFICER: '준위',
      SERGEANT: '조장',
      CORPORAL: '병장',
      PRIVATE: '이등병',
    };
    return names[rankCode] || rankCode;
  }

  /**
   * 계급 사다리의 최상위 여부 확인
   */
  public async isTopOfRankLadder(
    sessionId: string,
    characterId: string
  ): Promise<boolean> {
    // 모든 래더를 확인하여 최상위 계급에 있는지 체크
    // 최상위 계급 확인을 위해 가장 높은 계급의 래더만 조회
    const topRankLadder = await this.getRankLadder(sessionId, 'IMPERIAL', RANK_ORDER[0]);
    if (!topRankLadder || topRankLadder.length === 0) return false;
    
    return topRankLadder[0].characterId === characterId;
  }
}

export const meritService = MeritService.getInstance();
export default MeritService;





