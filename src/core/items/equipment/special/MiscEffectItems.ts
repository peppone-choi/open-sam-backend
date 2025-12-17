/**
 * MiscEffectItems.ts
 * 기타 특수 효과 아이템 (치료, 약탈, 전략, 진압, 조달, 척사, 불굴, 부적)
 * 
 * PHP 참조:
 * - che_치료_*.php
 * - che_약탈_옥벽.php
 * - che_전략_평만지장도.php
 * - che_진압_박혁론.php
 * - che_조달_주판.php
 * - che_척사_오악진형도.php
 * - che_불굴_상편.php
 * - che_부적_태현청생부.php
 * - che_보물_도기.php
 * - che_행동_서촉지형도.php
 * - che_저지_삼황내문.php
 * - che_징병_낙주.php
 */

import { SpecialItemBase, IStatModifierItem, IOpposeStatModifierItem } from './SpecialItemBase';
import { ItemRarity } from '../ItemBase';

// ============================================
// 치료 아이템
// ============================================

/**
 * 환약(치료) - 부상 회복
 */
export class HwanYak extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_chiryo_hwanyak',
      rawName: '환약',
      effectName: '치료',
      info: '[군사] 사용 시 부상 회복(10~30)',
      cost: 1000,
      buyable: true,
      reqSecu: 1000,
      rarity: ItemRarity.COMMON
    });
  }
}

/**
 * 도소연명(치료) - 부상 회복
 */
export class DosoYeonmyeong extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_chiryo_dosoyeonmyeong',
      rawName: '도소연명',
      effectName: '치료',
      info: '[군사] 매 턴마다 자신 부상 회복(100%)',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }
}

/**
 * 무후행군(치료) - 소속 도시 아군 장수 부상 회복
 */
export class MuhuHaenggun extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_chiryo_muhuhaenggun',
      rawName: '무후행군',
      effectName: '치료',
      info: '[군사] 매 턴마다 소속 도시 아군 장수 부상 회복(20%)',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }
}

/**
 * 오석산(치료) - 전투 중 부상 면역
 */
export class OseokSan extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_chiryo_oseoksan',
      rawName: '오석산',
      effectName: '치료',
      info: '[전투] 전투 중 부상 확률 -50%',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'injuryProb') {
      return value * 0.5;
    }
    return value;
  }
}

/**
 * 정력견혈(치료) - 부상 회복
 */
export class JeongryeokGyeonhyeol extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_chiryo_jeongryeokgyeonhyeol',
      rawName: '정력견혈',
      effectName: '치료',
      info: '[군사] 사용 시 부상 완전 회복',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }
}

/**
 * 칠엽청점(치료) - 부상 회복
 */
export class ChilyeopCheongjeom extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_chiryo_chilyeopcheongjeom',
      rawName: '칠엽청점',
      effectName: '치료',
      info: '[군사] 매 턴마다 자신 부상 회복(50%)',
      cost: 200,
      rarity: ItemRarity.UNCOMMON
    });
  }
}

// ============================================
// 약탈 아이템
// ============================================

/**
 * 옥벽(약탈) - 약탈량 증가
 */
export class OkByeok extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_yaktal_okbyeok',
      rawName: '옥벽',
      effectName: '약탈',
      info: '[군사] 약탈량 +30%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'lootAmount') {
      return value * 1.3;
    }
    return value;
  }
}

// ============================================
// 전략 아이템
// ============================================

/**
 * 평만지장도(전략) - 이민족 관련 효과
 */
export class PyeongmanJijangdo extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_jeonryak_pyeongmanjijangdo',
      rawName: '평만지장도',
      effectName: '전략',
      info: '[전투] 이민족 병종에 대한 피해 +20%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }
}

// ============================================
// 진압 아이템
// ============================================

/**
 * 박혁론(진압) - 치안 향상 효율 증가
 */
export class BakHyeokRon extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_jinap_bakhyeokron',
      rawName: '박혁론',
      effectName: '진압',
      info: '[내정] 치안 향상 효율 +50%',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (turnType === '치안' && varType === 'score') {
      return value * 1.5;
    }
    return value;
  }
}

// ============================================
// 조달 아이템
// ============================================

/**
 * 주판(조달) - 물자 조달 효율 증가
 */
export class JuPan extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_jodal_jupan',
      rawName: '주판',
      effectName: '조달',
      info: '[내정] 물자 조달 효율 +30%',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (turnType === '조달' && varType === 'score') {
      return value * 1.3;
    }
    return value;
  }
}

