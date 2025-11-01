import { Entity, IEntity } from '../model/entity.model';
import { Edge, IEdge } from '../model/edge.model';
import { RoleRef, RelationKey, ScenarioId } from '../@types/role.types';
import { FilterQuery, UpdateQuery } from 'mongoose';

/**
 * 낙관적 잠금 오류
 */
export class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

/**
 * Entity Repository
 * CRUD 작업 및 관계(Edge) 관리
 */
export class EntityRepository {
  /**
   * 새 엔티티 생성
   */
  static async create(data: Partial<IEntity>): Promise<IEntity> {
    const entity = new Entity({
      ...data,
      version: 1,
    });
    return await entity.save();
  }

  /**
   * ID로 엔티티 조회
   */
  static async findById(ref: RoleRef): Promise<IEntity | null> {
    return await Entity.findOne({
      scenario: ref.scenario,
      role: ref.role,
      id: ref.id,
    }).exec();
  }

  /**
   * 쿼리로 엔티티 조회
   */
  static async findByQuery(query: FilterQuery<IEntity>): Promise<IEntity[]> {
    return await Entity.find(query).exec();
  }

  /**
   * 단일 엔티티 쿼리 조회
   */
  static async findOne(query: FilterQuery<IEntity>): Promise<IEntity | null> {
    return await Entity.findOne(query).exec();
  }

  /**
   * 엔티티 전체 업데이트 (낙관적 잠금)
   */
  static async update(
    ref: RoleRef,
    data: Partial<IEntity>,
    expectedVersion?: number
  ): Promise<IEntity | null> {
    const query: FilterQuery<IEntity> = {
      scenario: ref.scenario,
      role: ref.role,
      id: ref.id,
    };

    // 낙관적 잠금: 버전 검증
    if (expectedVersion !== undefined) {
      query.version = expectedVersion;
    }

    const updated = await Entity.findOneAndUpdate(
      query,
      {
        ...data,
        $inc: { version: 1 },
      },
      { new: true }
    ).exec();

    // 낙관적 잠금 실패 처리
    if (expectedVersion !== undefined && !updated) {
      throw new OptimisticLockError(
        `버전 충돌: ${ref.scenario}:${ref.role}:${ref.id} (예상 버전: ${expectedVersion})`
      );
    }

    return updated;
  }

  /**
   * 엔티티 부분 업데이트 (Patch, 낙관적 잠금)
   */
  static async patch(
    ref: RoleRef,
    changes: UpdateQuery<IEntity>,
    expectedVersion?: number
  ): Promise<IEntity | null> {
    const query: FilterQuery<IEntity> = {
      scenario: ref.scenario,
      role: ref.role,
      id: ref.id,
    };

    // 낙관적 잠금: 버전 검증
    if (expectedVersion !== undefined) {
      query.version = expectedVersion;
    }

    const updated = await Entity.findOneAndUpdate(
      query,
      {
        ...changes,
        $inc: { version: 1 },
      },
      { new: true }
    ).exec();

    // 낙관적 잠금 실패 처리
    if (expectedVersion !== undefined && !updated) {
      throw new OptimisticLockError(
        `버전 충돌: ${ref.scenario}:${ref.role}:${ref.id} (예상 버전: ${expectedVersion})`
      );
    }

    return updated;
  }

  /**
   * 엔티티 삭제
   */
  static async delete(ref: RoleRef): Promise<boolean> {
    const result = await Entity.deleteOne({
      scenario: ref.scenario,
      role: ref.role,
      id: ref.id,
    }).exec();

    return result.deletedCount > 0;
  }

  /**
   * 여러 엔티티 일괄 조회
   */
  static async findByIds(refs: RoleRef[]): Promise<IEntity[]> {
    const queries = refs.map((ref) => ({
      scenario: ref.scenario,
      role: ref.role,
      id: ref.id,
    }));

    return await Entity.find({ $or: queries }).exec();
  }

  /**
   * 관계(Edge) 조회 - from 기준
   */
  static async findEdgesFrom(
    ref: RoleRef,
    key?: RelationKey
  ): Promise<IEdge[]> {
    const query: FilterQuery<IEdge> = {
      scenario: ref.scenario,
      'from.role': ref.role,
      'from.id': ref.id,
    };

    if (key) {
      query.key = key;
    }

    return await Edge.find(query).exec();
  }

  /**
   * 관계(Edge) 조회 - to 기준
   */
  static async findEdgesTo(ref: RoleRef, key?: RelationKey): Promise<IEdge[]> {
    const query: FilterQuery<IEdge> = {
      scenario: ref.scenario,
      'to.role': ref.role,
      'to.id': ref.id,
    };

    if (key) {
      query.key = key;
    }

    return await Edge.find(query).exec();
  }

  /**
   * 관계(Edge) 조회 - 양방향
   */
  static async findEdges(ref: RoleRef, key?: RelationKey): Promise<IEdge[]> {
    const [fromEdges, toEdges] = await Promise.all([
      this.findEdgesFrom(ref, key),
      this.findEdgesTo(ref, key),
    ]);

    return [...fromEdges, ...toEdges];
  }

  /**
   * 관계(Edge) 생성
   */
  static async createEdge(
    scenario: ScenarioId,
    key: RelationKey,
    from: RoleRef,
    to: RoleRef,
    metadata?: Record<string, any>
  ): Promise<IEdge> {
    const edge = new Edge({
      scenario,
      key,
      from: {
        role: from.role,
        id: from.id,
        scenario: from.scenario,
      },
      to: {
        role: to.role,
        id: to.id,
        scenario: to.scenario,
      },
      metadata: metadata || {},
    });

    return await edge.save();
  }

  /**
   * 관계(Edge) 삭제
   */
  static async deleteEdge(
    scenario: ScenarioId,
    key: RelationKey,
    from: RoleRef,
    to: RoleRef
  ): Promise<boolean> {
    const result = await Edge.deleteOne({
      scenario,
      key,
      'from.role': from.role,
      'from.id': from.id,
      'from.scenario': from.scenario,
      'to.role': to.role,
      'to.id': to.id,
      'to.scenario': to.scenario,
    }).exec();

    return result.deletedCount > 0;
  }

  /**
   * 특정 엔티티와 관련된 모든 관계(Edge) 삭제
   */
  static async deleteAllEdges(ref: RoleRef): Promise<number> {
    const result = await Edge.deleteMany({
      $or: [
        {
          scenario: ref.scenario,
          'from.role': ref.role,
          'from.id': ref.id,
        },
        {
          scenario: ref.scenario,
          'to.role': ref.role,
          'to.id': ref.id,
        },
      ],
    }).exec();

    return result.deletedCount;
  }

  /**
   * 시나리오 전체 엔티티 수 조회
   */
  static async count(scenario: ScenarioId, role?: string): Promise<number> {
    const query: FilterQuery<IEntity> = { scenario };
    if (role) {
      query.role = role;
    }
    return await Entity.countDocuments(query).exec();
  }

  /**
   * 페이지네이션 조회
   */
  static async findPaginated(
    query: FilterQuery<IEntity>,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: IEntity[]; total: number; page: number; pages: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Entity.find(query).skip(skip).limit(limit).exec(),
      Entity.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
