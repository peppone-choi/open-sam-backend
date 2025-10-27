import mongoose from 'mongoose';
import { ITurnAction, CreateTurnActionDto } from '../@types/turn-action.types';

/**
 * 턴 액션 Repository
 * 턴 관련 작업의 영속화
 */
export class TurnActionRepository {
  private collection: any;

  constructor() {
    this.collection = mongoose.connection.collection('turn_actions');
  }

  /**
   * 턴 액션 생성
   */
  async create(dto: CreateTurnActionDto): Promise<ITurnAction> {
    const turnAction: ITurnAction = {
      id: `ta_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      sessionId: dto.sessionId,
      type: dto.type,
      previousTurn: dto.previousTurn,
      newTurn: dto.newTurn,
      turnCount: dto.turnCount,
      executedBy: dto.executedBy,
      reason: dto.reason,
      affectedCommands: dto.affectedCommands,
      createdAt: new Date(),
    };

    await this.collection.insertOne(turnAction as any);
    return turnAction;
  }

  /**
   * 세션별 턴 액션 조회
   */
  async findBySessionId(sessionId: string, limit: number = 50): Promise<ITurnAction[]> {
    return await this.collection
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray() as any;
  }

  /**
   * 최근 턴 액션 조회
   */
  async findRecent(limit: number = 100): Promise<ITurnAction[]> {
    return await this.collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray() as any;
  }
}
