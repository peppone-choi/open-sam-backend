/**
 * Achievement.service.ts - 업적 시스템 서비스
 *
 * 장수의 업적 달성을 추적하고 보상을 지급합니다.
 */

import { generalRepository } from '../../repositories/general.repository';
import { logger } from '../../common/logger';

/**
 * 업적 타입
 */
export enum AchievementType {
  // 전투 업적
  FIRST_BATTLE = 'first_battle',           // 첫 전투
  BATTLE_10 = 'battle_10',                 // 10회 전투
  BATTLE_100 = 'battle_100',               // 100회 전투
  FIRST_KILL = 'first_kill',               // 첫 적장 사살
  KILL_10 = 'kill_10',                     // 10명 사살
  KILL_100 = 'kill_100',                   // 100명 사살
  CONQUER_CITY = 'conquer_city',           // 도시 점령
  CONQUER_CAPITAL = 'conquer_capital',     // 수도 점령
  
  // 내정 업적
  INVEST_FIRST = 'invest_first',           // 첫 내정
  INVEST_100 = 'invest_100',               // 100회 내정
  BUILD_WALL = 'build_wall',               // 성벽 증축
  IRRIGATION = 'irrigation',               // 관개 시설 건설
  
  // 외교 업적
  ALLIANCE = 'alliance',                   // 동맹 체결
  DECLARE_WAR = 'declare_war',             // 선전포고
  
  // 인사 업적
  RECRUIT_GENERAL = 'recruit_general',     // 장수 등용
  RECRUIT_10 = 'recruit_10',               // 10명 등용
  PRISONER_RECRUIT = 'prisoner_recruit',   // 포로 등용
  
  // 국가 업적
  FOUND_NATION = 'found_nation',           // 건국
  BECOME_KING = 'become_king',             // 왕 칭호 획득
  UNIFY = 'unify',                         // 천하통일
  
  // 특수 업적
  SURVIVE_DEATH = 'survive_death',         // 위독에서 생존
  ESCAPE_PRISON = 'escape_prison',         // 포로 탈출
  WEALTH_1000000 = 'wealth_1000000',       // 재산 100만
}

/**
 * 업적 설정
 */
export interface AchievementConfig {
  id: AchievementType;
  name: string;
  description: string;
  category: 'battle' | 'domestic' | 'diplomacy' | 'personnel' | 'nation' | 'special';
  condition: (stats: Record<string, number>) => boolean;
  reward: {
    gold?: number;
    rice?: number;
    exp?: number;
    dedication?: number;
    inheritPoint?: number;
  };
  hidden?: boolean;  // 숨김 업적 여부
}

/**
 * 업적 목록
 */
