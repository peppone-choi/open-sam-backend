import { CityRepository } from '../repository/city.repository';
import { BattleFieldTileRepository } from '../../battlefield-tile/repository/battlefield-tile.repository';
import { CacheManager } from '../../../infrastructure/cache/cache-manager';
import { ICity } from '../../../@types';

export class CityService {
  constructor(
    private repository: CityRepository,
    private cacheManager: CacheManager,
    private battleFieldTileRepository: BattleFieldTileRepository
  ) {}

  async getById(id: string) {
    // TODO: Implement with caching
    return this.repository.findById(id);
  }

  async getByNation(nationId: string) {
    // TODO: Implement with caching
    return this.repository.findByNation(nationId);
  }
  
  /**
   * 도시 생성 (타일도 함께 생성)
   */
  async create(sessionId: string, cityData: Partial<ICity>): Promise<any> {
    // TODO: 1. 도시 생성
    const city = await this.repository.create({
      sessionId,
      ...cityData,
    } as any);
    
    // TODO: 2. 해당 도시의 40x40 타일 생성 (전부 plain)
    await this.createInitialTiles(sessionId, city.id);
    
    return city;
  }
  
  /**
   * 초기 타일 생성 (1600개 plain)
   */
  private async createInitialTiles(sessionId: string, cityId: string) {
    const tiles = [];
    
    // 1600개 타일 생성 (전부 풀밭)
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        tiles.push({
          x,
          y,
          terrainType: 'plain',
          movable: true,
          moveCost: 1,
          defenseBonus: 0,
          height: 0,
        });
      }
    }
    
    await this.battleFieldTileRepository.create({
      sessionId,
      cityId,
      tiles,
      castleX: 20,
      castleY: 20,
      castleSize: 3,
    } as any);
  }
}
