/**
 * 게임 시스템 타입 정의
 * 
 * 모듈형 게임 로직을 위한 시스템 인터페이스
 */

import { RoleRef, ScenarioId } from './role.types';
import { Entity } from './entity.types';

/**
 * 게임 시스템 컨텍스트
 * 시스템이 게임 상태와 상호작용하는 인터페이스
 */
export interface GameSystemContext {
  /** 시나리오 ID */
  scenario: ScenarioId;
  
  /** 행위자 (커맨드 실행자) */
  actor?: RoleRef;
  
  /** 대상 엔티티 */
  target?: RoleRef;
  
  /** 현재 시각 */
  now: Date;
  
  /**
   * 엔티티 로드
   * @param ref 엔티티 참조
   * @returns 엔티티 객체
   */
  loadEntity(ref: RoleRef): Promise<Entity>;
  
  /**
   * 엔티티 저장
   * @param entity 엔티티 객체
   * @param patch 변경 내용
   */
  saveEntity(entity: Entity, patch: any): Promise<void>;
  
  /**
   * 시스템 상태 로드
   * @param systemId 시스템 ID
   * @param ownerRef 소유자 참조 (faction/scenario 스코프용)
   * @returns 시스템 상태
   */
  loadSystemState(systemId: string, ownerRef?: RoleRef): Promise<any>;
  
  /**
   * 시스템 상태 저장
   * @param systemId 시스템 ID
   * @param state 상태 데이터
   * @param ownerRef 소유자 참조 (faction/scenario 스코프용)
   */
  saveSystemState(systemId: string, state: any, ownerRef?: RoleRef): Promise<void>;
  
  /**
   * 이벤트 발행
   * @param eventType 이벤트 타입
   * @param data 이벤트 데이터
   */
  emit(eventType: string, data: any): Promise<void>;
}

/**
 * 게임 시스템 인터페이스
 * 모듈형 게임 로직 구현을 위한 표준 인터페이스
 */
export interface GameSystem {
  /** 시스템 고유 ID */
  id: string;
  
  /** 시스템 스코프 */
  scope: 'entity' | 'faction' | 'scenario';
  
  /**
   * 시스템 초기 상태 생성
   * @param ctx 게임 시스템 컨텍스트
   * @param owner 소유자 참조
   * @returns 초기 상태
   */
  initState(ctx: GameSystemContext, owner: RoleRef): any;
  
  /**
   * 주기적 실행 로직 (틱)
   * @param ctx 게임 시스템 컨텍스트
   */
  tick?(ctx: GameSystemContext): Promise<void>;
  
  /**
   * 커맨드 리듀서 맵
   * 커맨드명 -> 실행 함수
   */
  reducers?: Record<string, (ctx: GameSystemContext, payload: any) => Promise<void>>;
  
  /**
   * 유효성 검사기 맵
   * 커맨드명 -> 검증 스키마/함수
   */
  validators?: Record<string, any>;
  
  /**
   * 셀렉터 맵
   * 쿼리명 -> 조회 함수
   */
  selectors?: Record<string, (ctx: GameSystemContext, owner: RoleRef) => Promise<any>>;
}
