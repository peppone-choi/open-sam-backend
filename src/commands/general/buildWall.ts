import { InvestCommerceCommand } from './investCommerce';

/**
 * 성벽 증축 커맨드
 * 
 * 도시의 성벽 최대치를 증가시킵니다.
 * 무력 기반 명령입니다.
 */
export class BuildWallCommand extends InvestCommerceCommand {
  protected static cityKey = 'wall_max';
  protected static statKey = 'strength';
  protected static actionKey = '성벽';
  protected static actionName = '성벽 증축';
  protected static debuffFront = 0.5; // 전선 패널티 더 높음

  public getCost(): [number, number] {
    const env = this.env;
    // 증축은 일반 투자보다 비용이 2배
    const cost = env.develcost * 2;
    return [cost, cost];
  }

  protected getInvestAmount(rng: any): number {
    const general = this.generalObj;
    const statKey = (this.constructor as typeof BuildWallCommand).statKey;
    
    let stat: number;
    if (statKey === 'strength') {
      stat = general.getStrength();
    } else if (statKey === 'intel') {
      stat = general.getIntel();
    } else if (statKey === 'politics') {
      stat = general.getPolitics();
    } else {
      stat = general.getLeadership();
    }

    // 증축량: 50 ~ 150 + 스탯 보너스
    const baseAmount = rng.nextRangeInt(50, 150);
    const statBonus = Math.floor(stat / 10);
    
    return baseAmount + statBonus;
  }
}










