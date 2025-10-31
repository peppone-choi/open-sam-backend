import { InvestCommerceCommand } from './investCommerce';

/**
 * 수비 강화 커맨드
 * 
 * 도시의 수비 수치를 증가시킵니다.
 */
export class ReinforceDefenseCommand extends InvestCommerceCommand {
  protected static cityKey = 'def';
  protected static statKey = 'strength';
  protected static actionKey = '수비';
  protected static actionName = '수비 강화';
  protected static debuffFront = 0.5;
}
