import { InvestCommerceCommand } from './investCommerce';

/**
 * 성벽 보수 커맨드
 * 
 * 도시의 성벽 수치를 증가시킵니다.
 */
export class RepairWallCommand extends InvestCommerceCommand {
  protected static cityKey = 'wall';
  protected static statKey = 'strength';
  protected static actionKey = '성벽';
  protected static actionName = '성벽 보수';
  protected static debuffFront = 0.25;
}
