/**
 * Item 도메인 타입 정의
 */

export interface IItem {
  id: string;
  sessionId: string;
  
  // 아이템 정보
  name: string;
  type: 'weapon' | 'book' | 'horse' | 'item';
  
  // 능력치 보너스
  leadershipBonus?: number;
  strengthBonus?: number;
  intelBonus?: number;
  
  // 특수 효과
  specialEffect?: string;
  
  // 등급/희귀도
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  
  // 소유자
  ownerId?: string; // General ID
  
  // 설명
  description?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
