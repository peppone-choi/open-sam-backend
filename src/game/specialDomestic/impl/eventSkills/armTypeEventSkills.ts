/**
 * 병종 이벤트 특기들
 * PHP 대응: che_event_보병.php, che_event_기병.php, che_event_궁병.php, che_event_귀병.php, che_event_공성.php
 */

import { BaseSpecialDomestic } from '../../BaseSpecialDomestic';
import type { WarUnit } from '../../../../battle/WarUnit';
import { ARM_TYPE } from '../../../../const/GameUnitConst';

/**
 * 보병 숙련을 가산하는 헬퍼
 */
function getDexValue(general: any, dexKey: string): number {
  if (typeof general?.getVar === 'function') {
    return general.getVar(dexKey, 0);
  }
  return general?.[dexKey] ?? 0;
}

/** 이벤트 보병 */
export class CheEventBobyeongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_보병'; }
  getName(): string { return '보병'; }
  getInfo(): string {
    return '[군사] 보병 계통 징·모병비 -10%\n[전투] 공격 시 아군 피해 -10%, 수비 시 아군 피해 -20%,\n공격시 상대 병종에/수비시 자신 병종 숙련에 보병 숙련을 가산';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'cost' && aux?.armType === ARM_TYPE.FOOTMAN) {
        return value * 0.9;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit?.isAttackerUnit?.()) {
      return [1, 0.9]; // 공격시 아군 피해 -10%
    }
    return [1, 0.8]; // 수비시 아군 피해 -20%
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    // 숙련 가산 로직: dex로 시작하는 스탯에 대해
    if (statName.startsWith('dex')) {
      const myArmType = `dex${ARM_TYPE.FOOTMAN}`;
      const opposeArmType = aux?.opposeType?.armType != null ? `dex${aux.opposeType.armType}` : null;

      // 공격시: 상대 병종에 보병 숙련 가산
      if (aux?.isAttacker && opposeArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
      // 수비시: 자신 병종 숙련에 보병 숙련 가산
      if (!aux?.isAttacker && myArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
    }
    return value;
  }
}

/** 이벤트 기병 */
export class CheEventGibyeongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_기병'; }
  getName(): string { return '기병'; }
  getInfo(): string {
    return '[군사] 기병 계통 징·모병비 -10%\n[전투] 수비 시 대미지 +10%, 공격 시 대미지 +20%,\n공격시 상대 병종에/수비시 자신 병종 숙련에 기병 숙련을 가산';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'cost' && aux?.armType === ARM_TYPE.CAVALRY) {
        return value * 0.9;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    if (unit?.isAttackerUnit?.()) {
      return [1.2, 1]; // 공격시 대미지 +20%
    }
    return [1.1, 1]; // 수비시 대미지 +10%
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName.startsWith('dex')) {
      const myArmType = `dex${ARM_TYPE.CAVALRY}`;
      const opposeArmType = aux?.opposeType?.armType != null ? `dex${aux.opposeType.armType}` : null;

      if (aux?.isAttacker && opposeArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
      if (!aux?.isAttacker && myArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
    }
    return value;
  }
}

/** 이벤트 궁병 */
export class CheEventGungbyeongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_궁병'; }
  getName(): string { return '궁병'; }
  getInfo(): string {
    return '[군사] 궁병 계통 징·모병비 -10%\n[전투] 회피 확률 +20%p,\n공격시 상대 병종에/수비시 자신 병종 숙련에 궁병 숙련을 가산';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'cost' && aux?.armType === ARM_TYPE.ARCHER) {
        return value * 0.9;
      }
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    // 회피 확률 +20%p
    if (statName === 'warAvoidRatio') {
      return value + 0.2;
    }

    // 숙련 가산
    if (statName.startsWith('dex')) {
      const myArmType = `dex${ARM_TYPE.ARCHER}`;
      const opposeArmType = aux?.opposeType?.armType != null ? `dex${aux.opposeType.armType}` : null;

      if (aux?.isAttacker && opposeArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
      if (!aux?.isAttacker && myArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
    }
    return value;
  }
}

/** 이벤트 귀병 */
export class CheEventGwibyeongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_귀병'; }
  getName(): string { return '귀병'; }
  getInfo(): string {
    return '[군사] 귀병 계통 징·모병비 -10%\n[전투] 계략 성공 확률 +20%p,\n공격시 상대 병종에/수비시 자신 병종 숙련에 귀병 숙련을 가산';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'cost' && aux?.armType === ARM_TYPE.WIZARD) {
        return value * 0.9;
      }
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    // 계략 성공 확률 +20%p
    if (statName === 'warMagicSuccessProb') {
      return value + 0.2;
    }

    // 숙련 가산
    if (statName.startsWith('dex')) {
      const myArmType = `dex${ARM_TYPE.WIZARD}`;
      const opposeArmType = aux?.opposeType?.armType != null ? `dex${aux.opposeType.armType}` : null;

      if (aux?.isAttacker && opposeArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
      if (!aux?.isAttacker && myArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
    }
    return value;
  }
}

/** 이벤트 공성 */
export class CheEventGongseongSpecialDomestic extends BaseSpecialDomestic {
  get id(): string { return 'che_event_공성'; }
  getName(): string { return '공성'; }
  getInfo(): string {
    return '[군사] 차병 계통 징·모병비 -10%\n[전투] 성벽 공격 시 대미지 +100%,\n공격시 상대 병종에/수비시 자신 병종 숙련에 차병 숙련을 가산';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'cost' && aux?.armType === ARM_TYPE.SIEGE) {
        return value * 0.9;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(unit: WarUnit): [number, number] {
    // 성벽 공격시 대미지 +100%
    const oppose = unit?.getOppose?.();
    // WarUnitCity 타입인지 확인 (성벽) - constructor.name 또는 armType으로 판별
    if (oppose?.constructor?.name === 'WarUnitCity' || oppose?.getCrewType?.()?.armType === ARM_TYPE.CASTLE) {
      return [2, 1]; // 대미지 +100%
    }
    return [1, 1];
  }

  override onCalcStat(_general: any, statName: string, value: number, aux?: any): number {
    if (statName.startsWith('dex')) {
      const myArmType = `dex${ARM_TYPE.SIEGE}`;
      const opposeArmType = aux?.opposeType?.armType != null ? `dex${aux.opposeType.armType}` : null;

      if (aux?.isAttacker && opposeArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
      if (!aux?.isAttacker && myArmType === statName) {
        return value + getDexValue(_general, myArmType);
      }
    }
    return value;
  }
}
