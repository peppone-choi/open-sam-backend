import { Achievement } from '../models/achievement.model';
import { logger } from '../common/logger';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  FIRST_JOIN: {
    id: 'FIRST_JOIN',
    name: '첫 걸음',
    description: '처음으로 장수를 생성하여 게임에 참여했습니다.',
    icon: '👶',
    points: 10
  },
  FIRST_UNIFICATION: {
    id: 'FIRST_UNIFICATION',
    name: '천하통일',
    description: '소속 국가가 천하를 통일했습니다.',
    icon: '👑',
    points: 100
  },
  MILLIONAIRE: {
    id: 'MILLIONAIRE',
    name: '거상',
    description: '개인 자금 100만 금을 돌파했습니다.',
    icon: '💰',
    points: 50
  },
  VETERAN: {
    id: 'VETERAN',
    name: '백전노장',
    description: '전투 참여 횟수 100회를 달성했습니다.',
    icon: '🛡️',
    points: 50
  },
  TREASURE_HUNT: {
    id: 'TREASURE_HUNT',
    name: '보물 탐색가',
    description: '탐색 중 희귀한 유니크 아이템을 발견했습니다.',
    icon: '💎',
    points: 30
  }
};

export class AchievementService {
  /**
   * 업적 달성 확인 및 지급
   */
  static async award(userId: string, achievementId: string, metadata?: any) {
    const def = ACHIEVEMENTS[achievementId];
    if (!def) {
      logger.warn(`[Achievement] Unknown achievement: ${achievementId}`);
      return;
    }

    try {
      const existing = await Achievement.findOne({ user_id: userId, achievement_id: achievementId });
      if (existing) return;

      const earned = await Achievement.create({
        user_id: userId,
        achievement_id: achievementId,
        name: def.name,
        description: def.description,
        icon: def.icon,
        points: def.points,
        metadata
      });

      logger.info(`[Achievement] User ${userId} earned: ${def.name}`);
      
      // TODO: 웹소켓으로 알림 전송
      
      return earned;
    } catch (error: any) {
      logger.error(`[Achievement] Error awarding achievement ${achievementId} to ${userId}`, error);
    }
  }

  /**
   * 사용자의 업적 목록 조회
   */
  static async listForUser(userId: string) {
    return Achievement.find({ user_id: userId }).sort({ earned_at: -1 }).lean();
  }
}
