import { BattleSkillService } from '../BattleSkillService';
import { BattleSkillSystem, type BattleSkillContext } from '../../../battle/BattleSkillSystem';

jest.mock('../../../battle/BattleSkillSystem', () => {
  const actual = jest.requireActual('../../../battle/BattleSkillSystem');
  return {
    ...actual,
    BattleSkillSystem: {
      runBattleInitTriggers: jest.fn(),
      runBattlePhaseTriggers: jest.fn(),
    },
  };
});

const mockedBattleSkillSystem = BattleSkillSystem as jest.Mocked<typeof BattleSkillSystem>;

describe('BattleSkillService', () => {
  const attacker = { id: 'attacker' } as any;
  const defender = { id: 'defender' } as any;

  const baseContext: BattleSkillContext = {
    attacker,
    defender,
    env: null,
    attackerInitCaller: null,
    defenderInitCaller: null,
    attackerPhaseCaller: null,
    defenderPhaseCaller: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defender가 없으면 초기 스킬을 실행하지 않고 null을 반환한다', () => {
    const context = BattleSkillService.initializeBattle(attacker, null);

    expect(context).toBeNull();
    expect(mockedBattleSkillSystem.runBattleInitTriggers).not.toHaveBeenCalled();
  });

  it('초기 스킬 트리거를 실행하고 컨텍스트를 반환한다', () => {
    mockedBattleSkillSystem.runBattleInitTriggers.mockReturnValue(baseContext);

    const context = BattleSkillService.initializeBattle(attacker, defender);

    expect(mockedBattleSkillSystem.runBattleInitTriggers).toHaveBeenCalledWith(attacker, defender);
    expect(context).toBe(baseContext);
  });

  it('페이즈 컨텍스트가 없으면 null을 반환한다', () => {
    const context = BattleSkillService.runPhaseTriggers(null);

    expect(context).toBeNull();
    expect(mockedBattleSkillSystem.runBattlePhaseTriggers).not.toHaveBeenCalled();
  });

  it('페이즈 스킬 트리거를 실행하고 업데이트된 컨텍스트를 반환한다', () => {
    const updatedContext: BattleSkillContext = {
      ...baseContext,
      env: { turn: 1 } as any,
    };
    mockedBattleSkillSystem.runBattlePhaseTriggers.mockReturnValue(updatedContext);

    const context = BattleSkillService.runPhaseTriggers(baseContext);

    expect(mockedBattleSkillSystem.runBattlePhaseTriggers).toHaveBeenCalledWith(baseContext);
    expect(context).toBe(updatedContext);
  });
});

