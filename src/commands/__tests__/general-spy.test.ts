import { SpyCommand } from '../general/spy';
import {
  MockObjects,
  ConstraintTestHelper,
  CommandTestHelper,
} from './test-helpers';

jest.mock('../../config/db', () => ({
  DB: {
    db: () => ({
      query: jest.fn().mockResolvedValue([]),
      queryFirstField: jest.fn().mockResolvedValue('{}'),
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

jest.mock('../../func/searchDistance', () => ({
  searchDistance: jest.fn(() => ({ 2: 1 })),
}));

describe('SpyCommand', () => {
  it('should have correct static metadata', () => {
    expect(SpyCommand.getName()).toBe('첩보');
    expect(SpyCommand.reqArg).toBe(true);
  });

  it('should validate arg correctly', () => {
    const { command: validCmd } = CommandTestHelper.prepareCommand(
      SpyCommand,
      {},
      {},
      {},
      {},
      { destCityID: 2 },
    );
    expect(validCmd.isArgumentValid()).toBe(true);

    const { command: invalidCmd } = CommandTestHelper.prepareCommand(
      SpyCommand,
      {},
      {},
      {},
      {},
      {},
    );
    expect(invalidCmd.isArgumentValid()).toBe(false);
  });

  it('should define min and full constraints', () => {
    const { command } = CommandTestHelper.prepareCommand(
      SpyCommand,
      {},
      {},
      {},
      {},
      { destCityID: 2 },
    );

    const min = (command as any).minConditionConstraints;
    const full = (command as any).fullConditionConstraints;

    expect(min).toBeDefined();
    expect(full).toBeDefined();

    expect(ConstraintTestHelper.hasConstraint(min, 'ReqGeneralGold')).toBe(true);
    expect(ConstraintTestHelper.hasConstraint(full, 'ReqGeneralGold')).toBe(true);
  });

  it('should execute and consume gold/rice', async () => {
    const initialGold = 1000;
    const initialRice = 1000;

    const { command, general } = CommandTestHelper.prepareCommand(
      SpyCommand,
      { gold: initialGold, rice: initialRice },
      { city: 1, name: '시작도시' },
      { nation: 1 },
      { develcost: 50 },
      { destCityID: 2 },
    );

    // 제약은 이미 만족한다고 가정
    (command as any).fullConditionConstraints = [];

    const rng = MockObjects.createMockRNG({
      nextRange: 50,
    });

    const result = await command.run(rng);
    expect(result).toBe(true);

    const [goldCost, riceCost] = command.getCost();
    expect(general._vars.get('gold')).toBe(initialGold - goldCost);
    expect(general._vars.get('rice')).toBe(initialRice - riceCost);

    expect(general.addExperience).toHaveBeenCalled();
    expect(general.addDedication).toHaveBeenCalled();
  });
});
