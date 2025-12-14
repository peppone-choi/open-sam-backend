import { InvestCommerceCommand } from './investCommerce';

/**
 * 치안 강화 커맨드
 *
 * 도시의 치안 수치를 증가시킵니다.
 * 
 * 능력치: 정치(政) 70% + 무력(武) 30%
 * (치안은 정치력으로 관리하되 무력으로 진압하는 개념)
 */
export class ReinforceSecurityCommand extends InvestCommerceCommand {
  protected static cityKey = 'secu';
  protected static statKey = 'politics'; // 정치 능력치 기반 (통무지정매 시스템)
  protected static actionKey = '치안';
  protected static actionName = '치안 강화';
  protected static debuffFront = 1;
}
