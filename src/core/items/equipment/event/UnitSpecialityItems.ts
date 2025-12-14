/**
 * UnitSpecialityItems.ts
 * 병종계 특기 부여 이벤트 아이템
 * 
 * PHP 참조:
 * - event_전투특기_보병.php
 * - event_전투특기_기병.php
 * - event_전투특기_궁병.php
 * - event_전투특기_귀병.php
 * - event_전투특기_공성.php
 * - event_전투특기_징병.php
 * - event_전투특기_척사.php
 * - event_전투특기_의술.php
 */

import { 
  EventItemBase, 
  ArmType,
  IStatModifierEventItem,
  IDomesticModifierEventItem,
  IBattleTriggerEventItem
} from './EventItemBase';
import { BattleContext } from '../types';

// ============================================
// 보병 비급
// ============================================

export class EventBobyeong extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  constructor() {
    super({
      id: 'event_bobyeong',
      specialityName: '보병',
      info: '[군사] 보병 계통 징·모병비 -10%\n[전투] 공격 시 아군 피해 -10%, 수비 시 아군 피해 -20%, 보병 숙련 가산'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    // 숙련도 가산 로직은 General 클래스에서 처리
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (['징병', '모병'].includes(turnType)) {
      const armType = (aux as { armType?: number })?.armType;
      if (varType === 'cost' && armType === ArmType.FOOTMAN) {
        return value * 0.9;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    const isAttacker = (ctx as any).isAttacker ?? true;
    if (isAttacker) {
      return [1, 0.9];   // 공격 시 아군 피해 -10%
    }
    return [1, 0.8];     // 수비 시 아군 피해 -20%
  }
}

// ============================================
// 기병 비급
// ============================================

export class EventGibyeong extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  constructor() {
    super({
      id: 'event_gibyeong',
      specialityName: '기병',
      info: '[군사] 기병 계통 징·모병비 -10%\n[전투] 수비 시 대미지 +10%, 공격 시 대미지 +20%, 기병 숙련 가산'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (['징병', '모병'].includes(turnType)) {
      const armType = (aux as { armType?: number })?.armType;
      if (varType === 'cost' && armType === ArmType.CAVALRY) {
        return value * 0.9;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    const isAttacker = (ctx as any).isAttacker ?? true;
    if (isAttacker) {
      return [1.2, 1];  // 공격 시 대미지 +20%
    }
    return [1.1, 1];    // 수비 시 대미지 +10%
  }
}

// ============================================
// 궁병 비급
// ============================================

export class EventGungbyeong extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  constructor() {
    super({
      id: 'event_gungbyeong',
      specialityName: '궁병',
      info: '[군사] 궁병 계통 징·모병비 -10%\n[전투] 회피 확률 +20%p, 궁병 숙련 가산'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warAvoidRatio') {
      return value + 0.2;
    }
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (['징병', '모병'].includes(turnType)) {
      const armType = (aux as { armType?: number })?.armType;
      if (varType === 'cost' && armType === ArmType.ARCHER) {
        return value * 0.9;
      }
    }
    return value;
  }
}

// ============================================
// 귀병 비급
// ============================================

export class EventGwibyeong extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  constructor() {
    super({
      id: 'event_gwibyeong',
      specialityName: '귀병',
      info: '[군사] 귀병 계통 징·모병비 -10%\n[전투] 계략 성공 확률 +20%p, 귀병 숙련 가산'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 0.2;
    }
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (['징병', '모병'].includes(turnType)) {
      const armType = (aux as { armType?: number })?.armType;
      if (varType === 'cost' && armType === ArmType.WIZARD) {
        return value * 0.9;
      }
    }
    return value;
  }
}

// ============================================
// 공성 비급
// ============================================

export class EventGongseong extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  constructor() {
    super({
      id: 'event_gongseong',
      specialityName: '공성',
      info: '[군사] 차병 계통 징·모병비 -10%\n[전투] 성벽 공격 시 대미지 +100%, 차병 숙련 가산'
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (['징병', '모병'].includes(turnType)) {
      const armType = (aux as { armType?: number })?.armType;
      if (varType === 'cost' && armType === ArmType.SIEGE) {
        return value * 0.9;
      }
    }
    return value;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 상대가 성벽인 경우 대미지 +100%
    if (ctx.terrain === 'city' || ctx.terrain === 'fort') {
      return [2, 1];
    }
    return [1, 1];
  }
}

// ============================================
// 징병 비급
// ============================================

export class EventJingbyeong extends EventItemBase implements IStatModifierEventItem, IDomesticModifierEventItem {
  private generalLeadership: number = 0;

  constructor() {
    super({
      id: 'event_jingbyeong',
      specialityName: '징병',
      info: '[군사] 징병/모병 시 훈사 70/84 제공\n[기타] 통솔 순수 능력치 보정 +25%, 징병/모병/소집해제 시 인구 변동 없음'
    });
  }

  setGeneralLeadership(leadership: number): void {
    this.generalLeadership = leadership;
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'leadership') {
      return value + this.generalLeadership * 0.25;
    }
    return value;
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'train' || varType === 'atmos') {
        return turnType === '징병' ? 70 : 84;
      }
    }
    if (turnType === '징집인구' && varType === 'score') {
      return 0;  // 인구 변동 없음
    }
    return value;
  }
}

// ============================================
// 척사 비급
// ============================================

export class EventCheoksa extends EventItemBase {
  constructor() {
    super({
      id: 'event_cheoksa',
      specialityName: '척사',
      info: '[전투] 지역·도시 병종 상대로 대미지 +20%, 아군 피해 -20%'
    });
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 지역/도시 병종 상대 시 (이민족, 특수 병종 등)
    const opposeIsRegionalUnit = (ctx as any).opposeIsRegionalUnit ?? false;
    if (opposeIsRegionalUnit) {
      return [1.2, 0.8];
    }
    return [1, 1];
  }
}

// ============================================
// 의술 비급
// ============================================

export class EventUisul extends EventItemBase implements IBattleTriggerEventItem {
  constructor() {
    super({
      id: 'event_uisul',
      specialityName: '의술',
      info: '[군사] 매 턴마다 자신(100%)과 소속 도시 장수(적 포함 50%) 부상 회복\n[전투] 페이즈마다 40% 확률로 치료 발동(아군 피해 30% 감소, 부상 회복)'
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // che_전투치료시도, che_전투치료발동 트리거 반환
    return null;
  }

  // 턴 시작 시 도시 치료 트리거
  getPreTurnExecuteTriggerList?(general: unknown): unknown {
    // che_도시치료 트리거 반환
    return null;
  }
}

// ============================================
// 내보내기
// ============================================

export const UnitSpecialityItemCreators = {
  bobyeong: () => new EventBobyeong(),
  gibyeong: () => new EventGibyeong(),
  gungbyeong: () => new EventGungbyeong(),
  gwibyeong: () => new EventGwibyeong(),
  gongseong: () => new EventGongseong(),
  jingbyeong: () => new EventJingbyeong(),
  cheoksa: () => new EventCheoksa(),
  uisul: () => new EventUisul()
};

