/**
 * 범용 액션 타입 정의
 *
 * 삼국지/은하영웅전설 공통 액션 시스템
 */

import { WorldType } from './world.types';
import { RoleRef } from '../../common/@types/role.types';

/**
 * 액션 카테고리
 */
export enum ActionCategory {
  // 내정
  DOMESTIC = 'DOMESTIC',        // 내정 (농업, 상업, 치안, 성벽)
  DEVELOPMENT = 'DEVELOPMENT',  // 개발 (기술, 시설)

  // 군사
  MILITARY = 'MILITARY',        // 군사 (훈련, 징병, 배치)
  COMBAT = 'COMBAT',            // 전투 (공격, 방어, 이동)

  // 외교
  DIPLOMACY = 'DIPLOMACY',      // 외교 (동맹, 선전포고, 강화)
  TRADE = 'TRADE',              // 무역 (거래, 교역로)

  // 인사
  PERSONNEL = 'PERSONNEL',      // 인사 (임명, 해임, 등용)
  TRAINING = 'TRAINING',        // 수련 (능력치 향상)

  // 정보
  INTELLIGENCE = 'INTELLIGENCE', // 정보 (정탐, 공작)

  // 기타
  SPECIAL = 'SPECIAL',          // 특수 (이벤트, 퀘스트)
  ADMIN = 'ADMIN'               // 관리 (휴식, 대기)
}

/**
 * 액션 결과
 */
export interface ActionResult {
  success: boolean;
  message: string;
  messageType: 'success' | 'error' | 'warning' | 'info';

  /**
   * 변경사항 (캐시 업데이트용)
   */
  changes: {
    entities?: Array<{
      ref: RoleRef;
      patch: Record<string, any>;
    }>;
    systemStates?: Array<{
      systemId: string;
      ownerRef: RoleRef;
      patch: Record<string, any>;
    }>;
  };

  /**
   * 로그 데이터
   */
  logs?: Array<{
    type: string;
    message: string;
    data?: any;
  }>;

  /**
   * 통계 데이터
   */
  stats?: Record<string, number>;
}

/**
 * 액션 컨텍스트
 */
export interface ActionContext {
  worldType: WorldType;
  sessionId: string;
  actorRef: RoleRef;
  targetRef?: RoleRef;
  timestamp: Date;
  turnNumber?: number;
}

/**
 * 액션 페이로드 (기본)
 */
export interface ActionPayload {
  category: ActionCategory;
  type: string;
  arg?: Record<string, any>;
}

/**
 * 액션 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 액션 핸들러 인터페이스
 */
export interface ActionHandler {
  /**
   * 액션 타입
   */
  readonly type: string;

  /**
   * 액션 카테고리
   */
  readonly category: ActionCategory;

  /**
   * 지원하는 세계관
   */
  readonly supportedWorlds: WorldType[];

  /**
   * 액션 검증
   */
  validate(ctx: ActionContext, payload: ActionPayload): Promise<ValidationResult>;

  /**
   * 액션 실행
   */
  execute(ctx: ActionContext, payload: ActionPayload): Promise<ActionResult>;

  /**
   * 액션 요약 (UI 표시용)
   */
  getBrief(payload: ActionPayload): string;

  /**
   * 액션 비용 계산 (턴/자원)
   */
  getCost(ctx: ActionContext, payload: ActionPayload): Promise<{
    turns: number;
    resources: Record<string, number>;
  }>;
}

/**
 * 삼국지 전용 액션 타입
 */
export enum SangokushiActionType {
  // 내정
  CULTIVATE_FARM = 'CULTIVATE_FARM',
  CULTIVATE_LAND = 'CULTIVATE_LAND',
  BOOST_COMMERCE = 'BOOST_COMMERCE',
  BOOST_SECURITY = 'BOOST_SECURITY',
  BOOST_WALL = 'BOOST_WALL',

  // 군사
  TRAIN_TROOPS = 'TRAIN_TROOPS',
  RECRUIT_TROOPS = 'RECRUIT_TROOPS',
  DEPLOY_TROOPS = 'DEPLOY_TROOPS',
  MOVE = 'MOVE',
  OCCUPY = 'OCCUPY',

  // 외교
  DIPLOMACY_ALLY = 'DIPLOMACY_ALLY',
  DIPLOMACY_DECLARE_WAR = 'DIPLOMACY_DECLARE_WAR',
  DIPLOMACY_PEACE = 'DIPLOMACY_PEACE',

  // 인사
  APPOINT = 'APPOINT',
  DISMISS = 'DISMISS',
  RECRUIT_GENERAL = 'RECRUIT_GENERAL',

  // 훈련
  TRAIN_LEADERSHIP = 'TRAIN_LEADERSHIP',
  TRAIN_STRENGTH = 'TRAIN_STRENGTH',
  TRAIN_INTELLIGENCE = 'TRAIN_INTELLIGENCE',

  // 기타
  REST = 'REST',
  SPECIAL_EVENT = 'SPECIAL_EVENT'
}

/**
 * 은하영웅전설 전용 액션 타입
 */
export enum LoghActionType {
  // 내정
  DEVELOP_ECONOMY = 'DEVELOP_ECONOMY',
  DEVELOP_TECHNOLOGY = 'DEVELOP_TECHNOLOGY',
  DEVELOP_FACILITY = 'DEVELOP_FACILITY',

  // 군사
  BUILD_FLEET = 'BUILD_FLEET',
  TRAIN_FLEET = 'TRAIN_FLEET',
  DEPLOY_FLEET = 'DEPLOY_FLEET',
  MOVE_FLEET = 'MOVE_FLEET',
  ATTACK = 'ATTACK',

  // 외교
  DIPLOMACY_NEGOTIATE = 'DIPLOMACY_NEGOTIATE',
  DIPLOMACY_TRADE_AGREEMENT = 'DIPLOMACY_TRADE_AGREEMENT',

  // 인사
  APPOINT_COMMANDER = 'APPOINT_COMMANDER',
  TRAIN_COMMANDER = 'TRAIN_COMMANDER',

  // 기타
  REST = 'REST',
  SPECIAL_MISSION = 'SPECIAL_MISSION'
}
