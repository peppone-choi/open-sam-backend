/**
 * BattleEffectItems.ts
 * 전투 효과 특수 아이템 (필살, 회피, 격노, 위압, 반계)
 * 
 * PHP 참조:
 * - che_필살_둔갑천서.php
 * - che_회피_둔갑천서.php
 * - che_회피_태평요술.php
 * - che_격노_구정신단경.php
 * - che_위압_조목삭.php
 * - che_반계_백우선.php
 * - che_반계_파초선.php
 */

import { SpecialItemBase, SpecialItemConfig, IBattleTriggerItem, IStatModifierItem, IOpposeStatModifierItem } from './SpecialItemBase';
import { ItemRarity } from '../ItemBase';
import { BattleContext } from '../types';

// ============================================
// 필살 아이템
// ============================================

/**
 * 둔갑천서(필살) - 필살 확률 +20%p
 */
export class DungapCheonseoPilsal extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_pilsal_dungapchenseo',
      rawName: '둔갑천서',
      effectName: '필살',
      info: '[전투] 필살 확률 +20%p',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'warCriticalRatio') {
      return value + 0.20;
    }
    return value;
  }
}

// ============================================
// 회피 아이템
// ============================================

/**
 * 둔갑천서(회피) - 회피 확률 +15%p
 */
export class DungapCheonseoHoepi extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hoepi_dungapcheonseo',
      rawName: '둔갑천서',
      effectName: '회피',
      info: '[전투] 회피 확률 +15%p',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'warAvoidRatio') {
      return value + 0.15;
    }
    return value;
  }
}

/**
 * 태평요술(회피) - 회피 확률 +20%p
 */
export class TaepyeongYosul extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hoepi_taepyeongyosul',
      rawName: '태평요술',
      effectName: '회피',
      info: '[전투] 회피 확률 +20%p',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'warAvoidRatio') {
      return value + 0.20;
    }
    return value;
  }
}

// ============================================
// 격노 아이템
// ============================================

/**
 * 구정신단경(격노) - 격노 발동 시 대미지 5% 추가 중첩
 */
export class GujeongSindangyeong extends SpecialItemBase implements IBattleTriggerItem {
  private activatedCount: number = 0;

  constructor() {
    super({
      id: 'special_gyeokno_gujeongsindangyeong',
      rawName: '구정신단경',
      effectName: '격노',
      info: '[전투] 상대방 필살 시 격노(필살) 발동, 회피 시도시 25% 확률로 격노 발동, 공격 시 일정 확률로 진노(1페이즈 추가), 격노마다 대미지 5% 추가 중첩',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 격노 활성화 횟수에 따른 대미지 증가
    return [1 + 0.05 * this.activatedCount, 1];
  }

  // 격노 카운트 증가 (WarUnit에서 호출)
  incrementRageCount(): void {
    this.activatedCount++;
  }

  resetRageCount(): void {
    this.activatedCount = 0;
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 트리거 시스템과 연동
    // RageAttemptTrigger, RageActivateTrigger를 반환
    return null;  // 실제 구현은 TriggerManager에서 처리
  }
}

// ============================================
// 위압 아이템
// ============================================

/**
 * 조목삭(위압) - 첫 페이즈 위압 발동
 */
export class Jomoksak extends SpecialItemBase implements IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_wiap_jomoksak',
      rawName: '조목삭',
      effectName: '위압',
      info: '[전투] 첫 페이즈 위압 발동(적 공격, 회피 불가, 사기 5 감소)',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 위압 트리거 반환
    return null;  // 실제 구현은 TriggerManager에서 처리
  }
}

// ============================================
// 반계 아이템
// ============================================

/**
 * 백우선(반계) - 상대 계략 반사
 */
export class Baekuseon extends SpecialItemBase implements IStatModifierItem, IOpposeStatModifierItem, IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_bangye_baekuseon',
      rawName: '백우선',
      effectName: '반계',
      info: '[전투] 상대의 계략 성공 확률 -10%p, 상대의 계략을 30% 확률로 되돌림, 반목 성공시 대미지 추가(+60% → +100%), 소모 군량 +10%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcOpposeStat(statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;  // 상대 계략 성공률 -10%p
    }
    return value;
  }

  override onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'killRice') {
      return value * 1.1;  // 군량 소모 +10%
    }
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.4;  // 반목 대미지 +40%
    }
    return value;
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 반계 트리거 반환 (30% 확률)
    return null;  // 실제 구현은 TriggerManager에서 처리
  }
}

/**
 * 파초선(반계) - 상대 계략 반사
 */
export class Pachoseon extends SpecialItemBase implements IStatModifierItem, IOpposeStatModifierItem, IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_bangye_pachoseon',
      rawName: '파초선',
      effectName: '반계',
      info: '[전투] 상대의 계략 성공 확률 -10%p, 상대의 계략을 30% 확률로 되돌림, 반목 성공시 대미지 추가(+60% → +100%), 소모 군량 +10%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcOpposeStat(statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }

  override onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'killRice') {
      return value * 1.1;
    }
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.4;
    }
    return value;
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    return null;
  }
}

// ============================================
// 내보내기
// ============================================

export const BattleEffectItemCreators = {
  // 필살
  dungapCheonseoPilsal: () => new DungapCheonseoPilsal(),
  
  // 회피
  dungapCheonseoHoepi: () => new DungapCheonseoHoepi(),
  taepyeongYosul: () => new TaepyeongYosul(),
  
  // 격노
  gujeongSindangyeong: () => new GujeongSindangyeong(),
  
  // 위압
  jomoksak: () => new Jomoksak(),
  
  // 반계
  baekuseon: () => new Baekuseon(),
  pachoseon: () => new Pachoseon()
};






