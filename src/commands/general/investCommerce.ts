// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 상업 투자 커맨드 (기본 내정 클래스)
 * 
 * 농지개간, 성벽보수, 수비강화, 치안강화 등이 이 클래스를 상속합니다.
 */
export class InvestCommerceCommand extends GeneralCommand {
  protected static cityKey = 'comm';
  protected static statKey = 'intel';
  protected static actionKey = '상업';
  protected static actionName = '상업 투자';
  protected static debuffFront = 0.5;

  protected reqGold = 0;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();
    const cityKey = (this.constructor as typeof InvestCommerceCommand).cityKey;
    const actionName = (this.constructor as typeof InvestCommerceCommand).actionName;

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.RemainCityCapacity(cityKey, actionName)
    ];

    this.reqGold = reqGold;
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof InvestCommerceCommand).getName();
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
    };
    const statKey = (this.constructor as typeof InvestCommerceCommand).statKey;
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
    const develCost = this.env.develcost;
    const reqGold = Math.round(this.generalObj.onCalcDomestic((this.constructor as typeof InvestCommerceCommand).actionKey, 'cost', develCost));
    const reqRice = 0;

    return [reqGold, reqRice];
  }

  public getCompensationStyle(): number | null {
    const score = this.generalObj.onCalcDomestic((this.constructor as typeof InvestCommerceCommand).actionKey, 'score', 100);
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

  protected calcBaseScore(rng: any): number {
    const general = this.generalObj;
    const trust = Math.max(50, Math.min(this.city.trust, 100));
    const statKey = (this.constructor as typeof InvestCommerceCommand).statKey;

    let score = 0;
    if (statKey === 'intel') {
      score = general.getIntel(true, true, true, false);
    } else if (statKey === 'strength') {
      score = general.getStrength(true, true, true, false);
    } else if (statKey === 'leadership') {
      score = general.getLeadership(true, true, true, false);
    }

    score *= trust / 100;
    score *= this.getDomesticExpLevelBonus(general.getVar('explevel'));
    score *= rng.nextRange(0.8, 1.2);
    score = general.onCalcDomestic((this.constructor as typeof InvestCommerceCommand).actionKey, 'score', score);

    return score;
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const trust = Math.max(50, Math.min(this.city.trust, 100));
    const statKey = (this.constructor as typeof InvestCommerceCommand).statKey;
    const actionKey = (this.constructor as typeof InvestCommerceCommand).actionKey;
    const actionName = (this.constructor as typeof InvestCommerceCommand).actionName;
    const cityKey = (this.constructor as typeof InvestCommerceCommand).cityKey;
    const debuffFront = (this.constructor as typeof InvestCommerceCommand).debuffFront;

    let score = Math.max(1, this.calcBaseScore(rng));

    let { success: successRatio, fail: failRatio } = this.criticalRatioDomestic(general, statKey);
    if (trust < 80) {
      successRatio *= trust / 80;
    }
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
      try {
        if (typeof general.updateMaxDomesticCritical === 'function') {
          general.updateMaxDomesticCritical();
        }
      } catch (error) {
        console.error('updateMaxDomesticCritical 실패:', error);
      }
    } else {
      general.setAuxVar('max_domestic_critical', 0);
    }

    const scoreText = score.toLocaleString();

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`${actionName}을 <span class='ev_failed'>실패</span>하여 <C>${scoreText}</> 상승했습니다.`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`${actionName}을 <S>성공</>하여 <C>${scoreText}</> 상승했습니다.`);
    } else {
      logger.pushGeneralActionLog(`${actionName}을 하여 <C>${scoreText}</> 상승했습니다.`);
    }

    if ([1, 3].includes(this.city.front)) {
      let actualDebuffFront = debuffFront;

      if (this.nation.capital === this.city.city) {
        const relYear = this.env.year - this.env.startyear;

        if (relYear < 25) {
          const debuffScale = Math.max(0, Math.min(20, relYear - 5)) * 0.05;
          actualDebuffFront = (debuffScale * debuffFront) + (1 - debuffScale);
        }
      }

      score *= actualDebuffFront;
    }

    const cityUpdated: any = {};
    cityUpdated[cityKey] = Math.max(0, Math.min(
      this.city[cityKey] + score,
      this.city[`${cityKey}_max`]
    ));
    
    await db.update('city', cityUpdated, 'city=%i', general.getVar('city'));

    general.increaseVarWithLimit('gold', -this.reqGold, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(`${statKey}_exp`, 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof InvestCommerceCommand).getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/functions');
      await tryUniqueItemLottery(
        general.genGenericUniqueRNG(InvestCommerceCommand.actionName),
        general
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
