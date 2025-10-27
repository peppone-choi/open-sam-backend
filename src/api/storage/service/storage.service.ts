import { StorageRepository } from '../repository/storage.repository';
import { IStorage } from '../@types/storage.types';

export class StorageService {
  constructor(private repository: StorageRepository) {}

  async getById(id: string): Promise<IStorage | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IStorage[]> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return [];
  }

  async create(data: Partial<IStorage>): Promise<IStorage> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IStorage>): Promise<IStorage | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return false;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return 0;
  }
}
