// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 정착 장려 커맨드
 * 
 * 도시의 인구를 증가시킵니다.
 */
export class EncourageSettlementCommand extends GeneralCommand {
  protected static cityKey = 'pop';
  protected static statKey = 'leadership';
  protected static actionKey = '인구';
  protected static actionName = '정착 장려';

  protected reqRice = 0;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // NotWanderingNation(),
      // OccupiedCity(),
      // SuppliedCity(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
      // RemainCityCapacity(cityKey, actionName)
    ];

    this.reqRice = reqRice;
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof EncourageSettlementCommand).getName();
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
    };
    const statKey = (this.constructor as typeof EncourageSettlementCommand).statKey;
    const statType = statTypeBase[statKey];
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(${statType}`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }
    title += ')';
    return title;
  }

  public getCost(): [number, number] {
    const develCost = this.env.develcost * 2;
    const reqGold = 0;
    const reqRice = Math.round(this.generalObj.onCalcDomestic((this.constructor as typeof EncourageSettlementCommand).actionKey, 'cost', develCost));

    return [reqGold, reqRice];
  }

  public getCompensationStyle(): number | null {
    const score = this.generalObj.onCalcDomestic((this.constructor as typeof EncourageSettlementCommand).actionKey, 'score', 100);
    if (score > 100) return 1;
    if (score < 100) return -1;
    return 0;
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  protected getDomesticExpLevelBonus(explevel: number): number {
    return 1 + explevel * 0.01;
  }

  protected criticalRatioDomestic(general: any, statKey: string): { success: number; fail: number } {
    return { success: 0.1, fail: 0.1 };
  }

  protected criticalScoreEx(rng: any, pick: string): number {
    if (pick === 'success') return rng.nextRange(1.5, 2.0);
    if (pick === 'fail') return rng.nextRange(0.3, 0.7);
    return 1.0;
  }

  protected calcBaseScore(rng: any): number {
    const general = this.generalObj;
    const statKey = (this.constructor as typeof EncourageSettlementCommand).statKey;

    let score = 0;
    if (statKey === 'leadership') {
      score = general.getLeadership(true, true, true, false);
    }

    score *= this.getDomesticExpLevelBonus(general.getVar('explevel'));
    score *= rng.nextRange(0.8, 1.2);
    score = general.onCalcDomestic((this.constructor as typeof EncourageSettlementCommand).actionKey, 'score', score);

    return score;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const statKey = (this.constructor as typeof EncourageSettlementCommand).statKey;
    const actionKey = (this.constructor as typeof EncourageSettlementCommand).actionKey;
    const actionName = (this.constructor as typeof EncourageSettlementCommand).actionName;
    const cityKey = (this.constructor as typeof EncourageSettlementCommand).cityKey;

    let score = Math.max(1, this.calcBaseScore(rng));

    let { success: successRatio, fail: failRatio } = this.criticalRatioDomestic(general, statKey);
    successRatio = general.onCalcDomestic(actionKey, 'success', successRatio);
    failRatio = general.onCalcDomestic(actionKey, 'fail', failRatio);

    successRatio = Math.max(0, Math.min(1, successRatio));
    failRatio = Math.max(0, Math.min(1 - successRatio, failRatio));
    const normalRatio = 1 - failRatio - successRatio;

    const pick = rng.choiceUsingWeight({
      'fail': failRatio,
      'success': successRatio,
      'normal': normalRatio
    });

    const logger = general.getLogger();

    score *= this.criticalScoreEx(rng, pick);
    score = Math.round(score);

    const exp = score * 0.7;
    const ded = score * 1.0;

    if (pick === 'success') {
      // TODO: updateMaxDomesticCritical
    } else {
      general.setAuxVar('max_domestic_critical', 0);
    }

    score *= 10;

    const scoreText = score.toLocaleString();

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`${actionName}을 <span class='ev_failed'>실패</span>하여 주민이 <C>${scoreText}</>명 증가했습니다.`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`${actionName}을 <S>성공</>하여 주민이 <C>${scoreText}</>명 증가했습니다.`);
    } else {
      logger.pushGeneralActionLog(`${actionName}을 하여 주민이 <C>${scoreText}</>명 증가했습니다.`);
    }

    const cityUpdated: any = {};
    cityUpdated[cityKey] = Math.max(0, Math.min(
      this.city[cityKey] + score,
      this.city[`${cityKey}_max`]
    ));
    
    await db.update('city', cityUpdated, 'city=%i', general.getVar('city'));

    general.increaseVarWithLimit('rice', -this.reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(`${statKey}_exp`, 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof EncourageSettlementCommand).getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler, tryUniqueItemLottery

    await general.save();

    return true;
  }
}
