/**
 * 세계관 타입 정의
 *
 * OpenSAM 범용 게임 엔진
 * - 삼국지 (Sangokushi)
 * - 은하영웅전설 (Legend of Galactic Heroes)
 */

/**
 * 지원하는 세계관 타입
 */
export type WorldType = 'sangokushi' | 'logh';

/**
 * 세계관 메타데이터
 */
export interface WorldMetadata {
  type: WorldType;
  name: string;
  version: string;
  description: string;
}

/**
 * 삼국지 세계관
 */
export interface SangokushiWorld extends WorldMetadata {
  type: 'sangokushi';

  /**
   * 시대 설정
   */
  era: {
    startYear: number;
    currentYear: number;
    currentMonth: number;
  };

  /**
   * 세력 목록
   */
  factions: string[];

  /**
   * 도시 목록
   */
  cities: string[];
}

/**
 * 은하영웅전설 세계관
 */
export interface LoghWorld extends WorldMetadata {
  type: 'logh';

  /**
   * 시대 설정 (우주력)
   */
  era: {
    imperialCalendar: number;
    currentYear: number;
    currentMonth: number;
  };

  /**
   * 세력 목록
   */
  factions: string[];

  /**
   * 항성계 목록
   */
  starSystems: string[];
}

/**
 * 범용 세계
 */
export type World = SangokushiWorld | LoghWorld;

/**
 * 세계 타입 가드
 */
export function isSangokushi(world: World): world is SangokushiWorld {
  return world.type === 'sangokushi';
}

export function isLogh(world: World): world is LoghWorld {
  return world.type === 'logh';
}
