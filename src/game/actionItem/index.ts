/**
 * 아이템 시스템 모듈
 * PHP 대응: sammo\ActionItem 네임스페이스
 */

// 베이스 클래스
export { BaseItem, ItemInfo } from './BaseItem';
export { BaseStatItem, ItemType, StatType, StatNick, createWeaponItem, createHorseItem, createBookItem, createSealItem, createAccessoryItem } from './BaseStatItem';

// 레지스트리
export {
  getActionItemAction,
  getAvailableActionItems,
  getActionItemIdByName,
  getBuyableActionItems,
  getActionItemsByCategory,
  getActionItemsByStat,
} from './actionItemRegistry';

// 구현체
export * from './impl';
