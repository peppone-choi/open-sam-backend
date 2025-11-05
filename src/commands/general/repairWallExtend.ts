import { InvestCommerceCommand } from './investCommerce';

/**
 * 성벽보수 커맨드
 * PHP che_성벽보수와 동일한 구조 (che_상업투자 상속)
 */
export class RepairWallExtendCommand extends InvestCommerceCommand {
  protected static cityKey = 'wall';
  protected static statKey = 'strength';
  protected static actionKey = '성벽';
  protected static actionName = '성벽 보수';
  protected static debuffFront = 0.25;
}

