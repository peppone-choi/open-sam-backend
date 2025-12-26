/**
 * 전투 명령 기본 인터페이스
 * MUG 스타일 전투에서 사용되는 명령들
 */

import { WarUnitState } from '../engines/BaseBattleEngine';
import { BattleContext, BattleType, TerrainType, WeatherType } from '../engines/BattleType';
import { SeedRandom } from '../random';

/**
 * 전투 명령 타입
 */
export enum BattleCommandType {
  /** 이동 */
  MOVE = 'move',
  /** 공격 */
  ATTACK = 'attack',
  /** 매복 */
  AMBUSH = 'ambush',
  /** 화공 */
  FIRE_ATTACK = 'fire_attack',
  /** 낙석 */
  ROCK_DROP = 'rock_drop',
  /** 긴급 퇴각 */
  EMERGENCY_RETREAT = 'emergency_retreat',
  /** 돌격 */
  CHARGE = 'charge',
  /** 방어 */
  DEFEND = 'defend',
  /** 대기 */
  WAIT = 'wait',
  /** 계략 */
  STRATAGEM = 'stratagem'
}

/**
 * 명령 실행 결과
 */
export interface CommandResult {
  /** 성공 여부 */
  success: boolean;
  /** 로그 메시지 */
  logs: string[];
  /** 실패 사유 */
  failReason?: string;
  /** 추가 데이터 */
  data?: Record<string, any>;
}

/**
 * 명령 실행 컨텍스트
 */
export interface CommandContext {
  /** 전투 컨텍스트 */
  battleContext: BattleContext;
  /** 명령 실행 유닛 */
  executor: WarUnitState;
  /** 대상 유닛 (공격 등) */
  target?: WarUnitState | null;
  /** 대상 위치 (이동 등) */
  targetPosition?: { x: number; y: number };
  /** 난수 생성기 */
  rng: SeedRandom;
  /** 현재 턴 */
  turn: number;
}

/**
 * 명령 요구 조건
 */
export interface CommandRequirement {
  /** 최소 HP 비율 */
  minHpRatio?: number;
  /** 최소 사기 */
  minAtmos?: number;
  /** 최소 군량 */
  minRice?: number;
  /** 허용 병종 */
  allowedArmTypes?: number[];
  /** 허용 전투 타입 */
  allowedBattleTypes?: BattleType[];
  /** 허용 지형 */
  allowedTerrains?: TerrainType[];
  /** 금지 날씨 */
  forbiddenWeathers?: WeatherType[];
  /** 쿨다운 턴 */
  cooldownTurns?: number;
  /** 특수 스킬 필요 여부 */
  requiresSkill?: string;
}

/**
 * 전투 명령 추상 클래스
 */
export abstract class BattleCommand {
  abstract readonly type: BattleCommandType;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly requirements: CommandRequirement;

  /**
   * 명령 실행 가능 여부 확인
   */
  canExecute(ctx: CommandContext): { canExecute: boolean; reason?: string } {
    const { executor, battleContext } = ctx;
    const req = this.requirements;

    // HP 체크
    if (req.minHpRatio !== undefined) {
      const hpRatio = executor.hp / executor.maxHP;
      if (hpRatio < req.minHpRatio) {
        return { canExecute: false, reason: `HP가 부족합니다 (${Math.round(hpRatio * 100)}% < ${Math.round(req.minHpRatio * 100)}%)` };
      }
    }

    // 사기 체크
    if (req.minAtmos !== undefined && executor.atmos < req.minAtmos) {
      return { canExecute: false, reason: `사기가 부족합니다 (${executor.atmos} < ${req.minAtmos})` };
    }

    // 군량 체크
    if (req.minRice !== undefined && executor.rice < req.minRice) {
      return { canExecute: false, reason: `군량이 부족합니다` };
    }

    // 병종 체크
    if (req.allowedArmTypes && !req.allowedArmTypes.includes(executor.unit.armType)) {
      return { canExecute: false, reason: `해당 병종은 이 명령을 사용할 수 없습니다` };
    }

    // 전투 타입 체크
    if (req.allowedBattleTypes && !req.allowedBattleTypes.includes(battleContext.battleType)) {
      return { canExecute: false, reason: `현재 전투 유형에서는 사용할 수 없습니다` };
    }

    // 지형 체크
    if (req.allowedTerrains && !req.allowedTerrains.includes(battleContext.terrain)) {
      return { canExecute: false, reason: `현재 지형에서는 사용할 수 없습니다` };
    }

    // 날씨 체크
    if (req.forbiddenWeathers && req.forbiddenWeathers.includes(battleContext.weather)) {
      return { canExecute: false, reason: `현재 날씨에서는 사용할 수 없습니다` };
    }

    // 스킬 체크
    if (req.requiresSkill) {
      const hasSkill = executor.stats.specialSkills?.includes(req.requiresSkill);
      if (!hasSkill) {
        return { canExecute: false, reason: `${req.requiresSkill} 스킬이 필요합니다` };
      }
    }

    return { canExecute: true };
  }

  /**
   * 명령 실행
   */
  abstract execute(ctx: CommandContext): CommandResult;

  /**
   * 명령 취소 (가능한 경우)
   */
  cancel(_ctx: CommandContext): boolean {
    return false;
  }
}
