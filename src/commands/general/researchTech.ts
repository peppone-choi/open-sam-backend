import { InvestCommerceCommand } from './investCommerce';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 기술 연구 커맨드
 * 
 * 국가의 기술력을 증가시킵니다.
 */
export class ResearchTechCommand extends InvestCommerceCommand {
  protected static statKey = 'intel';
  protected static actionKey = '기술';
  protected static actionName = '기술 연구';

  protected init(): void {
    this.setCity();
    this.setNation(['tech']);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // NotWanderingNation(),
      // OccupiedCity(),
      // SuppliedCity(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice)
    ];

    this.reqGold = reqGold;
  }

  protected techLimit(startYear: number, currentYear: number, tech: number): boolean {
    const relYear = currentYear - startYear;
    const techLimit = relYear * 50;
    return tech > techLimit;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();
    const general = this.generalObj;
    const trust = Math.max(50, Math.min(this.city.trust, 100));
    const statKey = (this.constructor as typeof InvestCommerceCommand).statKey;
    const actionKey = (this.constructor as typeof InvestCommerceCommand).actionKey;
    const actionName = (this.constructor as typeof InvestCommerceCommand).actionName;

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
      // TODO: updateMaxDomesticCritical
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

    if (this.techLimit(this.env.startyear, this.env.year, this.nation.tech)) {
      score /= 4;
    }

    const genCount = Math.max(
      10, // GameConst::$initialNationGenLimit
      await db.queryFirstField('SELECT gennum FROM nation WHERE nation=%i', general.getVar('nation'))
    );

    const nationUpdated = {
      tech: this.nation.tech + score / genCount
    };
    await db.update('nation', nationUpdated, 'nation=%i', general.getVar('nation'));

    general.increaseVarWithLimit('gold', -this.reqGold, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(`${statKey}_exp`, 1);

    this.setResultTurn(new LastTurn((this.constructor as typeof ResearchTechCommand).getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler, tryUniqueItemLottery

    await general.save();

    return true;
  }
}
