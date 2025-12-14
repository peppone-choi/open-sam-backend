/**
 * TacticsSpecialityItems.ts
 * 계략계 특기 부여 이벤트 아이템
 * 
 * PHP 참조:
 * - event_전투특기_환술.php
 * - event_전투특기_집중.php
 * - event_전투특기_신산.php
 * - event_전투특기_신중.php
 */

import { 
  EventItemBase, 
  IStatModifierEventItem,
  IDomesticModifierEventItem
} from './EventItemBase';

// ============================================
// 환술 비급
// ============================================

export class EventHwansul extends EventItemBase implements IStatModifierEventItem {
  constructor() {
    super({
      id: 'event_hwansul',
      specialityName: '환술',
      info: '[전투] 계략 성공 확률 +10%p, 계략 성공 시 대미지 +30%'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessDamage') {
      return value * 1.3;
    }
    return value;
  }
}

// ============================================
// 집중 비급
// ============================================

export class EventJipjung extends EventItemBase implements IStatModifierEventItem {
  constructor() {
    super({
      id: 'event_jipjung',
      specialityName: '집중',
      info: '[전투] 계략 성공 시 대미지 +50%'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicSuccessDamage') {
      return value * 1.5;
    }
    return value;
  }
}

// ============================================
// 신산 비급
// ============================================

export class EventSinsan extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  constructor() {
    super({
      id: 'event_sinsan',
      specialityName: '신산',
      info: '[계략] 화계·탈취·파괴·선동 : 성공률 +10%p\n[전투] 계략 시도 확률 +20%p, 계략 성공 확률 +20%p'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicTrialProb') {
      return value + 0.2;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.2;
    }
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.1;
    }
    return value;
  }
}

// ============================================
// 신중 비급
// ============================================

export class EventSinjung extends EventItemBase implements IStatModifierEventItem {
  constructor() {
    super({
      id: 'event_sinjung',
      specialityName: '신중',
      info: '[전투] 계략 성공 확률 100%'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 1;  // 100% 추가
    }
    return value;
  }
}

// ============================================
// 내보내기
// ============================================

export const TacticsSpecialityItemCreators = {
  hwansul: () => new EventHwansul(),
  jipjung: () => new EventJipjung(),
  sinsan: () => new EventSinsan(),
  sinjung: () => new EventSinjung()
};




