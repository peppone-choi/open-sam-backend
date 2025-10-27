import { StorageRepository } from '../repository/storage.repository';
import { IStorage } from '../@types/storage.types';

/**
 * Storage Service
 * 
 * Manages key-value storage with namespace support for configuration and state persistence
 */
export class StorageService {
  constructor(private repository: StorageRepository) {}

  async getById(id: string): Promise<IStorage | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<IStorage[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getByNamespace(namespace: string, limit = 20, skip = 0): Promise<IStorage[]> {
    return await this.repository.findByNamespace(namespace, limit, skip);
  }

  async getByKey(namespace: string, key: string): Promise<IStorage | null> {
    return await this.repository.findByKey(namespace, key);
  }

  async create(data: Partial<IStorage>): Promise<IStorage> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<IStorage>): Promise<IStorage | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
