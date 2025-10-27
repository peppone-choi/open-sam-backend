import { StorageModel, IStorageDocument } from '../model/storage.model';
import { IStorage } from '../@types/storage.types';

export class StorageRepository {
  async findById(id: string): Promise<IStorage | null> {
    const storage = await StorageModel.findById(id).lean().exec();
    return storage as IStorage | null;
  }

  async findAll(limit = 20, skip = 0): Promise<IStorage[]> {
    const storages = await StorageModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return storages as IStorage[];
  }

  async findByNamespace(namespace: string, limit = 20, skip = 0): Promise<IStorage[]> {
    const storages = await StorageModel.find({ namespace })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return storages as IStorage[];
  }

  async findByKey(namespace: string, key: string): Promise<IStorage | null> {
    const storage = await StorageModel.findOne({ namespace, key }).lean().exec();
    return storage as IStorage | null;
  }

  async create(data: Partial<IStorage>): Promise<IStorage> {
    const storage = new StorageModel(data);
    await storage.save();
    return storage.toObject() as IStorage;
  }

  async update(id: string, data: Partial<IStorage>): Promise<IStorage | null> {
    const storage = await StorageModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return storage ? (storage.toObject() as IStorage) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await StorageModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await StorageModel.countDocuments(filter || {}).exec();
  }
}
