import { ARM_TYPE } from '../../const/GameUnitConst';
import {
  DEX_LEVEL_LIST,
  getDexLevel,
  getDexBonus,
  calculateDexExp,
  getDexInfo,
} from '../dex-calculator';

describe('dex-calculator (minimal parity tests)', () => {
  it('maps key thresholds to correct levels', () => {
    expect(getDexLevel(0)).toBe(0);                 // F-
    expect(getDexLevel(350)).toBe(1);               // F
    expect(getDexLevel(1375)).toBe(2);              // F+
    expect(getDexLevel(DEX_LEVEL_LIST[26][0])).toBe(26); // EX+
  });

  it('dex bonus is approximately symmetric inverse', () => {
    const a = 82775;  // C level
    const b = 0;      // F-
    const forward = getDexBonus(a, b);
    const backward = getDexBonus(b, a);
    expect(forward).toBeGreaterThan(1);
    expect(backward).toBeLessThan(1);
    expect(forward * backward).toBeCloseTo(1, 5);
  });

  it('calculateDexExp applies type and train/atmos multipliers', () => {
    // Infantry: no penalty, no train/atmos effect by default
    expect(calculateDexExp(100, ARM_TYPE.FOOTMAN)).toBe(100);

    // Wizard: 0.9x
    expect(calculateDexExp(100, ARM_TYPE.WIZARD)).toBeCloseTo(90);

    // Siege with train/atmos effect: 0.9 * ((50+50)/200) = 0.45
    expect(calculateDexExp(100, ARM_TYPE.SIEGE, 50, 50, true)).toBeCloseTo(45);
  });

  it('getDexInfo exposes level, next threshold, and progress', () => {
    const info0 = getDexInfo(0);
    expect(info0.level).toBe(0);
    expect(info0.nextLevelExp).toBe(DEX_LEVEL_LIST[1][0]);
    expect(info0.progress).toBe(0);

    const maxExp = DEX_LEVEL_LIST[DEX_LEVEL_LIST.length - 1][0];
    const infoMax = getDexInfo(maxExp);
    expect(infoMax.level).toBe(DEX_LEVEL_LIST.length - 1);
    expect(infoMax.nextLevelExp).toBeNull();
    expect(infoMax.progress).toBe(100);
  });
});
