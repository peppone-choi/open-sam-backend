/**
 * Gin7 Character Types
 * 은하영웅전설 캐릭터 생성 시스템 타입 정의
 */

/** 8대 스탯 - 우주전 특화 */
export interface Gin7Stats {
  leadership: number;    // 통솔 - 함대/부대 통솔 능력
  command: number;       // 지휘 - 전술 지휘 능력
  operation: number;     // 운영 - 내정/보급 관리 능력
  intelligence: number;  // 정보 - 정보전/첩보 능력
  piloting: number;      // 조종 - 함선 조종 능력
  attack: number;        // 공격 - 공격력
  defense: number;       // 방어 - 방어력
  mobility: number;      // 기동 - 기동력
}

export type Gin7StatKey = keyof Gin7Stats;

export const GIN7_STAT_KEYS: Gin7StatKey[] = [
  'leadership', 'command', 'operation', 'intelligence',
  'piloting', 'attack', 'defense', 'mobility'
];

export const GIN7_STAT_NAMES: Record<Gin7StatKey, string> = {
  leadership: '통솔',
  command: '지휘',
  operation: '운영',
  intelligence: '정보',
  piloting: '조종',
  attack: '공격',
  defense: '방어',
  mobility: '기동'
};

/** 스탯 롤링 설정 */
export interface StatRollingConfig {
  totalPoints: number;    // 총합 제한 (기본: 60)
  minStat: number;        // 최소값 (기본: 1)
  maxStat: number;        // 최대값 (기본: 10)
  mean: number;           // 정규분포 평균 (기본: 7.5)
  stdDev: number;         // 정규분포 표준편차 (기본: 2)
}

export const DEFAULT_STAT_CONFIG: StatRollingConfig = {
  totalPoints: 60,
  minStat: 1,
  maxStat: 10,
  mean: 7.5,
  stdDev: 2
};

/** 포인트 구매 방식 비용 테이블 */
export const POINT_BUY_COST: Record<number, number> = {
  1: -4,   // 1점은 4포인트 환급
  2: -2,   // 2점은 2포인트 환급
  3: -1,   // 3점은 1포인트 환급
  4: 0,    // 4점은 무료
  5: 1,    // 5점은 1포인트 소모
  6: 2,    // 6점은 2포인트 소모
  7: 3,    // 7점은 3포인트 소모
  8: 5,    // 8점은 5포인트 소모
  9: 7,    // 9점은 7포인트 소모
  10: 10,  // 10점은 10포인트 소모
};

export const INITIAL_BUY_POINTS = 20;

/** 트레잇 시스템 */
export type Gin7TraitCategory = 'positive' | 'negative' | 'special' | 'legendary';

export interface Gin7Trait {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  category: Gin7TraitCategory;
  rarity: number;           // 0.0 ~ 1.0 (획득 확률)
  pointCost: number;        // 양수: 비용, 음수: 환급
  effects: Gin7TraitEffect[];
  conflicts?: string[];     // 상충 트레잇 ID 목록
  requires?: string[];      // 필요 트레잇 ID 목록
}

export interface Gin7TraitEffect {
  type: 'stat_bonus' | 'stat_multiplier' | 'exp_bonus' | 'morale_bonus' | 
        'resource_bonus' | 'special_ability' | 'diplomacy_bonus';
  target?: Gin7StatKey | 'all' | 'combat' | 'support';
  value: number;
  description?: string;
}

/** 진영 정의 */
export type Gin7Faction = 'empire' | 'alliance' | 'phezzan' | 'neutral';

export const GIN7_FACTION_NAMES: Record<Gin7Faction, string> = {
  empire: '은하제국',
  alliance: '자유행성동맹',
  phezzan: '페잔 자치령',
  neutral: '중립/기타'
};

/** 오리지널 캐릭터 정의 */
export interface OriginalCharacter {
  id: string;
  name: string;
  nameKo: string;
  faction: Gin7Faction;
  rank: string;
  stats: Gin7Stats;
  traits: string[];
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  reputationCost: number;   // 추첨 신청에 필요한 명성 포인트
  portrait?: string;        // 초상화 경로
}

/** 캐릭터 생성 요청 */
export interface CreateCharacterRequest {
  name: string;
  faction: Gin7Faction;
  method: 'roll' | 'point_buy';
  seed?: string;            // 랜덤 시드 (재현성)
  traitIds?: string[];      // 선택한 트레잇
}

/** 캐릭터 생성 결과 */
export interface CreateCharacterResult {
  success: boolean;
  character?: {
    name: string;
    faction: Gin7Faction;
    stats: Gin7Stats;
    traits: string[];
    totalStatPoints: number;
    traitPointsUsed: number;
  };
  error?: string;
}

/** 오리지널 캐릭터 추첨 */
export interface LotteryApplication {
  id: string;
  userId: string;
  sessionId: string;
  targetCharacterId: string;
  reputationPaid: number;
  appliedAt: Date;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
}

export interface LotteryPool {
  sessionId: string;
  characterId: string;
  applications: LotteryApplication[];
  status: 'open' | 'closed' | 'completed';
  closesAt: Date;
  winnerId?: string;
  drawnAt?: Date;
}

/** 이름 생성 스타일 */
export type NameStyle = 'imperial' | 'alliance' | 'phezzan';

export interface NameGeneratorConfig {
  style: NameStyle;
  gender?: 'male' | 'female' | 'neutral';
  includeTitle?: boolean;
}

