import { UserRecordRepository } from '../repository/user-record.repository';
import { IUserRecord } from '../@types/user-record.types';

export class UserRecordService {
  constructor(private repository: UserRecordRepository) {}

  async getById(id: string): Promise<IUserRecord | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IUserRecord[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IUserRecord>): Promise<IUserRecord> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IUserRecord>): Promise<IUserRecord | null> {
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
