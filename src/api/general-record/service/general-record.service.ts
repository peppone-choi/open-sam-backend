import { GeneralRecordRepository } from '../repository/general-record.repository';
import { IGeneralRecord } from '../@types/general-record.types';

export class GeneralRecordService {
  constructor(private repository: GeneralRecordRepository) {}

  async getById(id: string): Promise<IGeneralRecord | null> {
    return null as any;
    // TODO: 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IGeneralRecord[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getByGeneralId(generalId: string, limit: number, skip: number): Promise<IGeneralRecord[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getBySessionId(sessionId: string, limit: number, skip: number): Promise<IGeneralRecord[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async getByLogType(logType: string, limit: number, skip: number): Promise<IGeneralRecord[]> {
    return null as any;
    // TODO: 구현
    return [];
  }

  async create(data: Partial<IGeneralRecord>): Promise<IGeneralRecord> {
    return null as any;
    // TODO: 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IGeneralRecord>): Promise<IGeneralRecord | null> {
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
