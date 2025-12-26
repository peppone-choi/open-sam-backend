/**
 * 전투 페이즈 모듈 export
 */

export { BattlePhase, PhaseResult, BattlePhaseContext } from './BattlePhase';
export { ApproachPhase } from './ApproachPhase';
export { CombatPhase } from './CombatPhase';
export { RetreatPhase } from './RetreatPhase';
export { ResultPhase, BattleResultData, UnitResultStats, BattleRewards } from './ResultPhase';

// 페이즈 순서대로 배열
import { ApproachPhase } from './ApproachPhase';
import { CombatPhase } from './CombatPhase';
import { RetreatPhase } from './RetreatPhase';
import { ResultPhase } from './ResultPhase';

export const createBattlePhases = () => [
  new ApproachPhase(),
  new CombatPhase(),
  new RetreatPhase(),
  new ResultPhase()
];
