import { General } from '../general.model';
import { WarUnitTriggerCaller } from '../../game/triggers/WarUnitTriggerCaller';

describe('General battle action wiring', () => {
  it('applies special war stat hooks', () => {
    const general = new General({
      no: 1,
      session_id: 'test',
      owner: 'tester',
      name: '검증대상',
      data: {
        special2: 'che_필살',
      },
    });

    const criticalRatio = general.onCalcStat(general, 'warCriticalRatio', 0.05, { isAttacker: true });
    expect(criticalRatio).toBeCloseTo(0.35, 5);
  });

  it('provides battle trigger callers for special wars', () => {
    const general = new General({
      no: 2,
      session_id: 'test',
      owner: 'tester',
      name: '치료장수',
      data: {
        special2: 'che_의술',
      },
    });

    const caller = general.getBattlePhaseSkillTriggerList({} as any);
    expect(caller).toBeInstanceOf(WarUnitTriggerCaller);
    expect(caller?.isEmpty()).toBe(false);
  });

  it('combines war power multipliers from battle actions', () => {
    const general = new General({
      no: 3,
      session_id: 'test',
      owner: 'tester',
      name: '무쌍장수',
      rank: { killnum: 20 },
      data: {
        special2: 'che_무쌍',
        nation: 1,
      },
    });

    const [selfMult, foeMult] = general.getWarPowerMultiplier({ getGeneral: () => general } as any);
    expect(selfMult).toBeGreaterThan(1);
    expect(foeMult).toBeLessThan(1);
  });
});
