export enum InheritanceKey {
  active_action = 'active_action',
  leadership = 'leadership',
  strength = 'strength',
  intel = 'intel',
  experience = 'experience',
  gold_earned = 'gold_earned',
  battle_won = 'battle_won',
  city_occupied = 'city_occupied',
  general_recruited = 'general_recruited',
  special_skills = 'special_skills',
}

export interface InheritancePoint {
  key: InheritanceKey;
  value: number;
  timestamp: Date;
}

/**
 * 계승 포인트 유틸리티 클래스
 */
export class InheritancePointUtil {
  /**
   * 장수의 계승 포인트 증가
   */
  static async increasePoint(general: any, key: InheritanceKey | string, amount: number = 1): Promise<void> {
    if (!general || !general.data) {
      return;
    }

    const normalizedKey = normalizeInheritanceKey(key);
    if (!normalizedKey) {
      return;
    }
    
    if (!general.data.inheritance_points) {
      general.data.inheritance_points = {};
    }
    
    const currentValue = general.data.inheritance_points[normalizedKey] || 0;
    general.data.inheritance_points[normalizedKey] = currentValue + amount;
    general.markModified('data.inheritance_points');
  }

  /**
   * 장수의 계승 포인트 조회
   */
  static getPoint(general: any, key: InheritanceKey | string): number {
    if (!general || !general.data || !general.data.inheritance_points) {
      return 0;
    }
    const normalizedKey = normalizeInheritanceKey(key);
    if (!normalizedKey) {
      return 0;
    }
    
    return general.data.inheritance_points[normalizedKey] || 0;
  }

  /**
   * 장수의 모든 계승 포인트 조회
   */
  static getAllPoints(general: any): Record<string, number> {
    if (!general || !general.data || !general.data.inheritance_points) {
      return {};
    }
    
    return general.data.inheritance_points;
  }

  /**
   * 계승 포인트 초기화
   */
  static resetPoints(general: any): void {
    if (!general || !general.data) {
      return;
    }
    
    general.data.inheritance_points = {};
    general.markModified('data.inheritance_points');
  }

  /**
   * 계승 포인트 합계 계산
   */
  static getTotalPoints(general: any): number {
    const points = this.getAllPoints(general);
    return Object.values(points).reduce((sum, val) => sum + val, 0);
  }
}

function normalizeInheritanceKey(key: InheritanceKey | string | undefined | null): string | null {
  if (key == null) {
    return null;
  }
  const normalized = String(key);
  return normalized.trim().length > 0 ? normalized : null;
}
