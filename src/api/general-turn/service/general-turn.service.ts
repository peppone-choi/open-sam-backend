import { GeneralTurnRepository } from '../repository/general-turn.repository';
import { IGeneralTurn } from '../@types/general-turn.types';

/**
 * GeneralTurn Service (비즈니스 로직 계층)
 * 
 * 장수별 턴 기록 조회 기능 제공
 * 턴 데이터 기록은 Game Daemon에서 처리
 */
export class GeneralTurnService {
  constructor(private repository: GeneralTurnRepository) {}

  async getById(id: string): Promise<IGeneralTurn | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<IGeneralTurn[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByGeneralId(generalId: string, limit: number, skip: number): Promise<IGeneralTurn[]> {
    return await this.repository.findByGeneralId(generalId, limit, skip);
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<IGeneralTurn[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async create(data: Partial<IGeneralTurn>): Promise<IGeneralTurn> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IGeneralTurn>): Promise<IGeneralTurn | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
