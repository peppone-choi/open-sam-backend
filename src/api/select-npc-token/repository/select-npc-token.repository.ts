import { SelectNpcTokenModel } from '../model/select-npc-token.model';
import { ISelectNpcToken } from '../@types/select-npc-token.types';

export class SelectNpcTokenRepository {
  async findById(id: string): Promise<ISelectNpcToken | null> {
    const token = await SelectNpcTokenModel.findById(id).lean().exec();
    return token as ISelectNpcToken | null;
  }

  async findAll(limit = 20, skip = 0): Promise<ISelectNpcToken[]> {
    const tokens = await SelectNpcTokenModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return tokens as ISelectNpcToken[];
  }

  async findBySessionAndOwner(sessionId: string, owner: string): Promise<ISelectNpcToken | null> {
    const token = await SelectNpcTokenModel.findOne({ sessionId, owner }).lean().exec();
    return token as ISelectNpcToken | null;
  }

  async findBySession(sessionId: string, limit = 20, skip = 0): Promise<ISelectNpcToken[]> {
    const tokens = await SelectNpcTokenModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return tokens as ISelectNpcToken[];
  }

  async create(data: Partial<ISelectNpcToken>): Promise<ISelectNpcToken> {
    const token = new SelectNpcTokenModel(data);
    await token.save();
    return token.toObject() as ISelectNpcToken;
  }

  async update(id: string, data: Partial<ISelectNpcToken>): Promise<ISelectNpcToken | null> {
    const token = await SelectNpcTokenModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return token ? (token.toObject() as ISelectNpcToken) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await SelectNpcTokenModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await SelectNpcTokenModel.countDocuments(filter || {}).exec();
  }
}
