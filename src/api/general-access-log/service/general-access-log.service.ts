import { GeneralAccessLogRepository } from '../repository/general-access-log.repository';
import { IGeneralAccessLog } from '../@types/general-access-log.types';

/**
 * GeneralAccessLog Service (비즈니스 로직 계층)
 * 
 * 장수 접속 로그 조회 및 관리 기능 제공
 */
export class GeneralAccessLogService {
  constructor(private repository: GeneralAccessLogRepository) {}

  async getById(id: string): Promise<IGeneralAccessLog | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<IGeneralAccessLog[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByGeneralId(generalId: string): Promise<IGeneralAccessLog | null> {
    return await this.repository.findByGeneralId(generalId);
  }

  async getByUserId(userId: string, limit: number, skip: number): Promise<IGeneralAccessLog[]> {
    return await this.repository.findByUserId(userId, limit, skip);
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<IGeneralAccessLog[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async create(data: Partial<IGeneralAccessLog>): Promise<IGeneralAccessLog> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IGeneralAccessLog>): Promise<IGeneralAccessLog | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
