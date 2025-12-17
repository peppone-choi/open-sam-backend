/**
 * 이벤트 아이템 (비급) 인덱스
 * 전투특기 부여 아이템 시스템
 */

export * from './EventItemBase';
export * from './BattleSpecialityItems';
export * from './TacticsSpecialityItems';
export * from './UnitSpecialityItems';

// 모든 이벤트 아이템 생성자 통합
import { BattleSpecialityItemCreators } from './BattleSpecialityItems';
import { TacticsSpecialityItemCreators } from './TacticsSpecialityItems';
import { UnitSpecialityItemCreators } from './UnitSpecialityItems';

export const AllEventItemCreators = {
  ...BattleSpecialityItemCreators,
  ...TacticsSpecialityItemCreators,
  ...UnitSpecialityItemCreators
};

/**
 * 이벤트 아이템 ID → 생성자 매핑
 */
export const EventItemMap: Record<string, () => unknown> = {
  // 전투계
  'event_pilsal': BattleSpecialityItemCreators.pilsal,
  'event_gyeokno': BattleSpecialityItemCreators.gyeokno,
  'event_bangye': BattleSpecialityItemCreators.bangye,
  'event_wiap': BattleSpecialityItemCreators.wiap,
  'event_jeogyeok': BattleSpecialityItemCreators.jeogyeok,
  'event_gyeongo': BattleSpecialityItemCreators.gyeongo,
  'event_dolgyeok': BattleSpecialityItemCreators.dolgyeok,
  'event_musang': BattleSpecialityItemCreators.musang,
  
  // 계략계
  'event_hwansul': TacticsSpecialityItemCreators.hwansul,
  'event_jipjung': TacticsSpecialityItemCreators.jipjung,
  'event_sinsan': TacticsSpecialityItemCreators.sinsan,
  'event_sinjung': TacticsSpecialityItemCreators.sinjung,
  
  // 병종계
  'event_bobyeong': UnitSpecialityItemCreators.bobyeong,
  'event_gibyeong': UnitSpecialityItemCreators.gibyeong,
  'event_gungbyeong': UnitSpecialityItemCreators.gungbyeong,
  'event_gwibyeong': UnitSpecialityItemCreators.gwibyeong,
  'event_gongseong': UnitSpecialityItemCreators.gongseong,
  'event_jingbyeong': UnitSpecialityItemCreators.jingbyeong,
  'event_cheoksa': UnitSpecialityItemCreators.cheoksa,
  'event_uisul': UnitSpecialityItemCreators.uisul
};

/**
 * ID로 이벤트 아이템 생성
 */
export function createEventItem(id: string): unknown | null {
  const creator = EventItemMap[id];
  return creator ? creator() : null;
}










