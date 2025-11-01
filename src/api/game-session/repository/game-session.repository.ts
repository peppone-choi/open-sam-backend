import { GameSessionModel } from '../model/game-session.model';
import { IGameSession } from '../@types/game-session.types';

/**
 * GameSession Repository
 * 
 * Entity 시스템과 독립적으로 세션 관리
 * - Entity는 EntityRepository에서 관리
 * - GameSession은 세션 메타데이터만 관리
 * - scenarioId를 통해 Entity와 연결
 */
export class GameSessionRepository {
  /**
   * ID로 세션 조회
   */
  async findById(id: string): Promise<IGameSession | null> {
    const session = await GameSessionModel.findById(id).lean().exec();
    return session as IGameSession | null;
  }

  /**
   * 전체 세션 조회 (페이지네이션)
   */
  async findAll(limit = 20, skip = 0): Promise<IGameSession[]> {
    const sessions = await GameSessionModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return sessions as IGameSession[];
  }

  /**
   * 세션 생성
   */
  async create(data: Partial<IGameSession>): Promise<IGameSession> {
    const session = new GameSessionModel(data);
    await session.save();
    return session.toObject() as IGameSession;
  }

  /**
   * 세션 업데이트
   */
  async update(id: string, data: Partial<IGameSession>): Promise<IGameSession | null> {
    const session = await GameSessionModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return session ? (session.toObject() as IGameSession) : null;
  }

  /**
   * 세션 삭제
   * 
   * 주의: 연관된 Entity는 EntityRepository에서 별도로 삭제해야 함
   */
  async delete(id: string): Promise<boolean> {
    const result = await GameSessionModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  /**
   * 상태별 세션 조회
   */
  async findByStatus(status: IGameSession['status'], limit = 20, skip = 0): Promise<IGameSession[]> {
    const sessions = await GameSessionModel.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return sessions as IGameSession[];
  }

  /**
   * 시나리오 ID별 세션 조회
   * 
   * scenarioId는 Entity의 scenario 필드와 매칭됨
   */
  async findByScenarioId(scenarioId: string): Promise<IGameSession[]> {
    const sessions = await GameSessionModel.find({ scenarioId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return sessions as IGameSession[];
  }

  /**
   * 세션 카운트
   */
  async count(filter?: Record<string, any>): Promise<number> {
    return await GameSessionModel.countDocuments(filter || {}).exec();
  }
}
