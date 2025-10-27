import { NationRepository } from '../repository/nation.repository';
import { INation } from '../@types/nation.types';

/**
 * Nation Service (비즈니스 로직 계층)
 * 
 * 국가 관련 조회 및 관리 기능 제공
 * 국가 변경(외교, 전략 커맨드 등)은 Game Daemon에서 처리
 */
export class NationService {
  constructor(private repository: NationRepository) {}

  async getById(id: string): Promise<INation | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<INation[]> {
    return await this.repository.findAll(limit, skip);
  }

  async create(data: Partial<INation>): Promise<INation> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INation>): Promise<INation | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<INation[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
