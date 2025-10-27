import { NgHistoryRepository } from '../repository/ng-history.repository';
import { INgHistory } from '../@types/ng-history.types';

export class NgHistoryService {
  constructor(private repository: NgHistoryRepository) {}

  async getById(id: string): Promise<INgHistory | null> {
    return null as any;
    // TODO: 캐시 로직 추가
    return await this.repository.findById(id);
  }

  async getAll(limit: number, skip: number): Promise<INgHistory[]> {
    return null as any;
    // TODO: 페이지네이션 로직
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(serverId: string, limit: number, skip: number): Promise<INgHistory[]> {
    return null as any;
    // TODO: 세션별 조회 로직
    return await this.repository.findBySessionId(serverId, limit, skip);
  }

  async create(data: Partial<INgHistory>): Promise<INgHistory> {
    return null as any;
    // TODO: 생성 전 검증 로직
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INgHistory>): Promise<INgHistory | null> {
    return null as any;
    // TODO: 업데이트 전 검증 로직
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return null as any;
    // TODO: 삭제 전 검증 로직
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return null as any;
    // TODO: 필터 로직
    return await this.repository.count(filter);
  }
}
