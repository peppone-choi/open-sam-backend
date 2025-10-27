import { UserRecordRepository } from '../repository/user-record.repository';
import { IUserRecord } from '../@types/user-record.types';

/**
 * User Record Service
 * 
 * Manages user activity logs and performance records across servers and sessions
 */
export class UserRecordService {
  constructor(private repository: UserRecordRepository) {}

  async getById(id: string): Promise<IUserRecord | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IUserRecord[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByUser(userId: string, serverId: string, limit = 20, skip = 0): Promise<IUserRecord[]> {
    return await this.repository.findByUser(userId, serverId, limit, skip);
  }

  async getByServer(serverId: string, limit = 20, skip = 0): Promise<IUserRecord[]> {
    return await this.repository.findByServer(serverId, limit, skip);
  }

  async getByLogType(logType: string, limit = 20, skip = 0): Promise<IUserRecord[]> {
    return await this.repository.findByLogType(logType, limit, skip);
  }

  async create(data: Partial<IUserRecord>): Promise<IUserRecord> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IUserRecord>): Promise<IUserRecord | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
