import { cacheService } from '../cache.service';
import { invalidateCache } from '../model-cache.helper';

jest.mock('../cache.service', () => ({
  cacheService: {
    invalidate: jest.fn().mockResolvedValue(undefined)
  }
}));

const invalidateSpy = cacheService.invalidate as jest.MockedFunction<typeof cacheService.invalidate>;

describe('invalidateCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates general caches with explicit id', async () => {
    await invalidateCache('general', 'sessionA', 42);

    expect(invalidateSpy).toHaveBeenCalledWith(
      [
        'general:byId:sessionA:42',
        'general:byNo:sessionA:42',
        'generals:list:sessionA',
        'generals:neutral:sessionA'
      ],
      [
        'general:owner:sessionA:*',
        'generals:nation:sessionA:*',
        'generals:city:sessionA:*'
      ]
    );
  });

  it('invalidates general caches for entire session when id missing', async () => {
    await invalidateCache('general', 'sessionB');

    expect(invalidateSpy).toHaveBeenCalledWith(
      [
        'generals:list:sessionB',
        'generals:neutral:sessionB'
      ],
      [
        'general:byId:sessionB:*',
        'general:byNo:sessionB:*',
        'general:owner:sessionB:*',
        'generals:nation:sessionB:*',
        'generals:city:sessionB:*'
      ]
    );
  });

  it('invalidates city caches with entity + lists by default', async () => {
    await invalidateCache('city', 'sessionC', 7);

    expect(invalidateSpy).toHaveBeenCalledWith(
      [
        'city:byId:sessionC:7',
        'cities:list:sessionC',
        'cities:neutral:sessionC'
      ],
      ['cities:nation:sessionC:*']
    );
  });

  it('invalidates only list caches when requested', async () => {
    await invalidateCache('city', 'sessionD', undefined, { targets: ['lists'] });

    expect(invalidateSpy).toHaveBeenCalledWith(
      [
        'cities:list:sessionD',
        'cities:neutral:sessionD'
      ],
      ['cities:nation:sessionD:*']
    );
  });

  it('invalidates session caches including state + lists', async () => {
    await invalidateCache('session', 'sessionE');

    expect(invalidateSpy).toHaveBeenCalledWith(
      [
        'session:byId:sessionE',
        'session:state:sessionE'
      ],
      ['sessions:*']
    );
  });
});
