/**
 * EntityManager - 완전 동적 엔티티 관리자
 * 
 * 어떤 게임이든 사용 가능한 범용 엔티티 시스템
 * 모든 필드는 session config의 schema에 의해 정의됨
 */

import mongoose, { Model, Document } from 'mongoose';

export interface IEntity extends Document {
  session_id: string;
  data: Record<string, any>;
}

export interface SessionConfig {
  session_id: string;
  name: string;
  version: string;
  game_mode: string;
  field_mappings: Record<string, Record<string, string>>;
  schema: Record<string, Record<string, any>>;
  [key: string]: any;
}

/**
 * 범용 엔티티 매니저
 * 어떤 게임/세션이든 동적으로 처리
 */
export class EntityManager {
  private sessionConfig: SessionConfig;
  private models: Map<string, Model<IEntity>> = new Map();

  constructor(sessionConfig: SessionConfig) {
    this.sessionConfig = sessionConfig;
    this.initializeModels();
  }

  /**
   * 세션 설정의 스키마를 기반으로 동적 모델 생성
   */
  private initializeModels(): void {
    const schema = this.sessionConfig.schema;
    
    for (const [entityType, fields] of Object.entries(schema)) {
      if (this.models.has(entityType)) continue;

      // Mongoose 스키마 정의
      const schemaDefinition: any = {
        session_id: { type: String, required: true },
        data: { type: mongoose.Schema.Types.Mixed, default: {} }
      };

      // 기본 키 필드 추가 (예: general의 no, city의 city 등)
      if (entityType === 'general') {
        schemaDefinition.no = { type: Number, required: true };
        schemaDefinition.owner = { type: String, required: true };
        schemaDefinition.name = { type: String, required: true };
      } else if (entityType === 'city') {
        schemaDefinition.city = { type: Number, required: true };
        schemaDefinition.name = { type: String, required: true };
      } else if (entityType === 'nation') {
        schemaDefinition.nation = { type: Number, required: true };
        schemaDefinition.name = { type: String, required: true };
      }

      const mongooseSchema = new mongoose.Schema(schemaDefinition, {
        timestamps: true
      });

      // 헬퍼 메서드 추가
      this.addHelperMethods(mongooseSchema, entityType);

      // 모델 생성 (이미 존재하면 재사용)
      const modelName = `${this.sessionConfig.session_id}_${entityType}`;
      let model: Model<IEntity>;
      
      try {
        model = mongoose.model<IEntity>(modelName);
      } catch (e) {
        model = mongoose.model<IEntity>(modelName, mongooseSchema);
      }

      this.models.set(entityType, model);
    }
  }

  /**
   * 동적 헬퍼 메서드 추가
   */
  private addHelperMethods(schema: mongoose.Schema, entityType: string): void {
    // 모든 엔티티 공통 메서드
    schema.methods.getVar = function(key: string): any {
      return this.data[key];
    };

    schema.methods.setVar = function(key: string, value: any): void {
      this.data[key] = value;
      this.markModified('data');
    };

    schema.methods.increaseVar = function(key: string, amount: number): void {
      if (!this.data[key]) this.data[key] = 0;
      this.data[key] += amount;
      this.markModified('data');
    };

    schema.methods.increaseVarWithLimit = function(key: string, amount: number, limit: number): void {
      if (!this.data[key]) this.data[key] = 0;
      this.data[key] += amount;
      if (amount > 0) {
        this.data[key] = Math.min(this.data[key], limit);
      } else {
        this.data[key] = Math.max(this.data[key], limit);
      }
      this.markModified('data');
    };

    // General 전용 메서드
    if (entityType === 'general') {
      schema.methods.getID = function(): number {
        return this.no;
      };

      schema.methods.getNationID = function(): number {
        return this.data.nation || 0;
      };

      schema.methods.getCityID = function(): number {
        return this.data.city || 0;
      };

      schema.methods.addExperience = function(exp: number): void {
        if (!this.data.experience) this.data.experience = 0;
        this.data.experience += exp;
        this.markModified('data');
      };

      schema.methods.addDedication = function(ded: number): void {
        if (!this.data.dedication) this.data.dedication = 0;
        this.data.dedication += ded;
        this.markModified('data');
      };
    }

    schema.methods.applyDB = async function(): Promise<void> {
      await this.save();
    };
  }

