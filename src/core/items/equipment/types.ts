/**
 * 무기/방어구/서적 관련 타입 정의
 */

// ============================================
// 슬롯 및 기본 타입
// ============================================

/**
 * 아이템 슬롯
 */
export enum ItemSlot {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  HELMET = 'helmet',
  MOUNT = 'mount',
  ACCESSORY = 'accessory',
  BOOK = 'book'
}

/**
 * 스탯 타입
 */
export type StatType = 
  | 'leadership'        // 통솔
  | 'strength'          // 무력
  | 'intel'             // 지력
  | 'attack'            // 공격력
  | 'defense'           // 방어력
  | 'critical'          // 필살 확률
  | 'evade'             // 회피 확률
  | 'speed';            // 이동 속도

/**
 * 전투 스탯 타입
 */
export type BattleStatType =
  | 'warMagicTrialProb'    // 계략 시도 확률
  | 'warMagicSuccessProb'  // 계략 성공 확률
  | 'warAvoidRatio'        // 회피 확률
  | 'warCriticalRatio'     // 필살 확률
  | 'sabotageDefence';     // 계략 방어

// ============================================
// 보너스 인터페이스
// ============================================

/**
 * 스탯 보너스
 */
export interface StatBonus {
  strength?: number;
  intel?: number;
  leadership?: number;
}

/**
 * 전투 보너스
 */
export interface BattleBonus {
  attack?: number;
  defense?: number;
  critical?: number;
  evade?: number;
  speed?: number;
}

/**
 * 스킬 보너스
 */
export interface SkillBonus {
  tactics?: number;
  counterTactics?: number;
  siege?: number;
  farming?: number;
  commerce?: number;
}

// ============================================
// 전투 관련 인터페이스
// ============================================

/**
 * 지형 타입
 */
export type TerrainType = 
  | 'plain'
  | 'forest'
  | 'mountain'
  | 'river'
  | 'city'
  | 'fort';

/**
 * 날씨 타입
 */
export type WeatherType = 
  | 'clear'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'storm';

/**
 * 전투 페이즈
 */
export type BattlePhase = 
  | 'deployment'
  | 'planning'
  | 'initiative'
  | 'ranged'
  | 'melee'
  | 'tactics'
  | 'retreat'
  | 'resolution';

/**
 * 위치 인터페이스
 */
export interface Position {
  x: number;
  y: number;
  z?: number;
}

/**
 * 아이템 참조
 */
export interface ItemRef {
  id: string;
  slot: ItemSlot;
}

/**
 * 전투 유닛 (간소화)
 */
export interface BattleUnit {
  id: string;
  generalId: number;
  name: string;
  strength: number;
  intel: number;
  leadership: number;
  crew: number;
  crewType: string;
  train: number;
  morale: number;
  hp: number;
  maxHp: number;
  items: ItemRef[];
  specialities: string[];
  side: 'attacker' | 'defender';
  position: Position;
}

/**
 * 전투 컨텍스트 (간소화)
 */
export interface BattleContext {
  battleId: string;
  sessionId: string;
  attacker: BattleUnit;
  defender: BattleUnit;
  terrain: TerrainType;
  weather: WeatherType;
  phase: BattlePhase;
  turn: number;
}

/**
 * 장수 인터페이스 (간소화)
 */
export interface General {
  id: number;
  name: string;
  leadership: number;
  strength: number;
  intel: number;
  crew: number;
  getLeadership?(base?: boolean, bonus?: boolean, item?: boolean, special?: boolean): number;
  getVar?(name: string): number;
}


