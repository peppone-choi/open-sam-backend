import { ItemModel } from '../model/item.model';

export class ItemRepository {
  // TODO: 구현
  
  async findByOwnerId(sessionId: string, ownerId: string) {
    return await ItemModel.find({ sessionId, ownerId }).lean().exec();
  }
  
  async findByType(sessionId: string, type: string) {
    return await ItemModel.find({ sessionId, type }).lean().exec();
  }
}
