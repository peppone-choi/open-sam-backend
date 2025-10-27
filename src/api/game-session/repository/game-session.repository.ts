import { GameSessionModel } from '../model/game-session.model';
import { IGameSession } from '../@types/game-session.types';

export class GameSessionRepository {
  async findById(id: string): Promise<IGameSession | null> {
    const session = await GameSessionModel.findById(id).lean().exec();
    return session as IGameSession | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IGameSession[]> {
    const sessions = await GameSessionModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return sessions as IGameSession[];
  }

  async create(data: Partial<IGameSession>): Promise<IGameSession> {
    const session = new GameSessionModel(data);
    await session.save();
    return session.toObject() as IGameSession;
  }

  async update(id: string, data: Partial<IGameSession>): Promise<IGameSession | null> {
    const session = await GameSessionModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return session ? (session.toObject() as IGameSession) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await GameSessionModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findByStatus(status: IGameSession['status'], limit = 20, skip = 0): Promise<IGameSession[]> {
    const sessions = await GameSessionModel.find({ status })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return sessions as IGameSession[];
  }

  async findByScenarioId(scenarioId: string): Promise<IGameSession[]> {
    const sessions = await GameSessionModel.find({ scenarioId })
      .lean()
      .exec();
    
    return sessions as IGameSession[];
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await GameSessionModel.countDocuments(filter || {}).exec();
  }
}
