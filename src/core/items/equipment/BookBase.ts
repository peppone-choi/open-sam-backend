/**
 * BookBase.ts
 * 서적 아이템 기본 클래스
 * 
 * PHP 참조: 
 * - core/hwe/sammo/ActionItem/che_계략_*.php
 * - core/hwe/sammo/ActionItem/che_공성_*.php
 * - core/hwe/sammo/ActionItem/che_농성_*.php
 * - core/hwe/sammo/ActionItem/che_서적_*.php
 */

import { ItemSlot, BattleContext } from './types';
import { ItemBase, StatItemBase, ItemRarity, ItemCategory, ItemConfig, ItemEffect } from './ItemBase';

// ============================================
// 서적 타입 정의
// ============================================

export enum BookType {
  TACTICS = 'tactics',       // 계략서
  SIEGE = 'siege',           // 공성서
  DEFENSE = 'defense',       // 농성서
  INTEL = 'intel',           // 지력 서적
  POLITICS = 'politics',     // 내정서
  MILITARY = 'military',     // 병법서
  SPECIAL = 'special'        // 특수
}

export interface BookEffect {
  // 계략 관련
  tacticsSuccessBonus?: number;      // 계략 성공률 보너스
  warMagicTrialProb?: number;        // 전투 중 계략 시도 확률
  warMagicSuccessProb?: number;      // 전투 중 계략 성공 확률

  // 농성/공성 관련
  sabotageDefence?: number;          // 상대 계략 방어
  siegeDamageBonus?: number;         // 공성 대미지 보너스
  
  // 상대 약화
  opposeWarMagicTrialProb?: number;  // 상대 계략 시도 확률 감소
  opposeWarMagicSuccessProb?: number;// 상대 계략 성공 확률 감소
  opposeAvoidRatio?: number;         // 상대 회피 확률 감소
  opposeCriticalRatio?: number;      // 상대 필살 확률 감소

  // 특수
  special?: string[];
}

export interface BookConfig {
  id: string;
  rawName: string;
  name?: string;
  description?: string;
  bookType: BookType;
  intelBonus?: number;       // 지력 보너스 (일반 서적)
  rarity?: ItemRarity;
  cost: number;
  consumable?: boolean;
  buyable?: boolean;
  reqSecu?: number;
  bookEffect?: BookEffect;
}

// ============================================
// 서적 기본 클래스
// ============================================

export class BookBase extends ItemBase {
  readonly bookType: BookType;
  readonly bookEffect?: BookEffect;

  constructor(config: BookConfig) {
    const name = config.name ?? config.rawName;
    const description = config.description ?? '';

    super({
      id: config.id,
      rawName: config.rawName,
      name,
      description,
      slot: ItemSlot.BOOK,
      category: ItemCategory.BOOK,
      rarity: config.rarity ?? ItemRarity.RARE,
      cost: config.cost,
      consumable: config.consumable ?? false,
      buyable: config.buyable ?? false,
      reqSecu: config.reqSecu,
      effect: {
        statBonus: config.intelBonus ? { intel: config.intelBonus } : undefined,
        skillBonus: config.bookEffect ? {
          tactics: config.bookEffect.tacticsSuccessBonus,
          siege: config.bookEffect.siegeDamageBonus
        } : undefined
      }
    });

    this.bookType = config.bookType;
    this.bookEffect = config.bookEffect;
  }

  // 계략 성공률 보정
  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (!this.bookEffect) return value;

    if (turnType === '계략' && varType === 'success') {
      if (this.bookEffect.tacticsSuccessBonus) {
        return value + this.bookEffect.tacticsSuccessBonus;
      }
    }

