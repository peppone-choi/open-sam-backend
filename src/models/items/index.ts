/**
 * Item System Index
 * 모든 아이템 클래스 export
 */

// Base classes
export { BaseItem, ItemConsumeResult } from '../item.model';
export { ActionItem } from './ActionItem';
export { BaseStatItem } from './BaseStatItem';

// Heal items
export {
  che_치료_환약,
  che_치료_정력견혈,
  che_의술_상한잡병론
} from './HealItem';

// Strategy items
export {
  che_계략_삼략,
  che_계략_육도,
  che_계략_이추
} from './StrategyItem';

// Buff items
export {
  che_능력치_무력_두강주,
  che_능력치_지력_이강주,
  che_능력치_통솔_보령압주,
  che_훈련_과실주
} from './BuffItem';

// Battle items
export {
  che_사기_탁주,
  che_사기_초선화,
  che_농성_위공자병법
} from './BattleItem';

// Import for registry
import { BaseItem } from '../item.model';
import { che_치료_환약, che_치료_정력견혈, che_의술_상한잡병론 } from './HealItem';
import { che_계략_삼략, che_계략_육도, che_계략_이추 } from './StrategyItem';
import { che_능력치_무력_두강주, che_능력치_지력_이강주, che_능력치_통솔_보령압주, che_훈련_과실주 } from './BuffItem';
import { che_사기_탁주, che_사기_초선화, che_농성_위공자병법 } from './BattleItem';

/**
 * 아이템 레지스트리
 * 클래스명으로 아이템 인스턴스 생성
 */
export const ItemRegistry: Record<string, new () => BaseItem> = {
  // Heal items
  'che_치료_환약': che_치료_환약,
  'che_치료_정력견혈': che_치료_정력견혈,
  'che_의술_상한잡병론': che_의술_상한잡병론,
  
  // Strategy items
  'che_계략_삼략': che_계략_삼략,
  'che_계략_육도': che_계략_육도,
  'che_계략_이추': che_계략_이추,
  
  // Buff items
  'che_능력치_무력_두강주': che_능력치_무력_두강주,
  'che_능력치_지력_이강주': che_능력치_지력_이강주,
  'che_능력치_통솔_보령압주': che_능력치_통솔_보령압주,
  'che_훈련_과실주': che_훈련_과실주,
  
  // Battle items
  'che_사기_탁주': che_사기_탁주,
  'che_사기_초선화': che_사기_초선화,
  'che_농성_위공자병법': che_농성_위공자병법
};

/**
 * 아이템 클래스명으로 인스턴스 생성
 */
export function createItem(className: string): BaseItem | null {
  const ItemClass = ItemRegistry[className];
  if (!ItemClass) {
    return null;
  }
  return new ItemClass();
}
