import { NationModel, INationDocument } from '../model/nation.model';

export class NationRepository {
  async findById(id: string): Promise<INationDocument | null> {
    // TODO: Implement
    return null;
  }

  async findAll(): Promise<INationDocument[]> {
    // TODO: Implement
    return [] as any;
  }
}