// ============================================
// 척사 아이템
// ============================================

/**
 * 오악진형도(척사) - 계략 방어
 */
export class OakJinhyeongdo extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_cheoksa_oakjinhyeongdo',
      rawName: '오악진형도',
      effectName: '척사',
      info: '[전투] 상대 계략 성공 확률 -20%p',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcOpposeStat(statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value - 0.2;
    }
    return value;
  }
}

// ============================================
// 불굴 아이템
// ============================================

/**
 * 상편(불굴) - 사기 하락 방지
 */
export class SangPyeon extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_bulgul_sangpyeon',
      rawName: '상편',
      effectName: '불굴',
      info: '[전투] 패배 시 사기 하락 -30%',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'moraleLossReduction') {
      return value + 0.3;
    }
    return value;
  }
}

// ============================================
// 부적 아이템
// ============================================

/**
 * 태현청생부(부적) - 사망 방지
 */
export class TaehyeonCheongSaengbu extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_bujeok_taehyeoncheongengbu',
      rawName: '태현청생부',
      effectName: '부적',
      info: '[전투] 전투 중 사망 시 50% 확률로 생존, 1회 발동 후 소멸',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'deathImmunity') {
      return 0.5;  // 50% 사망 면역
    }
    return value;
  }
}

// ============================================
// 보물 아이템
// ============================================

/**
 * 도기(보물) - 모든 스탯 +1
 */
export class DoGi extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_bomul_dogi',
      rawName: '도기',
      effectName: '보물',
      info: '[능력치] 무력/지력/통솔 +1',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (['strength', 'intel', 'leadership'].includes(statName)) {
      return value + 1;
    }
    return value;
  }
}

// ============================================
// 행동 아이템
// ============================================

/**
 * 서촉지형도(행동) - 이동 소모 감소
 */
export class SeochokJihyeongdo extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_haengdong_seochokjihyeongdo',
      rawName: '서촉지형도',
      effectName: '행동',
      info: '[군사] 이동 소모 -1 (최소 1)',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'moveCost') {
      return Math.max(1, value - 1);
    }
    return value;
  }
}

// ============================================
// 저지 아이템
// ============================================

/**
 * 삼황내문(저지) - 적 진입 방해
 */
export class SamhwangNaemun extends SpecialItemBase implements IOpposeStatModifierItem {
  constructor() {
    super({
      id: 'special_jeoji_samhwangnaemun',
      rawName: '삼황내문',
      effectName: '저지',
      info: '[전투] 적 사기 하락 +20%',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcOpposeStat(statName: string, value: number): number {
    if (statName === 'moraleLoss') {
      return value * 1.2;
    }
    return value;
  }
}

// ============================================
// 징병 아이템
// ============================================

/**
 * 낙주(징병) - 징병 효율 증가
 */
export class NakJu extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_jingbyeong_nakju',
      rawName: '낙주',
      effectName: '징병',
      info: '[군사] 징병/모병 효율 +20%',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (['징병', '모병'].includes(turnType) && varType === 'score') {
      return value * 1.2;
    }
    return value;
  }
}

// ============================================
// 내보내기
// ============================================

export const MiscEffectItemCreators = {
  // 치료
  hwanYak: () => new HwanYak(),
  dosoYeonmyeong: () => new DosoYeonmyeong(),
  muhuHaenggun: () => new MuhuHaenggun(),
  oseokSan: () => new OseokSan(),
  jeongryeokGyeonhyeol: () => new JeongryeokGyeonhyeol(),
  chilyeopCheongjeom: () => new ChilyeopCheongjeom(),
  
  // 약탈
  okByeok: () => new OkByeok(),
  
  // 전략
  pyeongmanJijangdo: () => new PyeongmanJijangdo(),
  
  // 진압
  bakHyeokRon: () => new BakHyeokRon(),
  
  // 조달
  juPan: () => new JuPan(),
  
  // 척사
  oakJinhyeongdo: () => new OakJinhyeongdo(),
  
  // 불굴
  sangPyeon: () => new SangPyeon(),
  
  // 부적
  taehyeonCheongSaengbu: () => new TaehyeonCheongSaengbu(),
  
  // 보물
  doGi: () => new DoGi(),
  
  // 행동
  seochokJihyeongdo: () => new SeochokJihyeongdo(),
  
  // 저지
  samhwangNaemun: () => new SamhwangNaemun(),
  
  // 징병
  nakJu: () => new NakJu()
};










