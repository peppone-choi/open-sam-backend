import { BattleFieldTileModel, IBattleFieldTileDocument } from '../model/battlefield-tile.model';

export class BattleFieldTileRepository {
  /**
   * 도시의 타일 조회
   */
  async findByCityId(sessionId: string, cityId: string): Promise<IBattleFieldTileDocument | null> {
    return await BattleFieldTileModel.findOne({ sessionId, cityId }).lean().exec();
  }

  /**
   * 타일 생성 (도시당 최초 1회)
   */
  async create(data: Partial<IBattleFieldTileDocument>): Promise<IBattleFieldTileDocument> {
    const doc = new BattleFieldTileModel(data);
    return await doc.save();
  }

  /**
   * 타일 업데이트 (필요 시)
   */
  async update(
    sessionId: string, 
    cityId: string, 
    tiles: any[]
  ): Promise<IBattleFieldTileDocument | null> {
    return await BattleFieldTileModel.findOneAndUpdate(
      { sessionId, cityId },
      { tiles },
      { new: true }
    ).exec();
  }

  /**
   * 세션의 모든 타일 조회
   */
  async findBySessionId(sessionId: string): Promise<IBattleFieldTileDocument[]> {
    return await BattleFieldTileModel.find({ sessionId }).lean().exec();
  }
}
