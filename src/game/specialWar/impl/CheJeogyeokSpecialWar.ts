import type { WarUnit } from '../../../battle/WarUnit';
import { BaseSpecialWar } from '../BaseSpecialWar';
import { WarUnitTriggerCaller } from '../../triggers/WarUnitTriggerCaller';
import { CheJeogyeokAttemptTrigger } from '../../triggers/effects/CheJeogyeokAttemptTrigger';
import { CheJeogyeokActivateTrigger } from '../../triggers/effects/CheJeogyeokActivateTrigger';

export class CheJeogyeokSpecialWar extends BaseSpecialWar {
  constructor() {
    super('che_저격', '저격', '[전투] 새로운 상대와 전투 시 50% 확률로 저격 발동, 성공 시 사기 +20');
  }

  override getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return new WarUnitTriggerCaller(
      new CheJeogyeokAttemptTrigger(unit, 0.5, 20, 40),
      new CheJeogyeokActivateTrigger(unit)
    );
  }
}
