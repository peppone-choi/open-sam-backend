import { CityModel, ICityDocument } from '../model/city.model';
import { ICity } from '../@types/city.types';

export class CityRepository {
  async findById(id: string): Promise<ICityDocument | null> {
    return await CityModel.findById(id).exec();
  }

  async findByNation(nationId: string): Promise<ICityDocument[]> {
    return await CityModel.find({ nation: nationId }).exec();
  }

  async findAll(limit = 100, skip = 0): Promise<ICityDocument[]> {
    return await CityModel.find().limit(limit).skip(skip).exec();
  }

  async create(data: Partial<ICity>): Promise<ICityDocument> {
    const city = new CityModel(data);
    return await city.save();
  }

  async update(id: string, data: Partial<ICity>): Promise<ICityDocument | null> {
    return await CityModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await CityModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
