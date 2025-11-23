import { ReserveBulkCommandService } from '../ReserveBulkCommand.service';
import { generalTurnRepository } from '../../../repositories/general-turn.repository';
import { invalidateCache } from '../../../common/cache/model-cache.helper';

jest.mock('../../../repositories/general-turn.repository', () => ({
  generalTurnRepository: {
    findOneAndUpdate: jest.fn().mockResolvedValue({})
  }
}));

jest.mock('../../../common/cache/model-cache.helper', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined)
}));

describe('ReserveBulkCommandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates general caches after successful bulk reservation', async () => {
    const result = await ReserveBulkCommandService.execute(
      {
        session_id: 'session-bulk',
        general_id: 99,
        commands: [
          {
            action: '훈련',
            turnList: [0, 1],
            arg: {}
          }
        ]
      },
      { generalId: 99 }
    );

    expect(result.success).toBe(true);
    expect(generalTurnRepository.findOneAndUpdate).toHaveBeenCalled();
    expect(invalidateCache).toHaveBeenCalledWith('general', 'session-bulk', 99);
  });
});
