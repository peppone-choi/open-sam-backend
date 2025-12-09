import { InvestCommerceCommand } from './investCommerce';

/**
 * 관개 시설 건설 커맨드
 * 
 * 도시의 농업 최대치를 증가시킵니다.
 * 정치력 기반 명령입니다.
 */
export class BuildIrrigationCommand extends InvestCommerceCommand {
  protected static cityKey = 'agri_max';
  protected static statKey = 'politics';
  protected static actionKey = '농업';
  protected static actionName = '관개 시설';
  protected static debuffFront = 0.5;

  public getCost(): [number, number] {
    const env = this.env;
    // 건설은 일반 투자보다 비용이 2배
    const cost = env.develcost * 2;
    return [cost, cost];
  }

  protected getInvestAmount(rng: any): number {
    const general = this.generalObj;
    const statKey = (this.constructor as typeof BuildIrrigationCommand).statKey;
    
    let stat: number;
    if (statKey === 'politics') {
      stat = general.getPolitics();
    } else if (statKey === 'intel') {
      stat = general.getIntel();
    } else {
      stat = general.getLeadership();
    }

    // 증축량: 50 ~ 150 + 스탯 보너스
    const baseAmount = rng.nextRangeInt(50, 150);
    const statBonus = Math.floor(stat / 10);
    
    return baseAmount + statBonus;
  }
}










