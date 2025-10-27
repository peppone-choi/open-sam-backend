import { NationEnvModel, INationEnvDocument } from '../model/nation-env.model';
import { INationEnv } from '../@types/nation-env.types';

export class NationEnvRepository {
  async findById(id: string): Promise<INationEnv | null> {
    const nationEnv = await NationEnvModel.findById(id).lean().exec();
    return nationEnv as INationEnv | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INationEnv[]> {
    const nationEnvs = await NationEnvModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return nationEnvs as INationEnv[];
  }

  async create(data: Partial<INationEnv>): Promise<INationEnv> {
    const nationEnv = new NationEnvModel(data);
    await nationEnv.save();
    return nationEnv.toObject() as INationEnv;
  }

  async update(id: string, data: Partial<INationEnv>): Promise<INationEnv | null> {
    const nationEnv = await NationEnvModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return nationEnv ? (nationEnv.toObject() as INationEnv) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NationEnvModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async findByNamespace(namespace: number, limit = 20, skip = 0): Promise<INationEnv[]> {
    const nationEnvs = await NationEnvModel.find({ namespace })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return nationEnvs as INationEnv[];
  }

  async findByNamespaceAndKey(namespace: number, key: string): Promise<INationEnv | null> {
    const nationEnv = await NationEnvModel.findOne({ namespace, key }).lean().exec();
    return nationEnv as INationEnv | null;
  }

  async upsert(namespace: number, key: string, value: any): Promise<INationEnv> {
    const nationEnv = await NationEnvModel.findOneAndUpdate(
      { namespace, key },
      { namespace, key, value },
      { new: true, upsert: true }
    ).exec();
    
    return nationEnv.toObject() as INationEnv;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NationEnvModel.countDocuments(filter || {}).exec();
  }
}
