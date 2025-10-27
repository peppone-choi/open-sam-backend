import { NationTurnRepository } from '../repository/nation-turn.repository';
import { INationTurn } from '../@types/nation-turn.types';

/**
 * NationTurn Service (비즈니스 로직 계층)
 * 
 * 국가별 턴 기록 조회 기능 제공
 * 턴 데이터 기록은 Game Daemon에서 처리
 */
export class NationTurnService {
  constructor(private repository: NationTurnRepository) {}

  async getById(id: string): Promise<INationTurn | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<INationTurn[]> {
    return await this.repository.findAll(limit, skip);
  }

  async create(data: Partial<INationTurn>): Promise<INationTurn> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INationTurn>): Promise<INationTurn | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async getByNationId(nationId: string, limit: number, skip: number): Promise<INationTurn[]> {
    return await this.repository.findByNationId(nationId, limit, skip);
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<INationTurn[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
