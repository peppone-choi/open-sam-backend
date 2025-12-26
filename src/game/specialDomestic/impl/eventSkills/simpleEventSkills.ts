/**
 * 단순 이벤트 특기들 (전투 특기 래핑)
 * PHP 대응: che_event_*.php
 */

import { BaseSpecialDomestic } from '../../BaseSpecialDomestic';
import type { WarUnit } from '../../../../battle/WarUnit';
import { ARM_TYPE } from '../../../../const/GameUnitConst';

/** 이벤트 위압 */
export class CheEventWiapSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_위압'; }
  getName(): string { return '위압'; }
  getInfo(): string { return '[전투] 상대 사기 감소, 자신 사기 증가'; }

  override onCalcOpposeStat(_general: any, statName: string, value: number): number {
    if (statName === 'warStartAtmos') return value - 5;
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warStartAtmos') return value + 3;
    return value;
  }
}

/** 이벤트 돌격 */
export class CheEventDolgyeokSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_돌격'; }
  getName(): string { return '돌격'; }
  getInfo(): string { return '[전투] 기병 돌격 강화'; }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit?.getCrewType?.()?.armType === ARM_TYPE.CAVALRY) {
      return [1.15, 1];
    }
    return [1, 1];
  }
}

/** 이벤트 견고 */
export class CheEventGyeongoSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_견고'; }
  getName(): string { return '견고'; }
  getInfo(): string { return '[전투] 수비 시 피해 감소'; }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (!unit?.isAttackerUnit?.()) {
      return [1, 0.85];
    }
    return [1, 0.95];
  }
}

/** 이벤트 신중 */
export class CheEventSinjungSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_신중'; }
  getName(): string { return '신중'; }
  getInfo(): string { return '[전투] 계략 성공 확률 100%'; }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') return value + 1;
    return value;
  }
}

/** 이벤트 신산 */
export class CheEventSinsanSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_신산'; }
  getName(): string { return '신산'; }
  getInfo(): string { return '[전투] 계략 대미지 증가'; }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessDamage') return value * 1.5;
    return value;
  }
}

/** 이벤트 환술 */
export class CheEventHwansulSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_환술'; }
  getName(): string { return '환술'; }
  getInfo(): string { return '[전투] 계략 성공 +10%p, 대미지 +30%'; }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') return value + 0.1;
    if (statName === 'warMagicSuccessDamage') return value * 1.3;
    return value;
  }
}

/** 이벤트 척사 */
export class CheEventChuksaSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_척사'; }
  getName(): string { return '척사'; }
  getInfo(): string { return '[전투] 상대 계략 성공률 -20%p'; }

  override onCalcOpposeStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') return value - 0.2;
    return value;
  }
}

/** 이벤트 집중 */
export class CheEventJipjungSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_집중'; }
  getName(): string { return '집중'; }
  getInfo(): string { return '[전투] 계략 대미지 +50%'; }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warMagicSuccessDamage') return value * 1.5;
    return value;
  }
}

/** 이벤트 저격 */
export class CheEventJeogyeokSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_저격'; }
  getName(): string { return '저격'; }
  getInfo(): string { return '[전투] 저격 성공 확률 증가'; }

  override onCalcStat(_general: any, statName: string, value: number): number {
    if (statName === 'warSniperSuccessProb') return value + 0.15;
    return value;
  }
}

/** 이벤트 의술 */
export class CheEventUisulSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_의술'; }
  getName(): string { return '의술'; }
  getInfo(): string { return '[군사/전투] 부상 회복, 전투 중 치료'; }

  // 전투 치료 로직은 트리거로 처리
}

/** 이벤트 징병 */
export class CheEventJingbyeongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_징병'; }
  getName(): string { return '징병'; }
  getInfo(): string { return '[군사] 징병 효율 증가'; }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'score') return value * 1.2;
      if (varType === 'cost') return value * 0.8;
    }
    return value;
  }
}
