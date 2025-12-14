/**
 * BattleSpecialityItems.ts
 * 전투계 특기 부여 이벤트 아이템
 * 
 * PHP 참조:
 * - event_전투특기_필살.php
 * - event_전투특기_격노.php
 * - event_전투특기_반계.php
 * - event_전투특기_위압.php
 * - event_전투특기_저격.php
 * - event_전투특기_견고.php
 * - event_전투특기_돌격.php
 * - event_전투특기_무쌍.php
 */

import { 
  EventItemBase, 
  IStatModifierEventItem, 
  IOpposeStatModifierEventItem,
  IBattleTriggerEventItem
} from './EventItemBase';
import { BattleContext } from '../types';

// ============================================
// 필살 비급
// ============================================

export class EventPilsal extends EventItemBase implements IStatModifierEventItem, IBattleTriggerEventItem {
  constructor() {
    super({
      id: 'event_pilsal',
      specialityName: '필살',
      info: '[전투] 필살 확률 +30%p, 필살 발동시 대상 회피 불가, 필살 계수 향상'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warCriticalRatio') {
      return value + 0.3;
    }
    if (statName === 'criticalDamageRange') {
      const [rangeMin, rangeMax] = value as unknown as [number, number];
      return [(rangeMin + rangeMax) / 2, rangeMax] as unknown as number;
    }
    return value;
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_필살강화_회피불가 트리거 반환
    return null;
  }
}

// ============================================
// 격노 비급
// ============================================

export class EventGyeokno extends EventItemBase implements IBattleTriggerEventItem {
  private activatedCount: number = 0;

  constructor() {
    super({
      id: 'event_gyeokno',
      specialityName: '격노',
      info: '[전투] 상대방 필살 시 격노(필살) 발동, 회피 시도시 25% 확률로 격노 발동, 공격 시 일정 확률로 진노(1페이즈 추가), 격노마다 대미지 20% 추가 중첩'
    });
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 격노 활성화 횟수에 따른 대미지 증가 (20% per stack)
    return [1 + 0.2 * this.activatedCount, 1];
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_격노시도, che_격노발동 트리거 반환
    return null;
  }

  incrementRageCount(): void {
    this.activatedCount++;
  }

  resetRageCount(): void {
    this.activatedCount = 0;
  }
}

// ============================================
// 반계 비급
// ============================================

export class EventBangye extends EventItemBase implements IStatModifierEventItem, IOpposeStatModifierEventItem, IBattleTriggerEventItem {
  constructor() {
    super({
      id: 'event_bangye',
      specialityName: '반계',
      info: '[전투] 상대의 계략 성공 확률 -10%p, 상대의 계략을 40% 확률로 되돌림, 반목 성공시 대미지 추가(+60% → +150%)'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicSuccessDamage' && aux === '반목') {
      return value + 0.9;  // 150% - 60% = 90%p 추가
    }
    return value;
  }

  onCalcOpposeStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_반계시도, che_반계발동 트리거 반환 (40% 확률)
    return null;
  }
}

// ============================================
// 위압 비급
// ============================================

export class EventWiap extends EventItemBase implements IBattleTriggerEventItem {
  constructor() {
    super({
      id: 'event_wiap',
      specialityName: '위압',
      info: '[전투] 첫 페이즈 위압 발동(적 공격, 회피 불가, 사기 5 감소)'
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_위압시도, che_위압발동 트리거 반환
    return null;
  }
}

// ============================================
// 저격 비급
// ============================================

export class EventJeogyeok extends EventItemBase implements IBattleTriggerEventItem {
  constructor() {
    super({
      id: 'event_jeogyeok',
      specialityName: '저격',
      info: '[전투] 새로운 상대와 전투 시 50% 확률로 저격 발동, 성공 시 사기+20'
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_저격시도, che_저격발동 트리거 반환 (50% 확률, 사기+20, 대미지 40)
    return null;
  }
}

// ============================================
// 견고 비급
// ============================================

export class EventGyeonGo extends EventItemBase implements IOpposeStatModifierEventItem, IBattleTriggerEventItem {
  constructor() {
    super({
      id: 'event_gyeongo',
      specialityName: '견고',
      info: '[전투] 상대 필살 확률 -20%p, 상대 계략 시도시 성공 확률 -10%p, 부상 없음, 아군 피해 -10%'
    });
  }

  onCalcOpposeStat(statName: string, value: number, aux?: unknown): number {
    const debuffs: Record<string, number> = {
      'warMagicSuccessProb': 0.1,
      'warCriticalRatio': 0.20
    };
    return value - (debuffs[statName] ?? 0);
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    return [1, 0.9];  // 아군 피해 -10%
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_부상무효 트리거 반환
    return null;
  }

  getBattleInitSkillTriggerList(unit: unknown): unknown {
    // che_부상무효 트리거 반환 (초기화 시)
    return null;
  }
}

// ============================================
// 돌격 비급
// ============================================

export class EventDolgyeok extends EventItemBase implements IStatModifierEventItem, IBattleTriggerEventItem {
  private isAttacker: boolean = false;

  constructor() {
    super({
      id: 'event_dolgyeok',
      specialityName: '돌격',
      info: '[전투] 공격 시 대등/유리한 병종에게는 퇴각 전까지 전투, 공격 시 페이즈 + 2, 공격 시 대미지 +5%'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'initWarPhase') {
      return value + 2;
    }
    return value;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 공격 시 대미지 +5% (attacker 체크)
    const isAttacker = (ctx as any).isAttacker ?? true;
    if (isAttacker) {
      return [1.05, 1];
    }
    return [1, 1];
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_돌격지속 트리거 반환
    return null;
  }
}

// ============================================
// 무쌍 비급
// ============================================

export class EventMusang extends EventItemBase implements IStatModifierEventItem {
  private killCount: number = 0;

  constructor() {
    super({
      id: 'event_musang',
      specialityName: '무쌍',
      info: '[전투] 대미지 +5%, 피해 -2%, 공격 시 필살 확률 +10%p, 승리 수의 로그 비례로 대미지 상승/피해 감소'
    });
  }

  setKillCount(count: number): void {
    this.killCount = count;
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warCriticalRatio') {
      const isAttacker = (aux as { isAttacker?: boolean })?.isAttacker ?? false;
      if (isAttacker) {
        return value + 0.1;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    let attackMultiplier = 1.05;
    let defenceMultiplier = 0.98;
    
    // 승리 수에 따른 보너스 (log2 기반)
    const logBonus = Math.log2(Math.max(1, this.killCount / 5));
    attackMultiplier += logBonus / 20;   // 10회 → +5%, 40회 → +15%
    defenceMultiplier -= logBonus / 50;  // 10회 → -2%, 40회 → -6%
    
    return [attackMultiplier, defenceMultiplier];
  }
}

// ============================================
// 내보내기
// ============================================

export const BattleSpecialityItemCreators = {
  pilsal: () => new EventPilsal(),
  gyeokno: () => new EventGyeokno(),
  bangye: () => new EventBangye(),
  wiap: () => new EventWiap(),
  jeogyeok: () => new EventJeogyeok(),
  gyeongo: () => new EventGyeonGo(),
  dolgyeok: () => new EventDolgyeok(),
  musang: () => new EventMusang()
};