export const ACHIEVEMENTS: Record<AchievementType, AchievementConfig> = {
  [AchievementType.FIRST_BATTLE]: {
    id: AchievementType.FIRST_BATTLE,
    name: '초전',
    description: '첫 전투에 참여했습니다.',
    category: 'battle',
    condition: (s) => (s.warnum || 0) >= 1,
    reward: { exp: 100, dedication: 50 },
  },
  [AchievementType.BATTLE_10]: {
    id: AchievementType.BATTLE_10,
    name: '백전노장',
    description: '10회 전투에 참여했습니다.',
    category: 'battle',
    condition: (s) => (s.warnum || 0) >= 10,
    reward: { exp: 500, dedication: 200 },
  },
  [AchievementType.BATTLE_100]: {
    id: AchievementType.BATTLE_100,
    name: '전장의 영웅',
    description: '100회 전투에 참여했습니다.',
    category: 'battle',
    condition: (s) => (s.warnum || 0) >= 100,
    reward: { exp: 2000, dedication: 1000, inheritPoint: 10 },
  },
  [AchievementType.FIRST_KILL]: {
    id: AchievementType.FIRST_KILL,
    name: '첫 승리',
    description: '적장을 처음으로 사살했습니다.',
    category: 'battle',
    condition: (s) => (s.killnum || 0) >= 1,
    reward: { exp: 200, gold: 100 },
  },
  [AchievementType.KILL_10]: {
    id: AchievementType.KILL_10,
    name: '맹장',
    description: '적장 10명을 사살했습니다.',
    category: 'battle',
    condition: (s) => (s.killnum || 0) >= 10,
    reward: { exp: 1000, gold: 500 },
  },
  [AchievementType.KILL_100]: {
    id: AchievementType.KILL_100,
    name: '무쌍',
    description: '적장 100명을 사살했습니다.',
    category: 'battle',
    condition: (s) => (s.killnum || 0) >= 100,
    reward: { exp: 5000, gold: 2000, inheritPoint: 20 },
  },
  [AchievementType.CONQUER_CITY]: {
    id: AchievementType.CONQUER_CITY,
    name: '정복자',
    description: '도시를 점령했습니다.',
    category: 'battle',
    condition: (s) => (s.conquernum || 0) >= 1,
    reward: { exp: 300, dedication: 100 },
  },
  [AchievementType.CONQUER_CAPITAL]: {
    id: AchievementType.CONQUER_CAPITAL,
    name: '왕좌의 파괴자',
    description: '적국의 수도를 점령했습니다.',
    category: 'battle',
    condition: (s) => (s.capitalconquer || 0) >= 1,
    reward: { exp: 1000, dedication: 500, inheritPoint: 5 },
  },
  [AchievementType.INVEST_FIRST]: {
    id: AchievementType.INVEST_FIRST,
    name: '내정가',
    description: '첫 내정에 성공했습니다.',
    category: 'domestic',
    condition: (s) => (s.investnum || 0) >= 1,
    reward: { exp: 50, dedication: 30 },
  },
  [AchievementType.INVEST_100]: {
    id: AchievementType.INVEST_100,
    name: '치세의 달인',
    description: '100회 내정에 성공했습니다.',
    category: 'domestic',
    condition: (s) => (s.investnum || 0) >= 100,
    reward: { exp: 1000, dedication: 500 },
  },
  [AchievementType.BUILD_WALL]: {
    id: AchievementType.BUILD_WALL,
    name: '축성가',
    description: '성벽을 증축했습니다.',
    category: 'domestic',
    condition: (s) => (s.buildwall || 0) >= 1,
    reward: { exp: 200, dedication: 100 },
  },
  [AchievementType.IRRIGATION]: {
    id: AchievementType.IRRIGATION,
    name: '수리 전문가',
    description: '관개 시설을 건설했습니다.',
    category: 'domestic',
    condition: (s) => (s.irrigation || 0) >= 1,
    reward: { exp: 200, dedication: 100 },
  },
  [AchievementType.ALLIANCE]: {
    id: AchievementType.ALLIANCE,
    name: '외교관',
    description: '동맹을 체결했습니다.',
    category: 'diplomacy',
    condition: (s) => (s.alliancenum || 0) >= 1,
    reward: { exp: 300, dedication: 150 },
  },
  [AchievementType.DECLARE_WAR]: {
    id: AchievementType.DECLARE_WAR,
    name: '선전포고',
    description: '전쟁을 선포했습니다.',
    category: 'diplomacy',
    condition: (s) => (s.declarewar || 0) >= 1,
    reward: { exp: 200 },
  },
  [AchievementType.RECRUIT_GENERAL]: {
    id: AchievementType.RECRUIT_GENERAL,
    name: '인재 발굴',
    description: '장수를 등용했습니다.',
    category: 'personnel',
    condition: (s) => (s.recruitnum || 0) >= 1,
    reward: { exp: 100, dedication: 50 },
  },
  [AchievementType.RECRUIT_10]: {
    id: AchievementType.RECRUIT_10,
    name: '인재 수집가',
    description: '10명의 장수를 등용했습니다.',
    category: 'personnel',
    condition: (s) => (s.recruitnum || 0) >= 10,
    reward: { exp: 500, dedication: 300 },
  },
  [AchievementType.PRISONER_RECRUIT]: {
    id: AchievementType.PRISONER_RECRUIT,
    name: '관용의 군주',
    description: '포로를 등용했습니다.',
    category: 'personnel',
    condition: (s) => (s.prisonerrecruit || 0) >= 1,
    reward: { exp: 200, dedication: 100 },
  },
  [AchievementType.FOUND_NATION]: {
    id: AchievementType.FOUND_NATION,
    name: '건국의 아버지',
    description: '새 나라를 세웠습니다.',
    category: 'nation',
    condition: (s) => (s.foundnation || 0) >= 1,
    reward: { exp: 1000, dedication: 500, inheritPoint: 10 },
  },
  [AchievementType.BECOME_KING]: {
    id: AchievementType.BECOME_KING,
    name: '왕의 자리',
    description: '왕 칭호를 획득했습니다.',
    category: 'nation',
    condition: (s) => (s.becomeking || 0) >= 1,
    reward: { exp: 2000, dedication: 1000, inheritPoint: 20 },
  },
  [AchievementType.UNIFY]: {
    id: AchievementType.UNIFY,
    name: '천하통일',
    description: '천하를 통일했습니다.',
    category: 'nation',
    condition: (s) => (s.unify || 0) >= 1,
    reward: { exp: 10000, dedication: 5000, inheritPoint: 100 },
  },
  [AchievementType.SURVIVE_DEATH]: {
    id: AchievementType.SURVIVE_DEATH,
    name: '불사조',
    description: '위독 상태에서 생존했습니다.',
    category: 'special',
    condition: (s) => (s.survivedeath || 0) >= 1,
    reward: { exp: 500, inheritPoint: 5 },
    hidden: true,
  },
  [AchievementType.ESCAPE_PRISON]: {
    id: AchievementType.ESCAPE_PRISON,
    name: '탈옥수',
    description: '포로 상태에서 탈출했습니다.',
    category: 'special',
    condition: (s) => (s.escapeprison || 0) >= 1,
    reward: { exp: 300 },
    hidden: true,
  },
  [AchievementType.WEALTH_1000000]: {
    id: AchievementType.WEALTH_1000000,
    name: '거부',
    description: '재산 100만을 달성했습니다.',
    category: 'special',
    condition: (s) => (s.gold || 0) >= 1000000,
    reward: { inheritPoint: 10 },
    hidden: true,
  },
};

