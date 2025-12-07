import { computeBattleOrderScore, resolveDamageOutcome } from '../../services/battle/BattleCalculationService';

describe('BattleCalculationService - computeBattleOrderScore', () => {
  it('기본 수치에서 순서를 계산한다', () => {
    const score = computeBattleOrderScore({
      crew: 10000,
      rice: 1000,
      defenceTrain: 50,
      train: 70,
      atmos: 80,
      realLeadership: 80,
      realStrength: 70,
      realIntel: 60,
      fullLeadership: 85,
      fullStrength: 75,
      fullIntel: 65
    });

    // 수식 기반 기대값과 근사 비교
    expect(score).toBeCloseTo(245, 0);
  });

  it('조건 미충족 시 0을 반환한다', () => {
    const zeroCrew = computeBattleOrderScore({
      crew: 0,
      rice: 1000,
      defenceTrain: 50,
      train: 70,
      atmos: 80,
      realLeadership: 80,
      realStrength: 70,
      realIntel: 60,
      fullLeadership: 85,
      fullStrength: 75,
      fullIntel: 65
    });
    expect(zeroCrew).toBe(0);

    const lowRice = computeBattleOrderScore({
      crew: 10000,
      rice: 50,
      defenceTrain: 50,
      train: 70,
      atmos: 80,
      realLeadership: 80,
      realStrength: 70,
      realIntel: 60,
      fullLeadership: 85,
      fullStrength: 75,
      fullIntel: 65
    });
    expect(lowRice).toBe(0);

    const lowTrain = computeBattleOrderScore({
      crew: 10000,
      rice: 1000,
      defenceTrain: 90,
      train: 80,
      atmos: 95,
      realLeadership: 80,
      realStrength: 70,
      realIntel: 60,
      fullLeadership: 85,
      fullStrength: 75,
      fullIntel: 65
    });
    expect(lowTrain).toBe(0);
  });
});

describe('BattleCalculationService - resolveDamageOutcome', () => {
  it('오버킬이 없는 경우 단순 반올림 처리', () => {
    const result = resolveDamageOutcome({
      attackerHP: 120,
      defenderHP: 140,
      rawAttackerDamage: 30.2,
      rawDefenderDamage: 25.7
    });

    expect(result.attackerDamage).toBe(31);
    expect(result.defenderDamage).toBe(26);
  });

  it('오버킬 발생 시 비율에 따라 보정한다', () => {
    const result = resolveDamageOutcome({
      attackerHP: 50,
      defenderHP: 30,
      rawAttackerDamage: 60, // 수비자가 가한 피해 (공격자 손실)
      rawDefenderDamage: 40  // 공격자가 가한 피해 (수비자 손실)
    });

    // 수비자가 더 큰 비율로 피해를 받으므로 공격자 피해를 비율로 축소
    expect(result.attackerDamage).toBe(45);
    expect(result.defenderDamage).toBe(30);
  });
});

