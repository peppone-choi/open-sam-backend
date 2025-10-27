import { BattleFieldTileRepository } from '../repository/battlefield-tile.repository';
import { IBattleFieldTileDocument } from '../model/battlefield-tile.model';

/**
 * Battlefield Tile Service
 * 
 * Manages tactical battlefield tile configurations for city-based combat
 */
export class BattleFieldTileService {
  constructor(private repository: BattleFieldTileRepository) {}

  async findByCityId(sessionId: string, cityId: string): Promise<IBattleFieldTileDocument | null> {
    return await this.repository.findByCityId(sessionId, cityId);
  }

  async create(data: Partial<IBattleFieldTileDocument>): Promise<IBattleFieldTileDocument> {
    return await this.repository.create(data);
  }

  async update(sessionId: string, cityId: string, tiles: any[]): Promise<IBattleFieldTileDocument | null> {
    return await this.repository.update(sessionId, cityId, tiles);
  }

  async findBySessionId(sessionId: string): Promise<IBattleFieldTileDocument[]> {
    return await this.repository.findBySessionId(sessionId);
  }

  async getOrCreateTiles(sessionId: string, cityId: string): Promise<IBattleFieldTileDocument> {
    let tiles = await this.findByCityId(sessionId, cityId);
    if (!tiles) {
      tiles = await this.create({ sessionId, cityId, tiles: [] });
    }
    return tiles;
  }
}