/**
 * 업적 서비스 클래스
 */
export class AchievementService {
  /**
   * 업적 달성 체크 및 보상 지급
   */
  static async checkAchievements(
    sessionId: string,
    generalId: number
  ): Promise<AchievementType[]> {
    const achieved: AchievementType[] = [];

    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return achieved;

      const generalData = general.data || {};
      const stats = generalData.stats || {};
      const currentAchievements = generalData.achievements || [];

      // 각 업적 체크
      for (const [key, config] of Object.entries(ACHIEVEMENTS)) {
        const achievementId = key as AchievementType;
        
        // 이미 달성한 업적은 스킵
        if (currentAchievements.includes(achievementId)) continue;

        // 조건 체크
        if (config.condition(stats)) {
          achieved.push(achievementId);
          
          // 보상 지급
          if (config.reward.gold) {
            generalData.gold = (generalData.gold || 0) + config.reward.gold;
          }
          if (config.reward.rice) {
            generalData.rice = (generalData.rice || 0) + config.reward.rice;
          }
          if (config.reward.exp) {
            generalData.experience = (generalData.experience || 0) + config.reward.exp;
          }
          if (config.reward.dedication) {
            generalData.dedication = (generalData.dedication || 0) + config.reward.dedication;
          }
          
          logger.info('[Achievement] Unlocked', {
            sessionId,
            generalId,
            achievement: achievementId,
            name: config.name,
          });
        }
      }

      // 달성한 업적 저장
      if (achieved.length > 0) {
        generalData.achievements = [...currentAchievements, ...achieved];
        await generalRepository.updateBySessionAndNo(sessionId, generalId, {
          data: generalData,
        });
      }

      return achieved;
    } catch (error: any) {
      logger.error('[Achievement] Check failed', {
        sessionId,
        generalId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 특정 업적 잠금 해제
   */
  static async unlockAchievement(
    sessionId: string,
    generalId: number,
    achievementId: AchievementType
  ): Promise<boolean> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return false;

      const generalData = general.data || {};
      const currentAchievements = generalData.achievements || [];

      if (currentAchievements.includes(achievementId)) {
        return false; // 이미 달성
      }

      const config = ACHIEVEMENTS[achievementId];
      if (!config) return false;

      // 업적 추가 및 보상 지급
      generalData.achievements = [...currentAchievements, achievementId];
      
      if (config.reward.gold) {
        generalData.gold = (generalData.gold || 0) + config.reward.gold;
      }
      if (config.reward.rice) {
        generalData.rice = (generalData.rice || 0) + config.reward.rice;
      }
      if (config.reward.exp) {
        generalData.experience = (generalData.experience || 0) + config.reward.exp;
      }
      if (config.reward.dedication) {
        generalData.dedication = (generalData.dedication || 0) + config.reward.dedication;
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        data: generalData,
      });

      logger.info('[Achievement] Manually unlocked', {
        sessionId,
        generalId,
        achievement: achievementId,
      });

      return true;
    } catch (error: any) {
      logger.error('[Achievement] Unlock failed', {
        sessionId,
        generalId,
        achievementId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 장수의 달성 업적 목록 조회
   */
  static async getAchievements(
    sessionId: string,
    generalId: number
  ): Promise<AchievementConfig[]> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return [];

      const generalData = general.data || {};
      const achievedIds = generalData.achievements || [];

      return achievedIds
        .map((id: AchievementType) => ACHIEVEMENTS[id])
        .filter((config: AchievementConfig | undefined): config is AchievementConfig => !!config);
    } catch (error: any) {
      logger.error('[Achievement] Get failed', {
        sessionId,
        generalId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * 모든 업적 목록 조회 (숨김 업적 제외)
   */
  static getAllAchievements(includeHidden: boolean = false): AchievementConfig[] {
    return Object.values(ACHIEVEMENTS).filter(
      (config) => includeHidden || !config.hidden
    );
  }

  /**
   * 스탯 증가 헬퍼 (업적 트래킹용)
   */
  static async incrementStat(
    sessionId: string,
    generalId: number,
    statKey: string,
    amount: number = 1
  ): Promise<void> {
    try {
      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      if (!general) return;

      const generalData = general.data || {};
      generalData.stats = generalData.stats || {};
      generalData.stats[statKey] = (generalData.stats[statKey] || 0) + amount;

      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        'data.stats': generalData.stats,
      });

      // 업적 체크
      await this.checkAchievements(sessionId, generalId);
    } catch (error: any) {
      logger.error('[Achievement] Increment stat failed', {
        sessionId,
        generalId,
        statKey,
        error: error.message,
      });
    }
  }
}

export default AchievementService;





