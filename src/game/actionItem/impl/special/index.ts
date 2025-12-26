/**
 * 특수 아이템 모듈 인덱스
 */

// 계략 아이템
export * from './strategyItems';

// 반계 아이템
export * from './counterItems';

// 의술 아이템
export * from './medicalItems';

// 저격 아이템
export * from './sniperItems';

// 사기/훈련 아이템
export * from './moraleItems';

// 모든 특수 아이템 클래스 모음
import { ALL_STRATEGY_ITEMS } from './strategyItems';
import { ALL_COUNTER_ITEMS } from './counterItems';
import { ALL_MEDICAL_ITEMS } from './medicalItems';
import { ALL_SNIPER_ITEMS } from './sniperItems';
import { ALL_MORALE_ITEMS } from './moraleItems';

export const ALL_SPECIAL_ITEM_CLASSES = [
  ...ALL_STRATEGY_ITEMS,
  ...ALL_COUNTER_ITEMS,
  ...ALL_MEDICAL_ITEMS,
  ...ALL_SNIPER_ITEMS,
  ...ALL_MORALE_ITEMS,
] as const;
