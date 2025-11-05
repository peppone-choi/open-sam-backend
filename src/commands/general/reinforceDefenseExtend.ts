import { InvestCommerceCommand } from './investCommerce';

/**
 * 수비강화 커맨드
 * PHP che_수비강화와 동일한 구조 (che_상업투자 상속)
 */
export class ReinforceDefenseExtendCommand extends InvestCommerceCommand {
  protected static cityKey = 'def';
  protected static statKey = 'strength';
  protected static actionKey = '수비';
  protected static actionName = '수비 강화';
  protected static debuffFront = 0.5;
}

