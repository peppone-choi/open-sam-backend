/**
 * 특수 효과 아이템 인덱스
 */

export * from './SpecialItemBase';
export * from './BattleEffectItems';
export * from './TacticsEffectItems';
export * from './SupportEffectItems';
export * from './StatBoostItems';
export * from './MiscEffectItems';
export * from './AdditionalEffectItems';

// 모든 특수 아이템 생성자 통합
import { BattleEffectItemCreators } from './BattleEffectItems';
import { TacticsEffectItemCreators } from './TacticsEffectItems';
import { SupportEffectItemCreators } from './SupportEffectItems';
import { StatBoostItemCreators } from './StatBoostItems';
import { MiscEffectItemCreators } from './MiscEffectItems';
import { AdditionalEffectItemCreators } from './AdditionalEffectItems';

export const AllSpecialItemCreators = {
  ...BattleEffectItemCreators,
  ...TacticsEffectItemCreators,
  ...SupportEffectItemCreators,
  ...StatBoostItemCreators,
  ...MiscEffectItemCreators,
  ...AdditionalEffectItemCreators
};

