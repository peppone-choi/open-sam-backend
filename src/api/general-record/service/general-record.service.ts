import { GeneralRecordRepository } from '../repository/general-record.repository';
import { IGeneralRecord } from '../@types/general-record.types';

/**
 * GeneralRecord Service (비즈니스 로직 계층)
 * 
 * 장수별 활동 기록 조회 및 관리 기능 제공
 * 기록 생성은 Game Daemon에서 처리
 */
export class GeneralRecordService {
  constructor(private repository: GeneralRecordRepository) {}

  async getById(id: string): Promise<IGeneralRecord | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<IGeneralRecord[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByGeneralId(generalId: string, limit: number, skip: number): Promise<IGeneralRecord[]> {
    return await this.repository.findByGeneralId(generalId, limit, skip);
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<IGeneralRecord[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async getByLogType(logType: string, limit: number, skip: number): Promise<IGeneralRecord[]> {
    return await this.repository.findByLogType(logType, limit, skip);
  }

  async create(data: Partial<IGeneralRecord>): Promise<IGeneralRecord> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IGeneralRecord>): Promise<IGeneralRecord | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
