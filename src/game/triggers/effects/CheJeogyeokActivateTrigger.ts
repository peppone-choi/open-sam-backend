import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';
import type { RandUtil } from '../../../utils/RandUtil';
import { GameConst } from '../../../constants/GameConst';
import { JosaUtil } from '../../../utils/JosaUtil';

export class CheJeogyeokActivateTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_POST + 100);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    if (!self.hasActivatedSkill('저격')) {
      return true;
    }
    if ((selfEnv.snipingCaster ?? -1) !== this.raiseType) {
      return true;
    }
    if (selfEnv.snipingActivated) {
      return true;
    }
    selfEnv.snipingActivated = true;

    const general = self.getGeneral();
    const opponentLogger = oppose.getLogger();

    if (oppose instanceof WarUnitGeneral) {
      self.getLogger().pushGeneralActionLog('상대를 <C>저격</>했다!');
      self.getLogger().pushGeneralBattleDetailLog('상대를 <C>저격</>했다!');
      opponentLogger.pushGeneralActionLog('상대에게 <R>저격</>당했다!');
      opponentLogger.pushGeneralBattleDetailLog('상대에게 <R>저격</>당했다!');
    } else {
      self.getLogger().pushGeneralActionLog('성벽 수비대장을 <C>저격</>했다!');
      self.getLogger().pushGeneralBattleDetailLog('성벽 수비대장을 <C>저격</>했다!');
    }

    const addAtmos = selfEnv.snipingAddAtmos ?? 20;
    general.increaseVarWithLimit?.('atmos', addAtmos, 0, GameConst.maxAtmosByWar ?? 150);

    if (!oppose.hasActivatedSkill('부상무효') && oppose instanceof WarUnitGeneral) {
      const woundMin = selfEnv.snipingWoundMin ?? 10;
      const woundMax = selfEnv.snipingWoundMax ?? 40;
      const injury = rng.nextRangeInt(woundMin, woundMax);
      oppose.getGeneral().increaseVarWithLimit?.('injury', injury, undefined, 80);
    }

    this.processConsumableItem();
    return true;
  }
}
