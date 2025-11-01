import mongoose from 'mongoose';
import { General, IGeneral } from '../models/general.model';
import { City, ICity } from '../models/city.model';
import { Nation, INation } from '../models/nation.model';

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sangokushi';
    console.log('🔌 MongoDB 연결 시도:', uri.replace(/\/\/.*@/, '//*****@'));
    await mongoose.connect(uri);
    console.log('✅ MongoDB 연결 성공');
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error);
    throw error;
  }
}

/**
 * DB 헬퍼 클래스 - PHP의 DB::db() 패턴을 TypeScript로 구현
 */
export class DB {
  private static instance: DB;

  private constructor() {}

  public static db(): DB {
    if (!DB.instance) {
      DB.instance = new DB();
    }
    return DB.instance;
  }

  // General 조회
  async getGeneral(generalId: number, sessionId?: string): Promise<IGeneral | null> {
    const query: any = { no: generalId };
    if (sessionId) query.session_id = sessionId;
    return await General.findOne(query);
  }

  async getGenerals(filter: any): Promise<IGeneral[]> {
    return await General.find(filter);
  }

  // City 조회
  async getCity(cityId: number, sessionId: string): Promise<ICity | null> {
    return await City.findOne({ city: cityId, session_id: sessionId });
  }

  async getCities(filter: any): Promise<ICity[]> {
    return await City.find(filter);
  }

  // Nation 조회
  async getNation(nationId: number, sessionId: string): Promise<INation | null> {
    return await Nation.findOne({ nation: nationId, session_id: sessionId });
  }

  async getNations(filter: any): Promise<INation[]> {
    return await Nation.find(filter);
  }

  // Update 메서드 (동적 필드 지원)
  async updateGeneral(generalId: number, updates: any, sessionId?: string): Promise<void> {
    const query: any = { no: generalId };
    if (sessionId) query.session_id = sessionId;
    
    // data 필드 내부 업데이트를 위한 $set 사용
    const setUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      setUpdates[`data.${key}`] = value;
    }
    
    await General.updateOne(query, { $set: setUpdates });
  }

  async updateCity(cityId: number, sessionId: string, updates: any): Promise<void> {
    const setUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      setUpdates[`data.${key}`] = value;
    }
    
    await City.updateOne(
      { city: cityId, session_id: sessionId },
      { $set: setUpdates }
    );
  }

  async updateNation(nationId: number, sessionId: string, updates: any): Promise<void> {
    const setUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      setUpdates[`data.${key}`] = value;
    }
    
    await Nation.updateOne(
      { nation: nationId, session_id: sessionId },
      { $set: setUpdates }
    );
  }

  // 동적 쿼리 메서드
  async query_MAIN(collection: string, filter: any = {}): Promise<any[]> {
    const model = mongoose.model(collection);
    return await model.find(filter);
  }

  async queryFirstRow(collection: string, filter: any = {}): Promise<any | null> {
    const model = mongoose.model(collection);
    return await model.findOne(filter);
  }

  async queryAllLists(query: string, params?: any[]): Promise<any[]> {
    return [];
  }

  async update(collection: string, updates: any, whereClause?: string, params?: any[]): Promise<void> {
    const model = mongoose.model(collection);
    const filter: any = {};
    
    if (whereClause && params) {
      const match = whereClause.match(/(\w+)\s*=\s*%i/);
      if (match && params.length > 0) {
        filter[match[1]] = params[0];
      }
    }
    
    await model.updateMany(filter, { $set: updates });
  }

  async insert(collection: string, data: any): Promise<any> {
    const model = mongoose.model(collection);
    return await model.create(data);
  }

  async delete(collection: string, filter: any): Promise<void> {
    const model = mongoose.model(collection);
    await model.deleteMany(filter);
  }

  sqleval(expression: string, ...params: any[]): any {
    return expression.replace(/%i/g, () => String(params.shift() ?? 0));
  }

  async queryFirstField(query: string, params?: any[]): Promise<any> {
    return null;
  }

  async query<T = any>(query: string, params?: any[]): Promise<T[]> {
    return [];
  }

  async queryFirstColumn(...args: any[]): Promise<any[]> {
    return [];
  }

  async queryFirstList(...args: any[]): Promise<any[]> {
    return [];
  }
}

export namespace DB {
  export function queryFirstColumn(...args: any[]): Promise<any[]> { return Promise.resolve([]); }
  export function queryFirstList(...args: any[]): Promise<any[]> { return Promise.resolve([]); }
}
