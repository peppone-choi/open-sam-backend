import { InvestCommerceCommand } from './investCommerce';

/**
 * 치안 강화 커맨드
 *
 * 도시의 치안 수치를 증가시킵니다.
 */
export class ReinforceSecurityCommand extends InvestCommerceCommand {
  protected static cityKey = 'secu';
  protected static statKey = 'strength'; // PHP 원본과 동일하게 무력 사용
  protected static actionKey = '치안';
  protected static actionName = '치안 강화';
  protected static debuffFront = 1;
}
