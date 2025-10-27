import { ItemRepository } from '../repository/item.repository';

/**
 * Item Service
 * 
 * Manages in-game items including inventory and item types
 */
export class ItemService {
  constructor(private repository: ItemRepository) {}

  async findByOwnerId(sessionId: string, ownerId: string) {
    return await this.repository.findByOwnerId(sessionId, ownerId);
  }

  async findByType(sessionId: string, type: string) {
    return await this.repository.findByType(sessionId, type);
  }
}
