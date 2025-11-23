import { ReserveCommandService } from '../ReserveCommand.service';
import { invalidateCache } from '../../../common/cache/model-cache.helper';
import { generalTurnRepository } from '../../../repositories/general-turn.repository';

jest.mock('../../../repositories/general-turn.repository', () => ({
  generalTurnRepository: {
    findOneByFilter: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue({})
  }
}));

jest.mock('../../../common/cache/model-cache.helper', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined)
}));

describe('ReserveCommandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates general caches after reserving commands', async () => {
    const result = await ReserveCommandService.execute(
      {
        session_id: 'session-command',
        general_id: 7,
        turn_idx: 0,
        action: '훈련',
        arg: {}
      },
      { generalId: 7 }
    );

    expect(result.success).toBe(true);
    expect(invalidateCache).toHaveBeenCalledWith('general', 'session-command', 7);
    expect(generalTurnRepository.findOneAndUpdate).toHaveBeenCalled();
  });
});
