/**
 * 범용 게임 엔진 - 데몬 아키텍처
 *
 * ⚠️ CRITICAL 원칙:
 * 1. 게임 플레이는 캐시만 사용 (L1 메모리 → L2 Redis)
 * 2. DB는 영속성/로그만 (크론 5초마다 저장)
 * 3. 세계관 독립 설계 (삼국지/은하영웅전설 공통)
 */

import { Entity } from '../common/@types/entity.types';
import { RoleRef, ScenarioId } from '../common/@types/role.types';
import { WorldType } from './types/world.types';
import { ActionContext, ActionPayload, ActionResult, ActionHandler } from './types/action.types';
import { CacheManager } from '../cache/CacheManager';
import { logger } from '../common/logger';

/**
 * 캐시 키 생성 헬퍼
 */
export class CacheKeyHelper {
  static entity(ref: RoleRef): string {
    return `entity:${ref.role}:${ref.id}`;
  }

  static systemState(scenario: ScenarioId, systemId: string, ownerRef?: RoleRef): string {
    if (ownerRef) {
      return `system:${scenario}:${systemId}:${ownerRef.role}:${ownerRef.id}`;
    }
    return `system:${scenario}:${systemId}`;
  }

  static session(sessionId: string): string {
    return `session:${sessionId}`;
  }

  static dirty(key: string): string {
    return `dirty:${key}`;
  }
}

/**
 * 범용 게임 엔진 베이스
 */
export class UniversalGameEngine {
  /**
   * 액션 핸들러 레지스트리
   */
  private handlers: Map<string, ActionHandler> = new Map();

  /**
   * Dirty 세트 (크론 저장 대상)
   */
  private dirtySet: Set<string> = new Set();

  constructor(
    private cacheManager: CacheManager
  ) {
    logger.info('UniversalGameEngine 초기화');
  }

  /**
   * 액션 핸들러 등록
   */
  registerHandler(handler: ActionHandler): void {
    this.handlers.set(handler.type, handler);
    logger.debug(`액션 핸들러 등록: ${handler.type} (${handler.category})`);
  }

  /**
   * 엔티티 로드 (캐시 우선)
   *
   * ⚠️ CRITICAL: API에서 절대 DB 직접 조회 금지!
   * L1 (메모리) → L2 (Redis) → 캐시 미스 에러
   */
  async loadEntity(ref: RoleRef): Promise<Entity | null> {
    const key = CacheKeyHelper.entity(ref);

    // L1 → L2 자동 조회
    const entity = await this.cacheManager.get<Entity>(key);
    if (entity) {
      logger.debug(`캐시 히트: ${key}`);
      return entity;
    }

    // 캐시 미스 (게임 플레이 중 발생하면 안 됨!)
    logger.warn(`⚠️ 캐시 미스 발생: ${key} - 서버 시작 시 캐시 로딩 필요`);
    return null;
  }

  /**
   * 엔티티 저장 (캐시 업데이트 + Dirty 마킹)
   */
  async saveEntity(entity: Entity, patch: Record<string, any>): Promise<void> {
    const ref: RoleRef = { role: entity.role, id: entity.id, scenario: entity.scenario };
    const key = CacheKeyHelper.entity(ref);

    // 패치 적용
    Object.assign(entity, patch);
    entity.updatedAt = new Date();
    entity.version += 1;

    // L1 + L2 업데이트
    await this.cacheManager.set(key, entity);

    // Dirty 마킹 (크론에서 DB 저장)
    this.dirtySet.add(key);
    await this.cacheManager.set(CacheKeyHelper.dirty(key), { timestamp: Date.now() }, 600);

    logger.debug(`엔티티 업데이트: ${key} (dirty 마킹 완료)`);
  }

  /**
   * 시스템 상태 로드 (캐시 우선)
   */
  async loadSystemState(scenario: ScenarioId, systemId: string, ownerRef?: RoleRef): Promise<any | null> {
    const key = CacheKeyHelper.systemState(scenario, systemId, ownerRef);
    const state = await this.cacheManager.get<any>(key);

    if (!state) {
      logger.warn(`⚠️ 시스템 상태 캐시 미스: ${key}`);
    }

    return state;
  }

  /**
   * 시스템 상태 저장 (캐시 업데이트 + Dirty 마킹)
   */
  async saveSystemState(scenario: ScenarioId, systemId: string, state: any, ownerRef?: RoleRef): Promise<void> {
    const key = CacheKeyHelper.systemState(scenario, systemId, ownerRef);

    // L1 + L2 업데이트
    await this.cacheManager.set(key, state);

    // Dirty 마킹
    this.dirtySet.add(key);
    await this.cacheManager.set(CacheKeyHelper.dirty(key), { timestamp: Date.now() }, 600);

    logger.debug(`시스템 상태 업데이트: ${key}`);
  }

  /**
   * 액션 실행
   */
  async executeAction(ctx: ActionContext, payload: ActionPayload): Promise<ActionResult> {
    const handler = this.handlers.get(payload.type);
    if (!handler) {
      return {
        success: false,
        message: `알 수 없는 액션 타입: ${payload.type}`,
        messageType: 'error',
        changes: {}
      };
    }

    // 세계관 지원 확인
    if (!handler.supportedWorlds.includes(ctx.worldType)) {
      return {
        success: false,
        message: `${ctx.worldType} 세계관에서 지원하지 않는 액션: ${payload.type}`,
        messageType: 'error',
        changes: {}
      };
    }

    try {
      // 1. 검증
      const validation = await handler.validate(ctx, payload);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.errors?.join(', ') || '검증 실패',
          messageType: 'error',
          changes: {}
        };
      }

      // 2. 실행
      const result = await handler.execute(ctx, payload);

      // 3. 변경사항 적용 (캐시 업데이트)
      if (result.changes.entities) {
        for (const { ref, patch } of result.changes.entities) {
          const entity = await this.loadEntity(ref);
          if (entity) {
            await this.saveEntity(entity, patch);
          }
        }
      }

      if (result.changes.systemStates) {
        for (const { systemId, ownerRef, patch } of result.changes.systemStates) {
          const state = await this.loadSystemState(ctx.sessionId, systemId, ownerRef);
          if (state) {
            await this.saveSystemState(ctx.sessionId, systemId, { ...state, ...patch }, ownerRef);
          }
        }
      }

      logger.info(`액션 실행 성공: ${payload.type}`, { actor: ctx.actorRef, result: result.success });
      return result;

    } catch (error) {
      logger.error(`액션 실행 실패: ${payload.type}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        messageType: 'error',
        changes: {}
      };
    }
  }

  /**
   * Dirty 엔티티 목록 조회 (크론 저장용)
   */
  getDirtyKeys(): string[] {
    return Array.from(this.dirtySet);
  }

  /**
   * Dirty 세트 초기화 (크론 저장 후)
   */
  clearDirtyKeys(): void {
    this.dirtySet.clear();
  }

  /**
   * 등록된 핸들러 통계
   */
  getStats() {
    return {
      totalHandlers: this.handlers.size,
      dirtyEntities: this.dirtySet.size,
      handlers: Array.from(this.handlers.keys())
    };
  }
}
