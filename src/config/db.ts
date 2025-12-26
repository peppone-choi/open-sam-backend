// @ts-nocheck - Type issues need investigation
import mongoose from 'mongoose';
import { General, IGeneral } from '../models/general.model';
import { City, ICity } from '../models/city.model';
import { Nation, INation } from '../models/nation.model';
import { GeneralLog } from '../models/general-log.model';
import { Troop } from '../models/troop.model';
import { Diplomacy } from '../models/diplomacy.model';
import { NgHistory } from '../models/ng_history.model';
import { Auction } from '../models/auction.model';
import { configManager } from './ConfigManager';
import { logger } from '../common/logger';

export async function connectDB() {
  try {
    const { mongodbUri } = configManager.get().system;
    await mongoose.connect(mongodbUri);
    logger.info('✅ MongoDB 연결 성공');
  } catch (error) {
    logger.error('❌ MongoDB 연결 실패:', error);
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

  // 컬렉션 이름을 Mongoose 모델로 매핑
  private getModel(collection: string): any {
    const modelMap: Record<string, any> = {
      'general': General,
      'city': City,
      'nation': Nation,
      'general_action_log': GeneralLog,
      'general_battle_log': GeneralLog,
      'general_history_log': GeneralLog,
      'global_action_log': GeneralLog,
      'global_history_log': GeneralLog,
      'national_history_log': NgHistory,
      'troop': Troop,
      'diplomacy': Diplomacy,
      'ng_auction': Auction,
      'ng_history': NgHistory
    };
    
    const model = modelMap[collection.toLowerCase()];
    if (!model) {
      throw new Error(`Unknown collection: ${collection}`);
    }
    return model;
  }

  // General 조회
  async getGeneral(generalId: number, sessionId?: string): Promise<IGeneral | null> {
    const query: any = { 'data.no': generalId };
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
    return await Nation.findOne({ 'data.nation': nationId, session_id: sessionId });
  }

  async getNations(filter: any): Promise<INation[]> {
    return await Nation.find(filter);
  }

  // Update 메서드 (동적 필드 지원)
  async updateGeneral(generalId: number, updates: any, sessionId?: string): Promise<void> {
    const query: any = { 'data.no': generalId };
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
      { 'data.nation': nationId, session_id: sessionId },
      { $set: setUpdates }
    );
  }

  // 동적 쿼리 메서드
  async query_MAIN(collection: string, filter: any = {}): Promise<any[]> {
    const model = this.getModel(collection);
    return await model.find(filter);
  }

  async queryFirstRow(collection: string, filter: any = {}): Promise<any | null> {
    const model = this.getModel(collection);
    return await model.findOne(filter);
  }

  async queryAllLists(query: string, params?: any[]): Promise<any[]> {
    return [];
  }

  async update(collection: string, updates: any, whereClause?: string, params?: any[] | number): Promise<void> {
    const model = this.getModel(collection);
    const filter: any = {};
    
    if (whereClause) {
      if (typeof params === 'number') {
        // 단일 숫자 파라미터인 경우
        const match = whereClause.match(/(\w+)\s*=\s*\?/);
        if (match) {
          filter[match[1]] = params;
        }
      } else if (Array.isArray(params)) {
        // 배열 파라미터인 경우
        const match = whereClause.match(/(\w+)\s*=\s*\?/);
        if (match && params.length > 0) {
          filter[match[1]] = params[0];
        }
      }
    }
    
    // MongoDB에서는 $set과 $inc를 구분해야 함
    const setUpdates: any = {};
    const incUpdates: any = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (value && typeof value === 'object' && '$expr' in value) {
        const rawValue = value as any;
        const sql = rawValue.$expr || '';
        if (sql.includes('-')) {
          const match = sql.match(/(\w+)\s*-\s*(\d+)/);
          if (match) {
            incUpdates[key] = -parseInt(match[2]);
          }
        } else if (sql.includes('+')) {
          const match = sql.match(/(\w+)\s*\+\s*(\d+)/);
          if (match) {
            incUpdates[key] = parseInt(match[2]);
          }
        }
      } else {
        setUpdates[key] = value;
      }
    }
    
    const updateQuery: any = {};
    if (Object.keys(setUpdates).length > 0) {
      updateQuery.$set = setUpdates;
    }
    if (Object.keys(incUpdates).length > 0) {
      updateQuery.$inc = incUpdates;
    }
    
    if (Object.keys(updateQuery).length > 0) {
      await model.updateMany(filter, updateQuery);
    }
  }

  async insert(collection: string, data: any): Promise<any> {
    const model = this.getModel(collection);
    return await model.create(data);
  }

  async delete(collection: string, filter: any): Promise<void> {
    const model = this.getModel(collection);
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

  raw(sql: string, ...params: any[]): any {
    return {
      $expr: sql,
      _params: params
    };
  }

  queryFirst(query: string, params?: any[]): Promise<any | null> {
    return this.queryFirstRow(query.replace(/SELECT\s+[\w\s,]*\s+FROM\s+(\w+)/i, '$1'), {});
  }
}

export namespace DB {
  export function queryFirstColumn(...args: any[]): Promise<any[]> { return Promise.resolve([]); }
  export function queryFirstList(...args: any[]): Promise<any[]> { return Promise.resolve([]); }
}
