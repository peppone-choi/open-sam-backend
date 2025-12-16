// @ts-nocheck - Type issues need review
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';

import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { cityRepository } from '../../repositories/city.repository';
import { 
  CriticalRatioDomestic, 
  CriticalScoreEx, 
  updateMaxDomesticCritical 
} from '../../utils/game-processing';

/**
 * 정착 장려 커맨드
 * 
 * 도시의 인구를 증가시킵니다.
 */
export class EncourageSettlementCommand extends GeneralCommand {
  protected static cityKey = 'pop';
  protected static statKey = 'leadership'; // 정착 장려는 통솔 능력치 사용 (PHP Parity)
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
    const cityKey = (this.constructor as typeof EncourageSettlementCommand).cityKey;
    const actionName = (this.constructor as typeof EncourageSettlementCommand).actionName;

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.RemainCityCapacity(cityKey, actionName)
    ];

    this.reqRice = reqRice;
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof EncourageSettlementCommand).getName();
    const statTypeBase: Record<string, string> = {
      'leadership': '통솔경험',
      'strength': '무력경험',
      'intel': '지력경험',
      'politics': '정치경험',
      'charm': '매력경험',
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
    const develCost = (this.env.develcost || 24) * 2;
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

  protected calcBaseScore(rng: any): number {
    const general = this.generalObj;
    const statKey = (this.constructor as typeof EncourageSettlementCommand).statKey;

    let score = 0;
    if (statKey === 'leadership') {
      score = general.getLeadership(true, true, true, false);
    } else if (statKey === 'politics') {
      score = general.getPolitics(true, true, true, false);
    } else if (statKey === 'charm') {
      score = general.getCharm(true, true, true, false);
    }

    score *= this.getDomesticExpLevelBonus(general.data.explevel ?? 0);
    score *= rng.nextRange(0.8, 1.2);
    score = general.onCalcDomestic((this.constructor as typeof EncourageSettlementCommand).actionKey, 'score', score);

    return score;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const statKey = (this.constructor as typeof EncourageSettlementCommand).statKey;
    const actionKey = (this.constructor as typeof EncourageSettlementCommand).actionKey;
    const actionName = (this.constructor as typeof EncourageSettlementCommand).actionName;
    const cityKey = (this.constructor as typeof EncourageSettlementCommand).cityKey;

    let score = Math.max(1, this.calcBaseScore(rng));

    const leadership = general.getLeadership(true, true, true, false);
    const strength = general.getStrength(true, true, true, false);
    const intel = general.getIntel(true, true, true, false);

    // Fallback ratioType logic as in GoodGovernance
    const ratioType = (statKey === 'leadership' || statKey === 'strength' || statKey === 'intel') 
        ? statKey 
        : 'leadership'; // Default for settlement

    let { success: successRatio, fail: failRatio } = CriticalRatioDomestic(leadership, strength, intel, ratioType as any);
    
    // Adjust for trust if city exists
    if (this.city && this.city.trust < 80) {
        successRatio *= this.city.trust / 80;
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
    const date = general.getTurnTime(general.TURNTIME_HM);

    score *= CriticalScoreEx(rng, pick);
    score = Math.round(score);

    const exp = score * 0.7;
    const ded = score * 1.0;

    if (pick === 'success') {
      try {
        updateMaxDomesticCritical(general, score);
      } catch (error) {
        console.error('updateMaxDomesticCritical 실패:', error);
      }
    } else {
      if (!general.data.aux) {
        general.data.aux = {};
      }
      general.data.aux.max_domestic_critical = 0;
    }

    score *= 10;

    const scoreText = score.toLocaleString();

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`${actionName}을 <span class='ev_failed'>실패</span>하여 주민이 <C>${scoreText}</>명 증가했습니다. <1>${date}</>`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`${actionName}을 <S>성공</>하여 주민이 <C>${scoreText}</>명 증가했습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`${actionName}을 하여 주민이 <C>${scoreText}</>명 증가했습니다. <1>${date}</>`);
    }

    const newCityValue = Math.max(0, Math.min(
      this.city[cityKey] + score,
      this.city[`${cityKey}_max`]
    ));

    const sessionId = general.getSessionID();
    const cityID = general.data.city ?? 0;
    const cityUpdate: any = {};
    cityUpdate[cityKey] = newCityValue;

    await cityRepository.updateByCityNum(sessionId, cityID, cityUpdate);

    general.increaseVarWithLimit('rice', -this.reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    // TS Extension logic
    general.increaseVar('politics_exp', 1);
    general.increaseVar('charm_exp', 0.5);

    this.setResultTurn(new LastTurn((this.constructor as typeof EncourageSettlementCommand).getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

    return true;
  }
}
