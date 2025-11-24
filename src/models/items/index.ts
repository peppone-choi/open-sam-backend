/**
 * Session 5 Item System Index
 *
 * Small, explicit registry over a handful of representative
 * PHP‑style items used in tests and parity checks.
 */

// Base types
export { BaseItem, ItemConsumeResult } from '../item.model';
export { ActionItem } from './ActionItem';

// Concrete items (8 representatives)
export { che_치료_환약, che_치료_정력견혈 } from './HealItem';
export { che_계략_삼략, che_계략_육도 } from './StrategyItem';
export { che_능력치_무력_두강주, che_능력치_지력_이강주 } from './BuffItem';
export { che_사기_탁주, che_농성_위공자병법 } from './BattleItem';

// Simple constructor registry keyed by class name.
import { BaseItem as BaseItemClass } from '../item.model';
import { che_치료_환약, che_치료_정력견혈 } from './HealItem';
import { che_계략_삼략, che_계략_육도 } from './StrategyItem';
import { che_능력치_무력_두강주, che_능력치_지력_이강주 } from './BuffItem';
import { che_사기_탁주, che_농성_위공자병법 } from './BattleItem';

export const ItemRegistry: Record<string, new () => BaseItemClass> = {
  // Heal
  che_치료_환약,
  che_치료_정력견혈,
  // Strategy
  che_계략_삼략,
  che_계략_육도,
  // Buff
  che_능력치_무력_두강주,
  che_능력치_지력_이강주,
  // Battle
  che_사기_탁주,
  che_농성_위공자병법,
};

export function createItem(className: string): BaseItemClass | null {
  const Ctor = ItemRegistry[className];
  if (!Ctor) {
    return null;
  }
  return new Ctor();
}
