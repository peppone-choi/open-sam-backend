import { CityRepository } from '../repository/city.repository';
import { ICity } from '../@types/city.types';
import { ICityDocument } from '../model/city.model';

/**
 * City Service
 * 
 * Manages city-related operations including creation, updates, and queries by nation
 */
export class CityService {
  constructor(private repository: CityRepository) {}

  async getById(id: string): Promise<ICityDocument | null> {
    return await this.repository.findById(id);
  }

  async getByNation(nationId: string): Promise<ICityDocument[]> {
    return await this.repository.findByNation(nationId);
  }

  async getAll(limit = 100, skip = 0): Promise<ICityDocument[]> {
    return await this.repository.findAll(limit, skip);
  }

  async create(data: Partial<ICity>): Promise<ICityDocument> {
    return await this.repository.create(data);
  }

  async update(id: string, data: Partial<ICity>): Promise<ICityDocument | null> {
    return await this.repository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }
}