    return value;
  }

  // 자신의 스탯 보정
  override onCalcStat(statName: string, value: number): number {
    if (!this.bookEffect) return super.onCalcStat(statName, value);

    switch (statName) {
      case 'warMagicTrialProb':
        return value + (this.bookEffect.warMagicTrialProb ?? 0);
      case 'warMagicSuccessProb':
        return value + (this.bookEffect.warMagicSuccessProb ?? 0);
      case 'sabotageDefence':
        return value + (this.bookEffect.sabotageDefence ?? 0);
      default:
        return super.onCalcStat(statName, value);
    }
  }

  // 상대 스탯 감소
  override onCalcOpposeStat(statName: string, value: number): number {
    if (!this.bookEffect) return value;

    switch (statName) {
      case 'warMagicTrialProb':
        return value + (this.bookEffect.opposeWarMagicTrialProb ?? 0);
      case 'warMagicSuccessProb':
        return value + (this.bookEffect.opposeWarMagicSuccessProb ?? 0);
      case 'warAvoidRatio':
        return value + (this.bookEffect.opposeAvoidRatio ?? 0);
      case 'warCriticalRatio':
        return value + (this.bookEffect.opposeCriticalRatio ?? 0);
      default:
        return value;
    }
  }

  getBookTypeLabel(): string {
    const labels: Record<BookType, string> = {
      [BookType.TACTICS]: '계략',
      [BookType.SIEGE]: '공성',
      [BookType.DEFENSE]: '농성',
      [BookType.INTEL]: '지력',
      [BookType.POLITICS]: '내정',
      [BookType.MILITARY]: '병법',
      [BookType.SPECIAL]: '특수'
    };
    return labels[this.bookType];
  }
}

// ============================================
// 스탯 서적 클래스 (지력 보너스)
// ============================================

export class IntelBook extends StatItemBase {
  constructor(config: {
    id: string;
    rawName: string;
    intelValue: number;
    cost: number;
    buyable?: boolean;
    reqSecu?: number;
    rarity?: ItemRarity;
  }) {
    super({
      id: config.id,
      rawName: config.rawName,
      statType: 'intel',
      statValue: config.intelValue,
      cost: config.cost,
      buyable: config.buyable ?? true,
      reqSecu: config.reqSecu,
      slot: ItemSlot.BOOK,
      category: ItemCategory.BOOK,
      rarity: config.rarity
    });
  }
}

// ============================================
// 소비형 서적 클래스
// ============================================

export class ConsumableBook extends BookBase {
  constructor(config: BookConfig) {
    super({
      ...config,
      consumable: true,
      buyable: config.buyable ?? true
    });
  }

  override tryConsumeNow(actionType: string, command: string): boolean {
    // 계략 사용 시 소비
    if (actionType === 'GeneralCommand' && command === '계략') {
      return true;
    }
    return false;
  }
}

// ============================================
// 계략 서적 인스턴스 생성 함수
// ============================================

// 삼략 (계략 서적 - 전설급)
export function createSamryak(): BookBase {
  return new BookBase({
    id: 'book_tactics_samryak',
    rawName: '삼략',
    name: '삼략(계략)',
    description: '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p\n[전투] 계략 시도 확률 +10%p, 계략 성공 확률 +10%p',
    bookType: BookType.TACTICS,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      tacticsSuccessBonus: 0.2,
      warMagicTrialProb: 0.1,
      warMagicSuccessProb: 0.1
    }
  });
}

// 육도 (계략 서적 - 전설급)
export function createYukdo(): BookBase {
  return new BookBase({
    id: 'book_tactics_yukdo',
    rawName: '육도',
    name: '육도(계략)',
    description: '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p\n[전투] 계략 시도 확률 +10%p, 계략 성공 확률 +10%p',
    bookType: BookType.TACTICS,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      tacticsSuccessBonus: 0.2,
      warMagicTrialProb: 0.1,
      warMagicSuccessProb: 0.1
    }
  });
}

