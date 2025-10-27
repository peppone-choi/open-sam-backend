import { GameSessionRepository } from '../repository/game-session.repository';
import { IGameSession } from '../@types/game-session.types';

/**
 * GameSession Service (비즈니스 로직 계층)
 * 
 * 게임 세션 관련 조회 및 관리 기능 제공
 * 게임 진행(턴 처리 등)은 Game Daemon에서 처리
 */
export class GameSessionService {
  constructor(private repository: GameSessionRepository) {}

  async getById(id: string): Promise<IGameSession | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<IGameSession[]> {
    return await this.repository.findAll(limit, skip);
  }

  async create(data: Partial<IGameSession>): Promise<IGameSession> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IGameSession>): Promise<IGameSession | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async getByStatus(status: IGameSession['status'], limit: number, skip: number): Promise<IGameSession[]> {
    return await this.repository.findByStatus(status, limit, skip);
  }

  async getByScenarioId(scenarioId: string): Promise<IGameSession[]> {
    return await this.repository.findByScenarioId(scenarioId);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
