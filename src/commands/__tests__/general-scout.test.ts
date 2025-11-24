import { ScoutCommand } from '../general/scout';
import {
  MockObjects,
  CommandTestHelper,
} from './test-helpers';

jest.mock('../../utils/unique-item-lottery', () => ({
  tryUniqueItemLottery: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/rng-utils', () => ({
  genGenericUniqueRNGFromGeneral: jest.fn(() => ({
    next: (min: number, max: number) => min,
  })),
}));

jest.mock('../../events/StaticEventHandler', () => ({
  StaticEventHandler: {
    handleEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ScoutCommand', () => {
  it('should have correct static metadata', () => {
    expect(ScoutCommand.getName()).toBe('견문');
    expect(ScoutCommand.reqArg).toBe(false);
  });

  it('should create instance without arg', () => {
    const { command } = CommandTestHelper.prepareCommand(ScoutCommand);
    expect(command).toBeDefined();
    expect(command.isArgumentValid()).toBe(true);
  });

  it('should execute and grant experience or resources', async () => {
    const { command, general } = CommandTestHelper.prepareCommand(ScoutCommand);
 
    // RNG: 항상 첫 번째 이벤트를 선택하도록 next 구현
    const rng: any = {
      next: () => 0,
    };
 
    const result = await command.run(rng);
    expect(result).toBe(true);
 
    // 경험치 증가 혹은 능력/자원 변화 함수가 호출되었는지 확인
    expect(general.addExperience).toHaveBeenCalled();
    expect(general.checkStatChange).toHaveBeenCalled();
  });
});