  /**
   * 엔티티 조회
   */
  async get(entityType: string, filter: any): Promise<IEntity | null> {
    const model = this.models.get(entityType);
    if (!model) throw new Error(`Unknown entity type: ${entityType}`);
    
    return await model.findOne({ 
      session_id: this.sessionConfig.session_id,
      ...filter 
    });
  }

  /**
   * 여러 엔티티 조회
   */
  async find(entityType: string, filter: any = {}): Promise<IEntity[]> {
    const model = this.models.get(entityType);
    if (!model) throw new Error(`Unknown entity type: ${entityType}`);
    
    return await model.find({ 
      session_id: this.sessionConfig.session_id,
      ...filter 
    });
  }

  /**
   * 엔티티 생성
   */
  async create(entityType: string, data: any): Promise<IEntity> {
    const model = this.models.get(entityType);
    if (!model) throw new Error(`Unknown entity type: ${entityType}`);
    
    return await model.create({
      session_id: this.sessionConfig.session_id,
      ...data
    });
  }

  /**
   * 엔티티 업데이트
   */
  async update(entityType: string, filter: any, updates: any): Promise<void> {
    const model = this.models.get(entityType);
    if (!model) throw new Error(`Unknown entity type: ${entityType}`);
    
    // data 필드 내부 업데이트를 위한 $set 사용
    const setUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'session_id') continue; // session_id는 변경 불가
      if (['no', 'city', 'nation', 'name', 'owner'].includes(key)) {
        setUpdates[key] = value;
      } else {
        setUpdates[`data.${key}`] = value;
      }
    }
    
    await model.updateMany({ 
      session_id: this.sessionConfig.session_id,
      ...filter 
    }, { $set: setUpdates });
  }

  /**
   * 엔티티 삭제
   */
  async delete(entityType: string, filter: any): Promise<void> {
    const model = this.models.get(entityType);
    if (!model) throw new Error(`Unknown entity type: ${entityType}`);
    
    await model.deleteMany({ 
      session_id: this.sessionConfig.session_id,
      ...filter 
    });
  }

  /**
   * 필드 매핑 가져오기 (논리적 이름 -> 실제 필드명)
   */
  getFieldMapping(entityType: string, logicalName: string): string {
    const mappings = this.sessionConfig.field_mappings[entityType];
    return mappings?.[logicalName] || logicalName;
  }

  /**
   * 스키마 정보 가져오기
   */
  getSchema(entityType: string): Record<string, any> {
    return this.sessionConfig.schema[entityType] || {};
  }

  /**
   * 세션 설정 가져오기
   */
  getConfig(): SessionConfig {
    return this.sessionConfig;
  }
}

/**
 * EntityManager 싱글톤 관리
 */
export class EntityManagerFactory {
  private static instances: Map<string, EntityManager> = new Map();

  static async getManager(sessionId: string): Promise<EntityManager> {
    if (this.instances.has(sessionId)) {
      return this.instances.get(sessionId)!;
    }

    // 세션 설정 로드
    const sessionConfig = await this.loadSessionConfig(sessionId);
    const manager = new EntityManager(sessionConfig);
    
    this.instances.set(sessionId, manager);
    return manager;
  }

  private static async loadSessionConfig(sessionId: string): Promise<SessionConfig> {
    // TODO: 실제 구현에서는 DB나 파일에서 로드
    // 지금은 sangokushi config를 기본으로 사용
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../../config/session-sangokushi.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  }

  static clearCache(): void {
    this.instances.clear();
  }
}
