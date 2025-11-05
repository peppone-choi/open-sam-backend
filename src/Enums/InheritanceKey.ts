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
  static async increasePoint(general: any, key: InheritanceKey, amount: number = 1): Promise<void> {
    if (!general || !general.data) {
      return;
    }
    
    // inheritance_points 객체 초기화
    if (!general.data.inheritance_points) {
      general.data.inheritance_points = {};
    }
    
    // 현재 값 가져오기
    const currentValue = general.data.inheritance_points[key] || 0;
    
    // 값 증가
    general.data.inheritance_points[key] = currentValue + amount;
    
    // markModified 호출 (Mixed 타입 필드)
    general.markModified('data.inheritance_points');
    
    // DB 저장은 호출자가 담당
  }

  /**
   * 장수의 계승 포인트 조회
   */
  static getPoint(general: any, key: InheritanceKey): number {
    if (!general || !general.data || !general.data.inheritance_points) {
      return 0;
    }
    
    return general.data.inheritance_points[key] || 0;
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