// 이추 (계략 서적 - 소비형)
export function createIchu(): ConsumableBook {
  return new ConsumableBook({
    id: 'book_tactics_ichu',
    rawName: '이추',
    name: '이추(계략)',
    description: '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p (소비)',
    bookType: BookType.TACTICS,
    rarity: ItemRarity.UNCOMMON,
    cost: 1000,
    buyable: true,
    reqSecu: 1000,
    bookEffect: {
      tacticsSuccessBonus: 0.2
    }
  });
}

// 향낭 (계략 서적 - 소비형, 고급)
export function createHyangnang(): ConsumableBook {
  return new ConsumableBook({
    id: 'book_tactics_hyangnang',
    rawName: '향낭',
    name: '향낭(계략)',
    description: '[계략] 화계·탈취·파괴·선동 : 성공률 +50%p (소비)',
    bookType: BookType.TACTICS,
    rarity: ItemRarity.RARE,
    cost: 3000,
    buyable: true,
    reqSecu: 2000,
    bookEffect: {
      tacticsSuccessBonus: 0.5
    }
  });
}

// ============================================
// 공성 서적 인스턴스 생성 함수
// ============================================

// 묵자 (공성 서적)
export function createMukja(): BookBase {
  return new BookBase({
    id: 'book_siege_mukja',
    rawName: '묵자',
    name: '묵자(공성)',
    description: '[전투] 성벽 공격 시 대미지 +50%',
    bookType: BookType.SIEGE,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      siegeDamageBonus: 0.5,
      special: ['성벽 파괴자']
    }
  });
}

// 묵자의 전투 대미지 계산을 위한 특수 클래스
export class SiegeBook extends BookBase {
  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 상대가 성벽인 경우 공격력 증가
    if (ctx.terrain === 'city' || ctx.terrain === 'fort') {
      const bonus = this.bookEffect?.siegeDamageBonus ?? 0;
      return [1 + bonus, 1];
    }
    return [1, 1];
  }
}

// 묵자 (공성 특화 버전)
export function createMukjaSiege(): SiegeBook {
  return new SiegeBook({
    id: 'book_siege_mukja',
    rawName: '묵자',
    name: '묵자(공성)',
    description: '[전투] 성벽 공격 시 대미지 +50%',
    bookType: BookType.SIEGE,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      siegeDamageBonus: 0.5
    }
  });
}

// ============================================
// 농성 서적 인스턴스 생성 함수
// ============================================

// 위공자병법 (농성 서적)
export function createWigongjaBbyeongbeop(): BookBase {
  return new BookBase({
    id: 'book_defense_wigongja',
    rawName: '위공자병법',
    name: '위공자병법(농성)',
    description: '[계략] 장수 주둔 도시 화계·탈취·파괴·선동 : 성공률 -30%p\n[전투] 상대 계략 시도 확률 -10%p, 상대 계략 성공 확률 -10%p',
    bookType: BookType.DEFENSE,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      sabotageDefence: 0.3,
      opposeWarMagicTrialProb: -0.1,
      opposeWarMagicSuccessProb: -0.1
    }
  });
}

// 주서음부 (농성 서적)
export function createJuseoeumbu(): BookBase {
  return new BookBase({
    id: 'book_defense_juseoeumbu',
    rawName: '주서음부',
    name: '주서음부(농성)',
    description: '[계략] 장수 주둔 도시 화계·탈취·파괴·선동 : 성공률 -30%p\n[전투] 상대 계략 시도 확률 -10%p, 상대 계략 성공 확률 -10%p',
    bookType: BookType.DEFENSE,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      sabotageDefence: 0.3,
      opposeWarMagicTrialProb: -0.1,
      opposeWarMagicSuccessProb: -0.1
    }
  });
}

// 노군입산부 (간파 서적)
export function createNogunipsanbu(): BookBase {
  return new BookBase({
    id: 'book_special_nogunipsanbu',
    rawName: '노군입산부',
    name: '노군입산부(간파)',
    description: '[전투] 상대 회피 확률 -25%p, 상대 필살 확률 -10%p',
    bookType: BookType.SPECIAL,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    bookEffect: {
      opposeAvoidRatio: -0.25,
      opposeCriticalRatio: -0.1
    }
  });
}

