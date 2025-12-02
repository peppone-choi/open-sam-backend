/**
 * CheGyeryakAttemptTrigger - 계략 시도 트리거
 * PHP: core/hwe/sammo/WarUnitTrigger/che_계략시도.php
 * 
 * 귀병 계열 병종의 계략을 시도합니다.
 * 지력과 병종의 magicCoef에 따라 발동 확률이 결정됩니다.
 */

import { BaseWarUnitTrigger } from '../BaseWarUnitTrigger';
import { ObjectTrigger } from '../ObjectTrigger';
import type { WarUnit } from '../../../battle/WarUnit';
import type { RandUtil } from '../../../utils/RandUtil';
import { WarUnitGeneral } from '../../../battle/WarUnitGeneral';
import { WarUnitCity } from '../../../battle/WarUnitCity';

// 계략 테이블: [성공 데미지 배수, 실패 데미지 배수]
const TABLE_TO_GENERAL: Record<string, [number, number]> = {
  '위보': [1.2, 1.1],
  '매복': [1.4, 1.2],
  '반목': [1.6, 1.3],
  '화계': [1.8, 1.4],
  '혼란': [2.0, 1.5]
};

const TABLE_TO_CITY: Record<string, [number, number]> = {
  '급습': [1.2, 1.1],
  '위보': [1.4, 1.2],
  '혼란': [1.6, 1.3]
};

export class CheGyeryakAttemptTrigger extends BaseWarUnitTrigger {
  constructor(unit: WarUnit) {
    // PHP: PRIORITY_PRE + 300 = 20300
    super(unit, BaseWarUnitTrigger.TYPE_NONE, ObjectTrigger.PRIORITY_PRE + 300);
  }

  protected actionWar(
    self: WarUnit,
    oppose: WarUnit,
    selfEnv: Record<string, any>,
    _opposeEnv: Record<string, any>,
    rng: RandUtil
  ): boolean {
    // PHP: assert($self instanceof WarUnitGeneral, 'General만 발동 가능')
    if (!(self instanceof WarUnitGeneral)) {
      return true;
    }

    const general = self.getGeneral();
    const crewType = self.getCrewType();

    // PHP: if($self->hasActivatedSkill('계략불가'))
    if (self.hasActivatedSkill('계략불가')) {
      return true;
    }

    // 계략 시도 확률 계산
    // PHP: $magicTrialProb = $general->getIntel(true, true, true, false) / 100
    const intel = typeof general.getIntel === 'function'
      ? general.getIntel(true, true, true, false)
      : general.data?.intel ?? 50;
    
    let magicTrialProb = intel / 100;
    
    // PHP: $magicTrialProb *= $crewType->magicCoef
    const magicCoef = crewType?.magicCoef ?? 0;
    magicTrialProb *= magicCoef;

    // onCalcStat 보정
    if (typeof general.onCalcStat === 'function') {
      magicTrialProb = general.onCalcStat(general, 'warMagicTrialProb', magicTrialProb);
    }
    
    // onCalcOpposeStat 보정
    const opposeGeneral = oppose.getGeneral?.();
    if (opposeGeneral && typeof opposeGeneral.onCalcOpposeStat === 'function') {
      magicTrialProb = opposeGeneral.onCalcOpposeStat(general, 'warMagicTrialProb', magicTrialProb);
    }

    if (magicTrialProb <= 0) {
      return true;
    }

    // 첫 페이즈 + 지력 특화 장수 보너스
    // PHP: $rawIntel = $general->getIntel(false, false, false, false)
    const rawIntel = typeof general.getIntel === 'function'
      ? general.getIntel(false, false, false, false)
      : general.data?.intel ?? 50;
    const rawLeadership = typeof general.getLeadership === 'function'
      ? general.getLeadership(false, false, false, false)
      : general.data?.leadership ?? 50;
    const rawStrength = typeof general.getStrength === 'function'
      ? general.getStrength(false, false, false, false)
      : general.data?.strength ?? 50;
    
    const allStat = rawLeadership + rawStrength + rawIntel;

    // PHP: if($self->getPhase() == 0 && $rawIntel * 3 >= $allStat)
    if (self.getPhase() === 0 && rawIntel * 3 >= allStat) {
      magicTrialProb *= 3;
    }

    // 시도 확률 판정
    // PHP: if(!$self->rng->nextBool($magicTrialProb))
    if (!rng.nextBool(magicTrialProb)) {
      return true;
    }

    // 성공 확률 계산
    // PHP: $magicSuccessProb = 0.7
    let magicSuccessProb = 0.7;
    
    if (typeof general.onCalcStat === 'function') {
      magicSuccessProb = general.onCalcStat(general, 'warMagicSuccessProb', magicSuccessProb);
    }
    if (opposeGeneral && typeof opposeGeneral.onCalcOpposeStat === 'function') {
      magicSuccessProb = opposeGeneral.onCalcOpposeStat(general, 'warMagicSuccessProb', magicSuccessProb);
    }

    // 계략 종류 선택
    let magic: string;
    let successDamage: number;
    let failDamage: number;

    if (oppose instanceof WarUnitCity) {
      const magicKeys = Object.keys(TABLE_TO_CITY);
      magic = rng.choice(magicKeys);
      [successDamage, failDamage] = TABLE_TO_CITY[magic];
    } else {
      const magicKeys = Object.keys(TABLE_TO_GENERAL);
      magic = rng.choice(magicKeys);
      [successDamage, failDamage] = TABLE_TO_GENERAL[magic];
    }

    // 성공 데미지 보정
    if (typeof general.onCalcStat === 'function') {
      successDamage = general.onCalcStat(general, 'warMagicSuccessDamage', successDamage, magic);
    }
    if (opposeGeneral && typeof opposeGeneral.onCalcOpposeStat === 'function') {
      successDamage = opposeGeneral.onCalcOpposeStat(general, 'warMagicSuccessDamage', successDamage, magic);
    }

    // PHP: $self->activateSkill('계략시도', $magic)
    self.activateSkill('계략시도', magic);

    // 성공/실패 판정
    if (rng.nextBool(magicSuccessProb)) {
      // PHP: $self->activateSkill('계략')
      self.activateSkill('계략');
      selfEnv['magic'] = [magic, successDamage];
    } else {
      // PHP: $self->activateSkill('계략실패')
      self.activateSkill('계략실패');
      selfEnv['magic'] = [magic, failDamage];
    }

    return true;
  }
}




