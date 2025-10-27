import { NationEnvRepository } from '../repository/nation-env.repository';
import { INationEnv } from '../@types/nation-env.types';

/**
 * NationEnv Service (비즈니스 로직 계층)
 * 
 * 국가별 환경 변수(KV Storage) 조회 및 관리 기능 제공
 * 쿨다운, 전략 상태 등을 저장하는 용도
 */
export class NationEnvService {
  constructor(private repository: NationEnvRepository) {}

  async getById(id: string): Promise<INationEnv | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<INationEnv[]> {
    return await this.repository.findAll(limit, skip);
  }

  async create(data: Partial<INationEnv>): Promise<INationEnv> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INationEnv>): Promise<INationEnv | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async getByNamespace(namespace: number, limit: number, skip: number): Promise<INationEnv[]> {
    return await this.repository.findByNamespace(namespace, limit, skip);
  }

  async getByNamespaceAndKey(namespace: number, key: string): Promise<INationEnv | null> {
    return await this.repository.findByNamespaceAndKey(namespace, key);
  }

  async upsert(namespace: number, key: string, value: any): Promise<INationEnv> {
    return await this.repository.upsert(namespace, key, value);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
