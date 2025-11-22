import { AutoBattleEngine } from '../../battle/AutoBattleEngine';
import type { BattleConfig, BattleSimulationResult } from '../../battle/types';

export class AutoBattleService {
  static simulate(config: BattleConfig): BattleSimulationResult {
    const engine = new AutoBattleEngine(config);
    return engine.simulate();
  }
}
