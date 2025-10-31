/**
 * 게임 상수
 * config/constants.json에서 로드
 */

export class GameConstants {
  static readonly MAX_TURN = 30;
  static readonly MAX_CHIEF_TURN = 12;
  static readonly DEFAULT_TURN_TERM = 600; // 10분
  static readonly DEFAULT_START_YEAR = 180;
  static readonly DEFAULT_GOLD = 1000;
  static readonly DEFAULT_RICE = 1000;
  static readonly MAX_LEVEL = 255;
  static readonly MAX_GENERAL = 500;
  static readonly MAX_NATION = 55;
  
  static readonly DEFAULT_STAT_MIN = 30;
  static readonly DEFAULT_STAT_MAX = 100;
  static readonly DEFAULT_STAT_TOTAL = 200;
  
  static readonly INHERIT_BORN_STAT_POINT = 1000;
  static readonly INHERIT_ITEM_UNIQUE_MIN_POINT = 5000;
  static readonly INHERIT_ITEM_RANDOM_POINT = 3000;
  static readonly INHERIT_BUFF_POINTS = [0, 200, 600, 1200, 2000, 3000];
  static readonly INHERIT_SPECIFIC_SPECIAL_POINT = 4000;
  static readonly INHERIT_RESET_ATTR_POINT_BASE = [1000, 1000, 2000, 3000];
  static readonly INHERIT_CHECK_OWNER_POINT = 1000;
  
  static calcResetAttrPoint(level: number): number {
    const base = [...this.INHERIT_RESET_ATTR_POINT_BASE];
    while (base.length <= level) {
      const baseLen = base.length;
      base.push(base[baseLen - 1] + base[baseLen - 2]);
    }
    return base[level];
  }
}

export default GameConstants;
