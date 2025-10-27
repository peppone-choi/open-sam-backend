import { Model } from 'mongoose';
import { GameStateCache, EntityType, CachedEntity } from '../cache/game-state-cache';

/**
 * Redis 우선 읽기 Repository 패턴
 * 
 * 모든 읽기는 Redis 우선:
 * 1. Redis 조회
 * 2. 없으면 MongoDB에서 로드 후 Redis에 캐시
 * 3. 쓰기는 항상 Redis (자동으로 stream:changes 기록)
 */
export abstract class CachedRepository<T extends CachedEntity> {
  constructor(
    protected gameCache: GameStateCache,
    protected model: Model<any>,
    protected entityType: EntityType
  ) {}

  /**
   * ID로 조회 (Redis 우선)
   */
  async findById(id: string): Promise<T | null> {
    // 1. Redis 조회
    let entity = await this.gameCache.get<T>(this.entityType, id);

    // 2. 없으면 MongoDB에서 로드
    if (!entity) {
      const doc = await this.model.findById(id).lean().exec();
      if (doc) {
        entity = this.toEntity(doc);
        
        // Redis에 캐시
        await this.gameCache.create(this.entityType, entity);
      }
    }

    return entity;
  }

  /**
   * 여러 개 조회
   */
  async findByIds(ids: string[]): Promise<T[]> {
    const results: T[] = [];

    for (const id of ids) {
      const entity = await this.findById(id);
      if (entity) {
        results.push(entity);
      }
    }

    return results;
  }

  /**
   * 조건으로 조회 (MongoDB 사용)
   */
  async find(filter: any): Promise<T[]> {
    const docs = await this.model.find(filter).lean().exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  /**
   * 단건 조회 (조건)
   */
  async findOne(filter: any): Promise<T | null> {
    const doc = await this.model.findOne(filter).lean().exec();
    if (!doc) return null;
    
    const entity = this.toEntity(doc);
    
    // Redis에 캐시
    await this.gameCache.create(this.entityType, entity);
    
    return entity;
  }

  /**
   * 엔티티 생성
   */
  async create(entity: T): Promise<void> {
    await this.gameCache.create(this.entityType, entity);
  }

  /**
   * 엔티티 업데이트
   */
  async update(id: string, changes: Partial<T>): Promise<void> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new Error(`${this.entityType}을(를) 찾을 수 없음: ${id}`);
    }

    Object.assign(entity, changes);
    await this.gameCache.set(this.entityType, entity, changes as any);
  }

  /**
   * 엔티티 삭제
   */
  async delete(id: string): Promise<void> {
    await this.gameCache.delete(this.entityType, id);
  }

  /**
   * MongoDB Document → Entity 변환
   */
  protected abstract toEntity(doc: any): T;
}

/**
 * General Repository
 */
export interface GeneralEntity extends CachedEntity {
  id: string;
  sessionId: string;
  name: string;
  nation: string;
  city: string;
  leadership: number;
  strength: number;
  intel: number;
  leadership_exp: number;
  strength_exp: number;
  intel_exp: number;
  exp: number;
  ded: number;
  train: number;
  atmos: number;
  crew: number;
  crewType: number;
  gold: number;
  rice: number;
  injury: number;
  [key: string]: any;
}

export class CommanderRepository extends CachedRepository<GeneralEntity> {
  constructor(gameCache: GameStateCache, model: Model<any>) {
    super(gameCache, model, EntityType.GENERAL);
  }

  protected toEntity(doc: any): GeneralEntity {
    return {
      id: doc._id.toString(),
      sessionId: doc.sessionId,
      name: doc.name,
      nation: doc.nation?.toString() || '',
      city: doc.city?.toString() || '',
      leadership: doc.leadership || 0,
      strength: doc.strength || 0,
      intel: doc.intel || 0,
      leadership_exp: doc.leadership_exp || 0,
      strength_exp: doc.strength_exp || 0,
      intel_exp: doc.intel_exp || 0,
      exp: doc.exp || 0,
      ded: doc.ded || 0,
      train: doc.train || 0,
      atmos: doc.atmos || 0,
      crew: doc.crew || 0,
      crewType: doc.crewType || 0,
      gold: doc.gold || 0,
      rice: doc.rice || 0,
      injury: doc.injury || 0,
      version: 0,
      dirty: false,
      updatedAt: Date.now(),
      ...doc,
    };
  }
}

/**
 * City Repository
 */
export interface CityEntity extends CachedEntity {
  id: string;
  sessionId: string;
  name: string;
  nation: string;
  agri: number;
  comm: number;
  def: number;
  wall: number;
  secu: number;
  pop: number;
  trust: number;
  agri_max: number;
  comm_max: number;
  def_max: number;
  wall_max: number;
  secu_max: number;
  pop_max: number;
  level: number;
  [key: string]: any;
}

export class SettlementRepository extends CachedRepository<CityEntity> {
  constructor(gameCache: GameStateCache, model: Model<any>) {
    super(gameCache, model, EntityType.CITY);
  }

  protected toEntity(doc: any): CityEntity {
    return {
      id: doc._id.toString(),
      sessionId: doc.sessionId,
      name: doc.name,
      nation: doc.nation?.toString() || '',
      agri: doc.agri || 0,
      comm: doc.comm || 0,
      def: doc.def || 0,
      wall: doc.wall || 0,
      secu: doc.secu || 0,
      pop: doc.pop || 0,
      trust: doc.trust || 100,
      agri_max: doc.agri_max || 10000,
      comm_max: doc.comm_max || 10000,
      def_max: doc.def_max || 10000,
      wall_max: doc.wall_max || 10000,
      secu_max: doc.secu_max || 10000,
      pop_max: doc.pop_max || 100000,
      level: doc.level || 1,
      version: 0,
      dirty: false,
      updatedAt: Date.now(),
      ...doc,
    };
  }
}

/**
 * Nation Repository
 */
export interface NationEntity extends CachedEntity {
  id: string;
  sessionId: string;
  name: string;
  capital: string;
  tech: number;
  gold: number;
  rice: number;
  [key: string]: any;
}

export class FactionRepository extends CachedRepository<NationEntity> {
  constructor(gameCache: GameStateCache, model: Model<any>) {
    super(gameCache, model, EntityType.NATION);
  }

  protected toEntity(doc: any): NationEntity {
    return {
      id: doc._id.toString(),
      sessionId: doc.sessionId,
      name: doc.name,
      capital: doc.capital?.toString() || '',
      tech: doc.tech || 0,
      gold: doc.gold || 0,
      rice: doc.rice || 0,
      version: 0,
      dirty: false,
      updatedAt: Date.now(),
      ...doc,
    };
  }
}
