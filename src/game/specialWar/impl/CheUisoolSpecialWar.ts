import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { CheJeontuChiryoAttemptTrigger } from '../../triggers/effects/CheJeontuChiryoAttemptTrigger';
import { CheJeontuChiryoActivateTrigger } from '../../triggers/effects/CheJeontuChiryoActivateTrigger';

export class CheUisoolSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_의술', '의술', '[군사] 도시/자신 치료 효과 / [전투] 페이즈마다 치료 발동');
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheJeontuChiryoAttemptTrigger(unit),
      new CheJeontuChiryoActivateTrigger(unit)
    );
  }
}
