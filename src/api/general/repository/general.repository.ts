import { GeneralModel, IGeneralDocument } from '../model/general.model';
import { IGeneral } from '../../../@types';

/**
 * General Repository (데이터 접근 계층)
 * Mongoose 접근만 담당, 비즈니스 로직 없음
 */
export class GeneralRepository {
  /**
   * ID로 조회
   */
  async findById(id: string): Promise<IGeneral | null> {
    // TODO: 구현
    const general = await GeneralModel.findById(id).lean().exec();
    return general as IGeneral | null;
  }

  /**
   * 전체 조회 (페이지네이션)
   */
  async findAll(limit = 20, skip = 0): Promise<IGeneral[]> {
    // TODO: 구현
    const generals = await GeneralModel.find()
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return generals as IGeneral[];
  }

  /**
   * 국가별 조회
   */
  async findByNationId(nationId: string, limit = 20, skip = 0): Promise<IGeneral[]> {
    // TODO: 구현
    const generals = await GeneralModel.find({ nationId })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    
    return generals as IGeneral[];
  }

  /**
   * 생성
   */
  async create(data: Partial<IGeneral>): Promise<IGeneral> {
    // TODO: 구현
    const general = new GeneralModel(data);
    await general.save();
    return general.toObject() as IGeneral;
  }

  /**
   * 업데이트
   */
  async update(id: string, data: Partial<IGeneral>): Promise<IGeneral | null> {
    // TODO: 구현
    const general = await GeneralModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return general ? (general.toObject() as IGeneral) : null;
  }

  /**
   * 삭제
   */
  async delete(id: string): Promise<boolean> {
    // TODO: 구현
    const result = await GeneralModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  /**
   * 총 개수 조회
   */
  async count(filter?: Record<string, any>): Promise<number> {
    // TODO: 구현
    return await GeneralModel.countDocuments(filter || {}).exec();
  }
}
