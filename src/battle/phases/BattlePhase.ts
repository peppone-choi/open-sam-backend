/**
 * 전투 페이즈 기본 인터페이스
 */

import { WarUnitState } from '../engines/BaseBattleEngine';
import { BattlePhaseType, BattleContext } from '../engines/BattleType';
import { SeedRandom } from '../random';

export interface PhaseResult {
  /** 페이즈 종료 여부 */
  completed: boolean;
  /** 다음 페이즈로 진행 가능 여부 */
  canContinue: boolean;
  /** 페이즈 로그 */
  logs: string[];
  /** 추가 데이터 */
  data?: Record<string, any>;
}

export interface BattlePhaseContext {
  /** 전투 컨텍스트 */
  context: BattleContext;
  /** 공격자 유닛 */
  attacker: WarUnitState;
  /** 방어자 유닛 */
  defender: WarUnitState | null;
  /** 난수 생성기 */
  rng: SeedRandom;
}

export abstract class BattlePhase {
  abstract readonly type: BattlePhaseType;
  abstract readonly name: string;

  /** 페이즈 실행 */
  abstract execute(ctx: BattlePhaseContext): PhaseResult;

  /** 페이즈 진입 조건 확인 */
  canEnter(_ctx: BattlePhaseContext): boolean {
    return true;
  }

  /** 페이즈 종료 조건 확인 */
  shouldExit(_ctx: BattlePhaseContext): boolean {
    return false;
  }
}
