import { MoveCommand } from '../general/move';
import { 
  MockObjects,
  ConstraintTestHelper,
  CommandTestHelper,
} from './test-helpers';

// 스택 시스템 제거됨

jest.mock('../../events/StaticEventHandler', () => ({
  StaticEventHandler: {
    handleEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/unique-item-lottery', () => ({
  tryUniqueItemLottery: jest.fn().mockResolvedValue(undefined),
}));

describe('MoveCommand', () => {
  it('should have correct static metadata', () => {
    expect(MoveCommand.getName()).toBe('이동');
    expect(MoveCommand.reqArg).toBe(true);
  });

  it('should validate arg correctly', () => {
    const { command: validCmd } = CommandTestHelper.prepareCommand(
      MoveCommand,
      {},
      {},
      {},
      {},
      { destCityID: 2 },
    );
    expect(validCmd.isArgumentValid()).toBe(true);

    const { command: invalidCmd } = CommandTestHelper.prepareCommand(
      MoveCommand,
      {},
      {},
      {},
      {},
      { wrongKey: 2 },
    );
    expect(invalidCmd.isArgumentValid()).toBe(false);
  });

  it('should define min and full constraints', () => {
    const { command } = CommandTestHelper.prepareCommand(
      MoveCommand,
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
    expect(Array.isArray(min)).toBe(true);
    expect(Array.isArray(full)).toBe(true);

    expect(ConstraintTestHelper.hasConstraint(full, 'NearCity')).toBe(true);
  });

  it('should move general to destination and consume cost', async () => {
    const initialGold = 1000;
    const { command, general } = CommandTestHelper.prepareCommand(
      MoveCommand,
      { gold: initialGold, city: 1, atmos: 50 },
      { city: 1, name: '시작도시' },
      {},
      { develcost: 100, session_id: 'test_session' },
      { destCityID: 2 },
    );
 
    // DB 의존성을 피하기 위해 setDestCityAsync를 스텁 처리
    (command as any).setDestCityAsync = jest.fn(async (cityId: number) => {
      (command as any).destCity = {
        city: cityId,
        name: '도착도시',
        nation: 1,
        pop: 0,
        agri: 0,
        comm: 0,
        secu: 0,
        def: 0,
        wall: 0,
        trust: 0,
      };
    });
 
    // 제약은 이미 만족한다고 가정
    (command as any).fullConditionConstraints = [];
 
    const rng = MockObjects.createMockRNG();
    const result = await command.run(rng);
    expect(result).toBe(true);

    // 도시 이동 (updateGeneralCity는 data.city를 갱신한다)
    expect(general.data.city).toBe(2);

    // 비용 차감 및 사기 감소
    const [goldCost] = command.getCost();
    expect(general._vars.get('gold')).toBe(initialGold - goldCost);
    expect(general._vars.get('atmos')).toBeLessThan(50);

    // 경험치 및 통솔 경험 증가
    expect(general.addExperience).toHaveBeenCalled();
    expect(general.increaseVar).toHaveBeenCalledWith('leadership_exp', 1);
  });
});