// ============================================
// 일반 지력 서적 생성 함수
// ============================================

// 효경전 (지력 +1)
export function createHyogyeongjeon(): IntelBook {
  return new IntelBook({
    id: 'book_intel_01_hyogyeongjeon',
    rawName: '효경전',
    intelValue: 1,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 회남자 (지력 +2)
export function createHoenamja(): IntelBook {
  return new IntelBook({
    id: 'book_intel_02_hoenamja',
    rawName: '회남자',
    intelValue: 2,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 변도론 (지력 +3)
export function createByeondoron(): IntelBook {
  return new IntelBook({
    id: 'book_intel_03_byeondoron',
    rawName: '변도론',
    intelValue: 3,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 건상역주 (지력 +4)
export function createGeonSangyeokju(): IntelBook {
  return new IntelBook({
    id: 'book_intel_04_geonsangyeokju',
    rawName: '건상역주',
    intelValue: 4,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 여씨춘추 (지력 +5)
export function createYeossichunchu(): IntelBook {
  return new IntelBook({
    id: 'book_intel_05_yeossichunchu',
    rawName: '여씨춘추',
    intelValue: 5,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 사민월령 (지력 +6)
export function createSaminwolryeong(): IntelBook {
  return new IntelBook({
    id: 'book_intel_06_saminwolryeong',
    rawName: '사민월령',
    intelValue: 6,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 논어 (지력 +7)
export function createNoneyo(): IntelBook {
  return new IntelBook({
    id: 'book_intel_07_noneyo',
    rawName: '논어',
    intelValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 사마법 (지력 +7)
export function createSamabeop(): IntelBook {
  return new IntelBook({
    id: 'book_intel_07_samabeop',
    rawName: '사마법',
    intelValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 위료자 (지력 +7)
export function createWiryoja(): IntelBook {
  return new IntelBook({
    id: 'book_intel_07_wiryoja',
    rawName: '위료자',
    intelValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 한서 (지력 +7)
export function createHanseo(): IntelBook {
  return new IntelBook({
    id: 'book_intel_07_hanseo',
    rawName: '한서',
    intelValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 사기 (지력 +8)
export function createSagi(): IntelBook {
  return new IntelBook({
    id: 'book_intel_08_sagi',
    rawName: '사기',
    intelValue: 8,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 전론 (지력 +8)
export function createJeonron(): IntelBook {
  return new IntelBook({
    id: 'book_intel_08_jeonron',
    rawName: '전론',
    intelValue: 8,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 역경 (지력 +9)
export function createYeokgyeong(): IntelBook {
  return new IntelBook({
    id: 'book_intel_09_yeokgyeong',
    rawName: '역경',
    intelValue: 9,
    rarity: ItemRarity.UNCOMMON,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 장자 (지력 +9)
export function createJangja(): IntelBook {
  return new IntelBook({
    id: 'book_intel_09_jangja',
    rawName: '장자',
    intelValue: 9,
    rarity: ItemRarity.UNCOMMON,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 구국론 (지력 +10)
export function createGugukron(): IntelBook {
  return new IntelBook({
    id: 'book_intel_10_gugukron',
    rawName: '구국론',
    intelValue: 10,
    rarity: ItemRarity.RARE,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 시경 (지력 +10)
export function createSigyeong(): IntelBook {
  return new IntelBook({
    id: 'book_intel_10_sigyeong',
    rawName: '시경',
    intelValue: 10,
    rarity: ItemRarity.RARE,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 상군서 (지력 +11)
export function createSanggunseo(): IntelBook {
  return new IntelBook({
    id: 'book_intel_11_sanggunseo',
    rawName: '상군서',
    intelValue: 11,
    rarity: ItemRarity.RARE,
    cost: 200,
    buyable: false
  });
}

// 춘추전 (지력 +11)
export function createChunchujeon(): IntelBook {
  return new IntelBook({
    id: 'book_intel_11_chunchujeon',
    rawName: '춘추전',
    intelValue: 11,
    rarity: ItemRarity.RARE,
    cost: 200,
    buyable: false
  });
}

// 맹덕신서 (지력 +12)
export function createMaengdeoksinseo(): IntelBook {
  return new IntelBook({
    id: 'book_intel_12_maengdeoksinseo',
    rawName: '맹덕신서',
    intelValue: 12,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 산해경 (지력 +12)
export function createSanhaegyeong(): IntelBook {
  return new IntelBook({
    id: 'book_intel_12_sanhaegyeong',
    rawName: '산해경',
    intelValue: 12,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 관자 (지력 +13)
export function createGwanja(): IntelBook {
  return new IntelBook({
    id: 'book_intel_13_gwanja',
    rawName: '관자',
    intelValue: 13,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 병법24편 (지력 +13)
export function createByeongbeop24pyeon(): IntelBook {
  return new IntelBook({
    id: 'book_intel_13_byeongbeop24pyeon',
    rawName: '병법24편',
    intelValue: 13,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 오자병법 (지력 +14)
export function createOjabyeongbeop(): IntelBook {
  return new IntelBook({
    id: 'book_intel_14_ojabyeongbeop',
    rawName: '오자병법',
    intelValue: 14,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 한비자 (지력 +14)
export function createHanbija(): IntelBook {
  return new IntelBook({
    id: 'book_intel_14_hanbija',
    rawName: '한비자',
    intelValue: 14,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 노자 (지력 +15)
export function createNoja(): IntelBook {
  return new IntelBook({
    id: 'book_intel_15_noja',
    rawName: '노자',
    intelValue: 15,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    buyable: false
  });
}

// 손자병법 (지력 +15)
export function createSonjabyeongbeop(): IntelBook {
  return new IntelBook({
    id: 'book_intel_15_sonjabyeongbeop',
    rawName: '손자병법',
    intelValue: 15,
    rarity: ItemRarity.LEGENDARY,
    cost: 200,
    buyable: false
  });
}

// ============================================
// 모든 서적 생성 함수
// ============================================

export const AllBookCreators = {
  // 계략 서적
  samryak: createSamryak,
  yukdo: createYukdo,
  ichu: createIchu,
  hyangnang: createHyangnang,

  // 공성/농성 서적
  mukja: createMukjaSiege,
  wigongjaBbyeongbeop: createWigongjaBbyeongbeop,
  juseoeumbu: createJuseoeumbu,
  nogunipsanbu: createNogunipsanbu,

  // 일반 지력 서적
  hyogyeongjeon: createHyogyeongjeon,
  hoenamja: createHoenamja,
  byeondoron: createByeondoron,
  geonSangyeokju: createGeonSangyeokju,
  yeossichunchu: createYeossichunchu,
  saminwolryeong: createSaminwolryeong,
  noneyo: createNoneyo,
  samabeop: createSamabeop,
  wiryoja: createWiryoja,
  hanseo: createHanseo,
  sagi: createSagi,
  jeonron: createJeonron,
  yeokgyeong: createYeokgyeong,
  jangja: createJangja,
  gugukron: createGugukron,
  sigyeong: createSigyeong,
  sanggunseo: createSanggunseo,
  chunchujeon: createChunchujeon,
  maengdeoksinseo: createMaengdeoksinseo,
  sanhaegyeong: createSanhaegyeong,
  gwanja: createGwanja,
  byeongbeop24pyeon: createByeongbeop24pyeon,
  ojabyeongbeop: createOjabyeongbeop,
  hanbija: createHanbija,
  noja: createNoja,
  sonjabyeongbeop: createSonjabyeongbeop
};

