import { GeneralRepository } from '../repository/general.repository';
import { CacheManager } from '../../infrastructure/cache/cache-manager';

export class GeneralService {
  private repository = new GeneralRepository();
  private cache = new CacheManager();

  async getById(id: string) {
    const cacheKey = `cache:general:${id}`;
    
    // TODO: L1/L2 캐시 조회
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // TODO: DB 조회
    const general = await this.repository.findById(id);
    
    if (general) {
      // TODO: 캐시 저장
      await this.cache.set(cacheKey, general, 3);
    }
    
    return general;
  }

  async getAll(limit: number, skip: number) {
    // TODO: Implement getAll
    return this.repository.findAll(limit, skip);
  }

  async getByNation(nationId: string) {
    // TODO: Implement getByNation with caching
    return this.repository.findByNation(nationId);
  }
}
