import { GeneralAccessLogRepository } from '../repository/general-access-log.repository';
import { IGeneralAccessLog } from '../@types/general-access-log.types';

export class GeneralAccessLogService {
  constructor(private repository: GeneralAccessLogRepository) {}

  async getById(id: string): Promise<IGeneralAccessLog | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IGeneralAccessLog[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getByGeneralId(generalId: string): Promise<IGeneralAccessLog | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getByUserId(userId: string, limit: number, skip: number): Promise<IGeneralAccessLog[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<IGeneralAccessLog[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IGeneralAccessLog>): Promise<IGeneralAccessLog> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IGeneralAccessLog>): Promise<IGeneralAccessLog | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    // TODO: 구현
    return false;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    // TODO: 구현
    return 0;
  }
}
