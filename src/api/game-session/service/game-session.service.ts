import { GameSessionRepository } from '../repository/game-session.repository';
import { IGameSession } from '../@types/game-session.types';

export class GameSessionService {
  constructor(private repository: GameSessionRepository) {}

  async getById(id: string): Promise<IGameSession | null> {
    return null as any;
    /* TODO */
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IGameSession[]> {
    return null as any;
    /* TODO */
    return [];
  }

  async create(data: Partial<IGameSession>): Promise<IGameSession> {
    return null as any;
    /* TODO */
    return null as any;
  }

  async update(id: string, data: Partial<IGameSession>): Promise<IGameSession | null> {
    return null as any;
    /* TODO */
    return null;
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    /* TODO */
    return false;
  }

  async getByStatus(status: IGameSession['status'], limit: number, skip: number): Promise<IGameSession[]> {
    return null as any;
    /* TODO */
    return [];
  }

  async getByScenarioId(scenarioId: string): Promise<IGameSession[]> {
    return null as any;
    /* TODO */
    return [];
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    /* TODO */
    return 0;
  }
}
