import { NgBettingRepository } from '../repository/ng-betting.repository';
import { INgBetting } from '../@types/ng-betting.types';

/**
 * Nation Game Betting Service
 * 
 * Manages betting and wagering systems for in-game events
 */
export class NgBettingService {
  constructor(private repository: NgBettingRepository) {}

  async getById(id: string): Promise<INgBetting | null> {
    return await this.repository.findById(id);
  }

  async getAll(limit = 20, skip = 0): Promise<INgBetting[]> {
    return await this.repository.findAll(limit, skip);
  }

  async getBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INgBetting[]> {
    return await this.repository.findBySessionId(sessionId, limit, skip);
  }

  async getByGeneralId(generalId: string, limit = 20, skip = 0): Promise<INgBetting[]> {
    return await this.repository.findByGeneralId(generalId, limit, skip);
  }

  async getByBettingId(sessionId: string, bettingId: number): Promise<INgBetting[]> {
    return await this.repository.findByBettingId(sessionId, bettingId);
  }

  async create(data: Partial<INgBetting>): Promise<INgBetting> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<INgBetting>): Promise<INgBetting | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await this.repository.count(filter);
  }
}
