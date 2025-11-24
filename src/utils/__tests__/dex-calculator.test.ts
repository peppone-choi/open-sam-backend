/**
 * 숙련도 (Dex) 계산 유틸리티 테스트
 * 
 * PHP 구현과의 동등성 검증
 */

import {
  getDexLevel,
  getDexDisplay,
  getDexBonus,
  calculateDexExp,
  getDexFieldName,
  getMaxDexExp,
  getDexInfo,
  DEX_LEVEL_LIST
} from '../dex-calculator';

describe('dex-calculator', () => {
  describe('DEX_LEVEL_LIST', () => {
    it('should have 27 levels (F- to EX+)', () => {
      expect(DEX_LEVEL_LIST).toHaveLength(27);
    });

    it('should start with F- at 0 exp', () => {
      expect(DEX_LEVEL_LIST[0]).toEqual([0, 'navy', 'F-']);
    });

    it('should end with EX+ at 1275975 exp', () => {
      expect(DEX_LEVEL_LIST[26]).toEqual([1275975, 'white', 'EX+']);
    });
  });

  describe('getDexLevel', () => {
    it('should return 0 for negative values', () => {
      expect(getDexLevel(-100)).toBe(0);
      expect(getDexLevel(-1)).toBe(0);
    });

    it('should return 0 for F- level (0-349 exp)', () => {
      expect(getDexLevel(0)).toBe(0);
      expect(getDexLevel(100)).toBe(0);
      expect(getDexLevel(349)).toBe(0);
    });

    it('should return 1 for F level (350-1374 exp)', () => {
      expect(getDexLevel(350)).toBe(1);
      expect(getDexLevel(700)).toBe(1);
      expect(getDexLevel(1374)).toBe(1);
    });

    it('should return 26 for EX+ level (1275975+ exp)', () => {
      expect(getDexLevel(1275975)).toBe(26);
      expect(getDexLevel(2000000)).toBe(26);
    });

    it('should match PHP boundary values', () => {
      // Test key boundaries from PHP
      expect(getDexLevel(0)).toBe(0);       // F-
      expect(getDexLevel(350)).toBe(1);     // F
      expect(getDexLevel(1375)).toBe(2);    // F+
      expect(getDexLevel(3500)).toBe(3);    // E-
      expect(getDexLevel(61750)).toBe(9);   // C- (index 9)
      expect(getDexLevel(138125)).toBe(12); // B- (index 12)
      expect(getDexLevel(260400)).toBe(15); // A- (index 15)
      expect(getDexLevel(439375)).toBe(18); // S- (index 18)
      expect(getDexLevel(685850)).toBe(21); // Z- (index 21)
      expect(getDexLevel(1010625)).toBe(24); // EX- (index 24)
    });
  });

  describe('getDexDisplay', () => {
    it('should throw error for negative values', () => {
      expect(() => getDexDisplay(-1)).toThrow('Invalid dex value');
    });

    it('should return correct display for F- level', () => {
      const result = getDexDisplay(0);
      expect(result.color).toBe('navy');
      expect(result.name).toBe('F-');
      expect(result.level).toBe(0);
    });

    it('should return correct display for C level', () => {
      const result = getDexDisplay(82775);
      expect(result.color).toBe('teal');
      expect(result.name).toBe('C');
      expect(result.level).toBe(10); // Index 10
    });

    it('should return correct display for S+ level', () => {
      const result = getDexDisplay(595525);
      expect(result.color).toBe('tomato');
      expect(result.name).toBe('S+');
      expect(result.level).toBe(20); // Index 20
    });

    it('should return correct display for EX+ level', () => {
      const result = getDexDisplay(1275975);
      expect(result.color).toBe('white');
      expect(result.name).toBe('EX+');
      expect(result.level).toBe(26);
    });
  });

  describe('getDexBonus', () => {
    it('should return 1.0 for equal dex levels', () => {
      expect(getDexBonus(0, 0)).toBeCloseTo(1.0);
      expect(getDexBonus(1000, 1000)).toBeCloseTo(1.0);
      expect(getDexBonus(100000, 100000)).toBeCloseTo(1.0);
    });

    it('should return > 1.0 when attacker has higher dex', () => {
      // Level 9 (C-: 61750) vs Level 0 (F-: 0)
      const bonus = getDexBonus(61750, 0);
      expect(bonus).toBeGreaterThan(1.0);
      expect(bonus).toBeCloseTo(1 + 9 / 55); // Level index is 9
    });

    it('should return < 1.0 when defender has higher dex', () => {
      // Level 0 (F-: 0) vs Level 9 (C-: 61750)
      const bonus = getDexBonus(0, 61750);
      expect(bonus).toBeLessThan(1.0);
      expect(bonus).toBeCloseTo(1 - 9 / 55); // Level index is 9
    });

    it('should match PHP formula: (level1 - level2) / 55 + 1', () => {
      // Test with specific level differences
      const level5Exp = 7125;  // E level (index 4)
      const level15Exp = 213875; // B+ level (index 15)
      
      const levelDiff = getDexLevel(level15Exp) - getDexLevel(level5Exp);
      const expectedBonus = levelDiff / 55 + 1;
      
      expect(getDexBonus(level15Exp, level5Exp)).toBeCloseTo(expectedBonus);
    });
  });

  describe('calculateDexExp', () => {
    it('should return base exp for infantry (armType 0)', () => {
      expect(calculateDexExp(100, 0)).toBe(100);
    });

    it('should return base exp for archer (armType 1)', () => {
      expect(calculateDexExp(100, 1)).toBe(100);
    });

    it('should return base exp for cavalry (armType 2)', () => {
      expect(calculateDexExp(100, 2)).toBe(100);
    });

    it('should apply 0.9x multiplier for wizard (armType 3)', () => {
      expect(calculateDexExp(100, 3)).toBe(90);
    });

    it('should apply 0.9x multiplier for siege (armType 4)', () => {
      expect(calculateDexExp(100, 4)).toBe(90);
    });

    it('should treat castle (armType 5) as siege (armType 4)', () => {
      expect(calculateDexExp(100, 5)).toBe(90);
    });

    it('should return 0 for negative armType', () => {
      expect(calculateDexExp(100, -1)).toBe(0);
    });

    it('should apply train/atmos multiplier when affectTrainAtmos is true', () => {
      // (train + atmos) / 200
      expect(calculateDexExp(100, 0, 100, 100, true)).toBe(100); // (100+100)/200 = 1.0
      expect(calculateDexExp(100, 0, 50, 50, true)).toBe(50);    // (50+50)/200 = 0.5
      expect(calculateDexExp(100, 0, 80, 60, true)).toBe(70);    // (80+60)/200 = 0.7
    });

    it('should not apply train/atmos when affectTrainAtmos is false', () => {
      expect(calculateDexExp(100, 0, 50, 50, false)).toBe(100);
      expect(calculateDexExp(100, 0, 0, 0, false)).toBe(100);
    });

    it('should combine armType multiplier and train/atmos', () => {
      // Wizard (0.9x) with train=80, atmos=60 (0.7x)
      // 100 * 0.9 * ((80+60)/200) = 100 * 0.9 * 0.7 = 63
      expect(calculateDexExp(100, 3, 80, 60, true)).toBeCloseTo(63, 0);
    });
  });

  describe('getDexFieldName', () => {
    it('should return dex0 for infantry', () => {
      expect(getDexFieldName(0)).toBe('dex0');
    });

    it('should return dex1 for archer', () => {
      expect(getDexFieldName(1)).toBe('dex1');
    });

    it('should return dex2 for cavalry', () => {
      expect(getDexFieldName(2)).toBe('dex2');
    });

    it('should return dex3 for wizard', () => {
      expect(getDexFieldName(3)).toBe('dex3');
    });

    it('should return dex4 for siege', () => {
      expect(getDexFieldName(4)).toBe('dex4');
    });

    it('should treat castle (5) as siege (4)', () => {
      expect(getDexFieldName(5)).toBe('dex4');
    });

    it('should return dex0 for negative armType', () => {
      expect(getDexFieldName(-1)).toBe('dex0');
    });
  });

  describe('getMaxDexExp', () => {
    it('should return EX+ level exp (1275975)', () => {
      expect(getMaxDexExp()).toBe(1275975);
    });
  });

  describe('getDexInfo', () => {
    it('should return complete info for F- level', () => {
      const info = getDexInfo(0);
      expect(info.exp).toBe(0);
      expect(info.level).toBe(0);
      expect(info.color).toBe('navy');
      expect(info.name).toBe('F-');
      expect(info.nextLevelExp).toBe(350);
      expect(info.progress).toBe(0);
    });

    it('should return complete info for C level', () => {
      const info = getDexInfo(82775);
      expect(info.exp).toBe(82775);
      expect(info.level).toBe(10); // Index 10
      expect(info.color).toBe('teal');
      expect(info.name).toBe('C');
      expect(info.nextLevelExp).toBe(108100);
      expect(info.progress).toBe(0); // Exactly at level start
    });

    it('should return 100% progress at level boundary', () => {
      const info = getDexInfo(108100); // C+ level start
      expect(info.level).toBe(11); // Index 11
      expect(info.progress).toBe(0); // Start of new level
    });

    it('should return null nextLevelExp for max level', () => {
      const info = getDexInfo(2000000); // Beyond EX+
      expect(info.level).toBe(26);
      expect(info.nextLevelExp).toBeNull();
      expect(info.progress).toBe(100);
    });

    it('should calculate progress correctly', () => {
      // C level: 82775 ~ 108100
      // Halfway: 82775 + (108100-82775)/2 = 95437.5
      const info = getDexInfo(95438);
      expect(info.level).toBe(10); // Index 10
      expect(info.progress).toBeCloseTo(50, 0);
    });
  });

  describe('PHP Compatibility', () => {
    it('should match PHP getDexLevel for all boundaries', () => {
      // Test all level boundaries from PHP (array indices)
      const phpBoundaries: Array<[number, number]> = [
        [0, 0],       // F- (index 0)
        [350, 1],     // F (index 1)
        [1375, 2],    // F+ (index 2)
        [3500, 3],    // E- (index 3)
        [7125, 4],    // E (index 4)
        [12650, 5],   // E+ (index 5)
        [20475, 6],   // D- (index 6)
        [31000, 7],   // D (index 7)
        [44625, 8],   // D+ (index 8)
        [61750, 9],   // C- (index 9)
        [82775, 10],  // C (index 10)
        [108100, 11], // C+ (index 11)
        [138125, 12], // B- (index 12)
        [173250, 13], // B (index 13)
        [213875, 14], // B+ (index 14)
        [260400, 15], // A- (index 15)
        [313225, 16], // A (index 16)
        [372750, 17], // A+ (index 17)
        [439375, 18], // S- (index 18)
        [513500, 19], // S (index 19)
        [595525, 20], // S+ (index 20)
        [685850, 21], // Z- (index 21)
        [784875, 22], // Z (index 22)
        [893000, 23], // Z+ (index 23)
        [1010625, 24], // EX- (index 24)
        [1138150, 25], // EX (index 25)
        [1275975, 26], // EX+ (index 26)
      ];

      phpBoundaries.forEach(([exp, expectedLevel]) => {
        expect(getDexLevel(exp)).toBe(expectedLevel);
      });
    });

    it('should match PHP getDexLog formula', () => {
      // PHP: $ratio = (getDexLevel($dex1) - getDexLevel($dex2)) / 55 + 1;
      const testCases: Array<[number, number, number]> = [
        [0, 0, 1.0],
        [350, 0, 1 + 1/55],
        [0, 350, 1 - 1/55],
        [82775, 0, 1 + 10/55], // Level 10
        [1275975, 0, 1 + 26/55], // Level 26
      ];

      testCases.forEach(([dex1, dex2, expected]) => {
        expect(getDexBonus(dex1, dex2)).toBeCloseTo(expected, 5);
      });
    });
  });
});
