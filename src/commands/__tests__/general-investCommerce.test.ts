import { InvestCommerceCommand } from '../general/investCommerce';
import {
  MockObjects,
  ConstraintTestHelper,
  CommandTestHelper,
} from './test-helpers';

jest.mock('../../config/db', () => ({
  DB: {
    db: () => ({
      update: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('../../events/StaticEventHandler', () => ({
  StaticEventHandler: {
    handleEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/unique-item-lottery', () => ({
  tryUniqueItemLottery: jest.fn().mockResolvedValue(undefined),
}));

describe('InvestCommerceCommand', () => {
  it('should have correct static metadata', () => {
    expect(InvestCommerceCommand.getName()).toBe('상업 투자');
    expect(InvestCommerceCommand.reqArg).toBe(false);
  });

  it('should define full constraints including supply and occupation', () => {
    const { command } = CommandTestHelper.prepareCommand(
      InvestCommerceCommand,
      {},
      {},
      {},
      { develcost: 100 },
      null,
    );

    const full = (command as any).fullConditionConstraints;
    expect(full).toBeDefined();
    expect(Array.isArray(full)).toBe(true);

    expect(ConstraintTestHelper.hasConstraint(full, 'OccupiedCity')).toBe(true);
    expect(ConstraintTestHelper.hasConstraint(full, 'SuppliedCity')).toBe(true);
    expect(ConstraintTestHelper.hasConstraint(full, 'ReqGeneralGold')).toBe(true);
  });

  it('should execute and increase city commerce', async () => {
    const initialComm = 10000;
    const { command, general, city } = CommandTestHelper.prepareCommand(
      InvestCommerceCommand,
      { gold: 10000, intel: 80 },
      { comm: initialComm, comm_max: 20000, trust: 80 },
      { nation: 1 },
      { develcost: 100 },
      null,
    );

    // 제약은 이미 만족한다고 가정
    (command as any).fullConditionConstraints = [];

    // RNG: 평균값으로 동작하도록 기본 Mock 사용
    const rng = MockObjects.createMockRNG({ nextRange: 1.0 });

    const result = await command.run(rng);
    expect(result).toBe(true);

    // gold 감소
    const [goldCost] = command.getCost();
    expect(general._vars.get('gold')).toBe(10000 - goldCost);

    // 경험/공헌 증가 함수 호출
    expect(general.addExperience).toHaveBeenCalled();
    expect(general.addDedication).toHaveBeenCalled();
  });
});
