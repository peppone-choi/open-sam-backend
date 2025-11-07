import mongoose from 'mongoose';
import { Role, RoleRef, ScenarioId, EntityId, RelationKey } from '../@types/role.types';
import { EntityBase } from '../@types/archetype.types';
import { ScenarioRegistry } from '../registry/scenario-registry';

/**
 * Role 기반 중립 Repository
 * 
 * Lore 중립적으로 엔티티를 조회/저장
 */
export class RoleRepository {
  /**
   * RoleRef로 엔티티 조회
   */
  static async get<T extends EntityBase>(ref: RoleRef): Promise<T | null> {
    const roleConfig = ScenarioRegistry.getRole(ref.scenario, ref.role);
    
    if (!roleConfig) {
      throw new Error(`Role ${ref.role} not found in scenario ${ref.scenario}`);
    }
    
    const collection = mongoose.connection.collection(roleConfig.collection);
    const doc = await collection.findOne({ _id: new mongoose.Types.ObjectId(ref.id) });
    
    if (!doc) return null;
    
    return {
      ...doc,
      id: doc._id.toString(),
    } as unknown as T;
  }

  /**
   * 여러 RoleRef 일괄 조회
   */
  static async findByIds<T extends EntityBase>(refs: RoleRef[]): Promise<T[]> {
    const results: T[] = [];
    
    for (const ref of refs) {
      const entity = await this.get<T>(ref);
      if (entity) {
        results.push(entity);
      }
    }
    
    return results;
  }

  /**
   * RoleRef 생성 헬퍼
   */
  static resolve<R extends Role>(
    role: R,
    id: EntityId,
    scenario: ScenarioId
  ): RoleRef<R> {
    return { role, id, scenario };
  }

  /**
   * 시나리오의 특정 Role 엔티티 전체 조회
   */
  static async findAll<T extends EntityBase>(
    scenario: ScenarioId,
    role: Role,
    limit: number = 100
  ): Promise<T[]> {
    const roleConfig = ScenarioRegistry.getRole(scenario, role);
    
    if (!roleConfig) {
      return [];
    }
    
    const collection = mongoose.connection.collection(roleConfig.collection);
    const docs = await collection.find({}).limit(limit).toArray();
    
    return docs.map(doc => ({
      ...doc,
      id: doc._id.toString(),
    })) as any as T[];
  }

  /**
   * 엔티티 업데이트
   */
  static async update<T extends EntityBase>(
    ref: RoleRef,
    patch: Partial<T>
  ): Promise<T | null> {
    const roleConfig = ScenarioRegistry.getRole(ref.scenario, ref.role);
    
    if (!roleConfig) {
      throw new Error(`Role ${ref.role} not found in scenario ${ref.scenario}`);
    }
    
    const collection = mongoose.connection.collection(roleConfig.collection);
    const result = await collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(ref.id) },
      { $set: { ...patch, updatedAt: new Date() }, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    
    if (!result) return null;
    
    return {
      ...result,
      id: result._id.toString(),
    } as unknown as T;
  }
}

/**
 * 관계 헬퍼
 */
export class RelationHelper {
  /**
   * 관련 엔티티 참조 조회
   */
  static async getRelated<TTo extends Role>(
    fromRef: RoleRef,
    relationKey: RelationKey
  ): Promise<RoleRef<TTo> | null> {
    const relationConfig = ScenarioRegistry.getRelation(fromRef.scenario, relationKey);
    
    if (!relationConfig) {
      return null;
    }
    
    // FROM 엔티티 조회
    const fromEntity = await RoleRepository.get(fromRef);
    if (!fromEntity) return null;
    
    // 관계 필드 값 추출
    const fieldValue = fromEntity[relationConfig.viaField];
    if (!fieldValue) return null;
    
    // RoleRef 생성
    return {
      role: relationConfig.to as TTo,
      id: String(fieldValue),
      scenario: fromRef.scenario
    };
  }

  /**
   * 관련 엔티티 목록 조회 (1:N 관계)
   */
  static async getRelatedMany<TTo extends Role>(
    fromRef: RoleRef,
    relationKey: RelationKey
  ): Promise<RoleRef<TTo>[]> {
    const relationConfig = ScenarioRegistry.getRelation(fromRef.scenario, relationKey);
    
    if (!relationConfig) {
      return [];
    }
    
    const fromEntity = await RoleRepository.get(fromRef);
    if (!fromEntity) return [];
    
    const fieldValue = fromEntity[relationConfig.viaField];
    
    if (!fieldValue) return [];
    
    // 배열인 경우
    if (Array.isArray(fieldValue)) {
      return fieldValue.map(id => ({
        role: relationConfig.to as TTo,
        id: String(id),
        scenario: fromRef.scenario
      }));
    }
    
    // 단일 값
    return [{
      role: relationConfig.to as TTo,
      id: String(fieldValue),
      scenario: fromRef.scenario
    }];
  }

  /**
   * 관계 설정
   */
  static async setRelated(
    fromRef: RoleRef,
    relationKey: RelationKey,
    toRef: RoleRef | null
  ): Promise<void> {
    const relationConfig = ScenarioRegistry.getRelation(fromRef.scenario, relationKey);
    
    if (!relationConfig) {
      throw new Error(`Relation ${relationKey} not found in scenario ${fromRef.scenario}`);
    }
    
    const patch = {
      [relationConfig.viaField]: toRef ? toRef.id : null
    };
    
    await RoleRepository.update(fromRef, patch);
  }

  /**
   * 역관계 조회 (소유자 찾기 등)
   */
  static async findByRelation<T extends EntityBase>(
    toRef: RoleRef,
    relationKey: RelationKey
  ): Promise<T[]> {
    const relationConfig = ScenarioRegistry.getRelation(toRef.scenario, relationKey);
    
    if (!relationConfig) {
      return [];
    }
    
    const roleConfig = ScenarioRegistry.getRole(toRef.scenario, relationConfig.from);
    if (!roleConfig) return [];
    
    const collection = mongoose.connection.collection(roleConfig.collection);
    const docs = await collection.find({
      [relationConfig.viaField]: toRef.id
    }).toArray();
    
    
    return docs.map(doc => ({
      ...doc,
      id: doc._id.toString(),
    })) as any;
  }
}
