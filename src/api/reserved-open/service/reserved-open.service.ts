import { ReservedOpenRepository } from '../repository/reserved-open.repository';
import { IReservedOpen } from '../@types/reserved-open.types';

export class ReservedOpenService {
  constructor(private repository: ReservedOpenRepository) {}

  async getById(id: string): Promise<IReservedOpen | null> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return null;
  }

  async getAll(limit: number, skip: number): Promise<IReservedOpen[]> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    return [];
  }

  async create(data: Partial<IReservedOpen>): Promise<IReservedOpen> {
    return null as any;
    // TODO: 비즈니스 로직 구현
    throw new Error('Not implemented');
  }

  async update(id: string, data: Partial<IReservedOpen>): Promise<IReservedOpen | null> {
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
