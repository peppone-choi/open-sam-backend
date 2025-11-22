// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { InvestCommerceCommand } from './investCommerce';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

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
    // ExecuteEngine.loadCityAndNation()에서 이미 _cached_nation을 채워두므로
    // 여기서는 추가 필드 로딩 없이 기본 setNation()만 호출한다.
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice)
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

    const db = DB.db();
    const general = this.generalObj;
    
    if (!this.city) {
      throw new Error('도시 정보가 없습니다');
    }
    const trust = Math.max(50, Math.min(this.city.trust, 100));
    const statKey = (this.constructor as typeof InvestCommerceCommand).statKey;
    const actionKey = (this.constructor as typeof InvestCommerceCommand).actionKey;
    const actionName = (this.constructor as typeof InvestCommerceCommand).actionName;

    let score = Math.max(1, this.calcBaseScore(rng));

    let { success: successRatio, fail: failRatio } = this.criticalRatioDomestic(general, statKey);
    if (trust < 80) {
      // 0으로 나누기 방지 (trust는 이미 50~100 범위)
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
    const date = general.getTurnTime(general.TURNTIME_HM);

    score *= this.criticalScoreEx(rng, pick);
    score = Math.round(score);

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
      if (!general.data.aux) {
        general.data.aux = {};
      }
      general.data.aux.max_domestic_critical = 0;
    }

    const scoreText = score.toLocaleString();

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`${actionName}을 <span class='ev_failed'>실패</span>하여 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`${actionName}을 <S>성공</>하여 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`${actionName}을 하여 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);
    }

    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    
    if (this.techLimit(this.env.startyear, this.env.year, this.nation.tech)) {
      score /= 4;
    }

    const genCount = Math.max(
      10, // GameConst::$initialNationGenLimit
      await db.queryFirstField('SELECT gennum FROM nation WHERE nation=%i', general.data.nation ?? 0)
    );

    // 0으로 나누기 방지: genCount는 최소 10
    const techIncrease = score / Math.max(1, genCount);
    
    try {
      const nationUpdated = {
        tech: this.nation.tech + techIncrease
      };
      await db.update('nation', nationUpdated, 'nation=%i', general.data.nation ?? 0);
    } catch (error) {
      console.error('국가 기술 업데이트 실패:', error);
      throw new Error(`기술 연구 실패: ${error.message}`);
    }

    general.increaseVarWithLimit('gold', -this.reqGold, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(`${statKey}_exp`, 1);

    this.setResultTurn(new LastTurn((this.constructor as typeof ResearchTechCommand).getName(), this.arg));
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
        // TODO: general.genGenericUniqueRNG(ResearchTechCommand.actionName),
        general
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
