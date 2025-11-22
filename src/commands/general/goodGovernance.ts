// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { cityRepository } from '../../repositories/city.repository';

/**
 * 선정(善政) 커맨드
 * 
 * 도시의 민심(trust)을 증가시킵니다.
 * 선정 = 좋은 정치, Good Governance
 */
export class GoodGovernanceCommand extends GeneralCommand {
  protected static cityKey = 'trust';
  protected static statKey = 'politics'; // 선정은 정치 능력치 주 사용 (매력도 관여)
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

    const actionName = (this.constructor as typeof GoodGovernanceCommand).actionName;
    
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
    const name = (this.constructor as typeof GoodGovernanceCommand).getName();
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
      'politics': '정치경험',
      'charm': '매력경험',
    };
    const statKey = (this.constructor as typeof GoodGovernanceCommand).statKey;
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
    const develCost = (this.env.develcost || 24) * 2;
    const reqGold = 0;
    const reqRice = this.generalObj.onCalcDomestic((this.constructor as typeof GoodGovernanceCommand).actionKey, 'cost', develCost);

    return [reqGold, Math.round(reqRice)];
  }

  public getCompensationStyle(): number | null {
    const score = this.generalObj.onCalcDomestic((this.constructor as typeof GoodGovernanceCommand).actionKey, 'score', 100);
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
    const statKey = (this.constructor as typeof GoodGovernanceCommand).statKey;

    let score = 0;
    if (statKey === 'politics') {
      // 선정은 정치 70% + 매력 30%
      const politics = general.getPolitics(true, true, true, false);
      const charm = general.getCharm(true, true, true, false);
      score = politics * 0.7 + charm * 0.3;
    } else if (statKey === 'leadership') {
      score = general.getLeadership(true, true, true, false);
    }

    score *= this.getDomesticExpLevelBonus(general.data.explevel ?? 0);
    score *= rng.nextRange(0.8, 1.2);
    score = general.onCalcDomestic((this.constructor as typeof GoodGovernanceCommand).actionKey, 'score', score);
    score = Math.max(1, score);

    return score;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const statKey = (this.constructor as typeof GoodGovernanceCommand).statKey;
    const actionKey = (this.constructor as typeof GoodGovernanceCommand).actionKey;
    const actionName = (this.constructor as typeof GoodGovernanceCommand).actionName;
    const cityKey = (this.constructor as typeof GoodGovernanceCommand).cityKey;

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
    const date = general.getTurnTime(general.TURNTIME_HM);

    score *= this.criticalScoreEx(rng, pick);

    const exp = score * 0.7;
    const ded = score * 1.0;

    if (pick === 'success') {
      try {
        if (typeof general.updateMaxDomesticCritical === 'function') {
          // TODO: general.updateMaxDomesticCritical();
        }
      } catch (error) {
        console.error('updateMaxDomesticCritical 실패:', error);
      }
    } else {
      // setAuxVar 대신 직접 aux 객체 수정
      if (!general.data.aux) {
        general.data.aux = {};
      }
      general.data.aux.max_domestic_critical = 0;
    }

    score /= 10;

    const scoreText = score.toFixed(1);

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`${actionName}을 <span class='ev_failed'>실패</span>하여 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`${actionName}을 <S>성공</>하여 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`${actionName}을 하여 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);
    }

    const newCityValue = Math.max(0, Math.min(
      this.city[cityKey] + score,
      100
    ));
    
    const sessionId = general.getSessionID();
    const cityID = general.data.city ?? 0;
    const cityUpdate: any = {};
    cityUpdate[cityKey] = newCityValue;
    
    await cityRepository.updateByCityNum(sessionId, cityID, cityUpdate);

    general.increaseVarWithLimit('rice', -this.reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    // 선정은 정치 70% + 매력 30%
    general.increaseVar('politics_exp', 1);
    general.increaseVar('charm_exp', 0.5);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GoodGovernanceCommand).getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      await tryUniqueItemLottery(
        rng,
        general,
        general.getSessionID(),
        '선정'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
