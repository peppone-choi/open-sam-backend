/**
 * 시스템 엔진
 * 
 * 게임 시스템의 실행을 관리하는 중앙 엔진
 */

import { GameSystem, GameSystemContext } from '../@types/game-system.types';
import { RoleRef, ScenarioId } from '../@types/role.types';
import { Entity } from '../@types/entity.types';
import { RoleRepository } from '../repository/role-repository';

/**
 * 시스템 레지스트리
 * 등록된 게임 시스템을 관리
 */
class SystemRegistry {
  private systems = new Map<string, GameSystem>();

  /**
   * 시스템 등록
   */
  register(system: GameSystem): void {
    this.systems.set(system.id, system);
  }

  /**
   * 시스템 조회
   */
  get(systemId: string): GameSystem | undefined {
    return this.systems.get(systemId);
  }

  /**
   * 모든 시스템 조회
   */
  getAll(): GameSystem[] {
    return Array.from(this.systems.values());
  }
}

/**
 * 시스템 엔진
 * 게임 시스템의 커맨드 실행, 틱 처리, 초기화를 담당
 */
export class SystemEngine {
  private registry = new SystemRegistry();
  private eventHandlers: Array<(eventType: string, data: any) => Promise<void>> = [];

  /**
   * 시스템 등록
   */
  registerSystem(system: GameSystem): void {
    this.registry.register(system);
  }

  /**
   * 이벤트 핸들러 등록
   */
  onEvent(handler: (eventType: string, data: any) => Promise<void>): void {
    this.eventHandlers.push(handler);
  }

  /**
   * 커맨드 실행
   * @param scenario 시나리오 ID
   * @param systemId 시스템 ID
   * @param command 커맨드명
   * @param actor 행위자 참조
   * @param payload 커맨드 페이로드
   */
  async executeCommand(
    scenario: ScenarioId,
    systemId: string,
    command: string,
    actor: RoleRef,
    payload: any
  ): Promise<void> {
    const system = this.registry.get(systemId);
    
    if (!system) {
      throw new Error(`시스템을 찾을 수 없습니다: ${systemId}`);
    }

    if (!system.reducers || !system.reducers[command]) {
      throw new Error(`커맨드를 찾을 수 없습니다: ${systemId}.${command}`);
    }

    // 유효성 검사
    if (system.validators && system.validators[command]) {
      const validator = system.validators[command];
      if (typeof validator === 'function') {
        const isValid = await validator(payload);
        if (!isValid) {
          throw new Error(`커맨드 검증 실패: ${systemId}.${command}`);
        }
      }
    }

    // 컨텍스트 생성
    const ctx = await this.createContext(scenario, actor);

    // 리듀서 실행
    await system.reducers[command](ctx, payload);
  }

  /**
   * 틱 실행
   * @param scenario 시나리오 ID
   * @param systemId 시스템 ID
   */
  async executeTick(scenario: ScenarioId, systemId: string): Promise<void> {
    const system = this.registry.get(systemId);
    
    if (!system) {
      throw new Error(`시스템을 찾을 수 없습니다: ${systemId}`);
    }

    if (!system.tick) {
      return;
    }

    // 컨텍스트 생성
    const ctx = await this.createContext(scenario);

    // 틱 실행
    await system.tick(ctx);
  }

  /**
   * 시스템 초기화
   * @param entity 엔티티 (entity 스코프) 또는 소유자 참조 (faction/scenario 스코프)
   * @param systemId 시스템 ID
   */
  async initializeSystem(entity: Entity | RoleRef, systemId: string): Promise<void> {
    const system = this.registry.get(systemId);
    
    if (!system) {
      throw new Error(`시스템을 찾을 수 없습니다: ${systemId}`);
    }

    // entity가 Entity인지 RoleRef인지 구분
    let scenario: ScenarioId;
    let ownerRef: RoleRef;

    if ('role' in entity && 'id' in entity && 'scenario' in entity && !('attributes' in entity)) {
      // RoleRef
      ownerRef = entity as RoleRef;
      scenario = ownerRef.scenario;
    } else {
      // Entity
      const entityObj = entity as Entity;
      scenario = entityObj.scenario;
      ownerRef = {
        role: entityObj.role,
        id: entityObj.id,
        scenario: entityObj.scenario
      };
    }

    // 컨텍스트 생성
    const ctx = await this.createContext(scenario, ownerRef);

    // 초기 상태 생성
    const initialState = system.initState(ctx, ownerRef);

    // 스코프에 따라 저장 위치 결정
    if (system.scope === 'entity') {
      // Entity의 systems 필드에 저장
      const loadedEntity = await ctx.loadEntity(ownerRef);
      loadedEntity.systems = loadedEntity.systems || {};
      loadedEntity.systems[systemId] = initialState;
      await ctx.saveEntity(loadedEntity, { systems: loadedEntity.systems });
    } else {
      // SystemState 컬렉션에 저장
      await ctx.saveSystemState(systemId, initialState, ownerRef);
    }
  }

  /**
   * 컨텍스트 생성
   */
  private async createContext(
    scenario: ScenarioId,
    actor?: RoleRef,
    target?: RoleRef
  ): Promise<GameSystemContext> {
    return {
      scenario,
      actor,
      target,
      now: new Date(),

      async loadEntity(ref: RoleRef): Promise<Entity> {
        const entity = await RoleRepository.get<Entity>(ref);
        if (!entity) {
          throw new Error(`엔티티를 찾을 수 없습니다: ${ref.role}:${ref.id}`);
        }
        return entity;
      },

      async saveEntity(entity: Entity, patch: any): Promise<void> {
        const ref: RoleRef = {
          role: entity.role,
          id: entity.id,
          scenario: entity.scenario
        };
        await RoleRepository.update(ref, patch);
      },

      async loadSystemState(systemId: string, ownerRef?: RoleRef): Promise<any> {
        // SystemState 컬렉션에서 조회
        // TODO: SystemStateRepository 구현 필요
        // 임시로 null 반환
        return null;
      },

      async saveSystemState(systemId: string, state: any, ownerRef?: RoleRef): Promise<void> {
        // SystemState 컬렉션에 저장
        // TODO: SystemStateRepository 구현 필요
      },

      emit: async (eventType: string, data: any): Promise<void> => {
        // 등록된 모든 이벤트 핸들러 실행
        for (const handler of this.eventHandlers) {
          await handler(eventType, data);
        }
      }
    };
  }

  /**
   * 셀렉터 실행
   * @param scenario 시나리오 ID
   * @param systemId 시스템 ID
   * @param selectorName 셀렉터명
   * @param owner 소유자 참조
   * @returns 조회 결과
   */
  async executeSelector(
    scenario: ScenarioId,
    systemId: string,
    selectorName: string,
    owner: RoleRef
  ): Promise<any> {
    const system = this.registry.get(systemId);
    
    if (!system) {
      throw new Error(`시스템을 찾을 수 없습니다: ${systemId}`);
    }

    if (!system.selectors || !system.selectors[selectorName]) {
      throw new Error(`셀렉터를 찾을 수 없습니다: ${systemId}.${selectorName}`);
    }

    const ctx = await this.createContext(scenario);
    return await system.selectors[selectorName](ctx, owner);
  }
}

// 싱글톤 인스턴스 내보내기
export const systemEngine = new SystemEngine();
