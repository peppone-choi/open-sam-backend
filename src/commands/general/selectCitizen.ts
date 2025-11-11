// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { cityRepository } from '../../repositories/city.repository';

/**
 * 주민 선정 커맨드
 * 
 * 도시의 민심(trust)을 증가시킵니다.
 */
export class SelectCitizenCommand extends GeneralCommand {
  protected static cityKey = 'trust';
  protected static statKey = 'leadership';
  protected static actionKey = '민심';
  protected static actionName = '주민 선정';

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
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.RemainCityTrust(actionName)
    ];

    this.reqRice = reqRice;
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof SelectCitizenCommand).getName();
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
    };
    const statKey = (this.constructor as typeof SelectCitizenCommand).statKey;
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
    const reqRice = this.generalObj.onCalcDomestic((this.constructor as typeof SelectCitizenCommand).actionKey, 'cost', develCost);

    return [reqGold, Math.round(reqRice)];
  }

  public getCompensationStyle(): number | null {
    const score = this.generalObj.onCalcDomestic((this.constructor as typeof SelectCitizenCommand).actionKey, 'score', 100);
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
    const statKey = (this.constructor as typeof SelectCitizenCommand).statKey;

    let score = 0;
    if (statKey === 'leadership') {
      score = general.getLeadership(true, true, true, false);
    }

    score *= this.getDomesticExpLevelBonus(general.getVar('explevel'));
    score *= rng.nextRange(0.8, 1.2);
    score = general.onCalcDomestic((this.constructor as typeof SelectCitizenCommand).actionKey, 'score', score);
    score = Math.max(1, score);

    return score;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const statKey = (this.constructor as typeof SelectCitizenCommand).statKey;
    const actionKey = (this.constructor as typeof SelectCitizenCommand).actionKey;
    const actionName = (this.constructor as typeof SelectCitizenCommand).actionName;
    const cityKey = (this.constructor as typeof SelectCitizenCommand).cityKey;

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

    score /= 10;

    const scoreText = score.toFixed(1);

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`${actionName}을 <span class='ev_failed'>실패</span>하여 <C>${scoreText}</> 상승했습니다.`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`${actionName}을 <S>성공</>하여 <C>${scoreText}</> 상승했습니다.`);
    } else {
      logger.pushGeneralActionLog(`${actionName}을 하여 <C>${scoreText}</> 상승했습니다.`);
    }

    const newCityValue = Math.max(0, Math.min(
      this.city[cityKey] + score,
      100
    ));
    
    const sessionId = general.getSessionID();
    const cityID = general.getVar('city');
    const cityUpdate: any = {};
    cityUpdate[cityKey] = newCityValue;
    
    await cityRepository.updateByCityNum(sessionId, cityID, cityUpdate);

    general.increaseVarWithLimit('rice', -this.reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(`${statKey}_exp`, 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof SelectCitizenCommand).getName(), this.arg));
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
        general.genGenericUniqueRNG(SelectCitizenCommand.actionName),
        general
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
