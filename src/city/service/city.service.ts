import { CityRepository } from '../repository/city.repository';

export class CityService {
  private repository = new CityRepository();

  async getById(id: string) {
    // TODO: Implement with caching
    return this.repository.findById(id);
  }

  async getByNation(nationId: string) {
    // TODO: Implement with caching
    return this.repository.findByNation(nationId);
  }
}
