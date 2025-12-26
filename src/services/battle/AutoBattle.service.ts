import { MUDBattleEngine } from '../../battle/MUDBattleEngine';
import type { BattleConfig, BattleSimulationResult } from '../../battle/types';

export class AutoBattleService {
  static simulate(config: BattleConfig): BattleSimulationResult {
    const engine = new MUDBattleEngine(config);
    return engine.simulate();
  }
}
