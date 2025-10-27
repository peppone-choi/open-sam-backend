import { CityModel, ICityDocument } from '../city.schema';

export class CityRepository {
  async findById(id: string): Promise<ICityDocument | null> {
    // TODO: Implement findById
    return null;
  }

  async findByNation(nationId: string): Promise<ICityDocument[]> {
    // TODO: Implement findByNation
    return [] as any;
  }

  async findAll(limit = 100, skip = 0): Promise<ICityDocument[]> {
    // TODO: Implement findAll
    return [] as any;
  }
}
