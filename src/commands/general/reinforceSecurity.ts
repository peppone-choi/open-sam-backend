import { InvestCommerceCommand } from './investCommerce';

/**
 * 치안 강화 커맨드
 * 
 * 도시의 치안 수치를 증가시킵니다.
 */
export class ReinforceSecurityCommand extends InvestCommerceCommand {
  protected static cityKey = 'secu';
  protected static statKey = 'strength'; // PHP 원본과 동일하게 무력 사용
  protected static actionKey = '치안';
  protected static actionName = '치안 강화';
  protected static debuffFront = 1;

  /**
   * 치안 강화는 통솔 70% + 무력 30% 복합 능력치 사용
   */
  protected calcBaseScore(rng: any): number {
    const general = this.generalObj;
    
    if (!this.city) {
      throw new Error('도시 정보가 없습니다');
    }
    const trust = Math.max(50, Math.min(this.city.trust, 100));

    // 통솔 70% + 무력 30%
    const leadership = general.getLeadership(true, true, true, false);
    const strength = general.getStrength(true, true, true, false);
    let score = leadership * 0.7 + strength * 0.3;

    score *= trust / 100;
    score *= this.getDomesticExpLevelBonus(general.data.explevel ?? 0);
    score *= rng.nextRange(0.8, 1.2);
    score = general.onCalcDomestic(ReinforceSecurityCommand.actionKey, 'score', score);

    return score;
  }

  /**
   * 치안 강화 실행 - 통솔 70% + 무력 30% 경험치 지급
   * InvestCommerce의 경험치 증가 부분만 오버라이드
   */
  protected addStatExp(): void {
    const general = this.generalObj;
    // 치안강화는 통솔 70% + 무력 30%
    general.increaseVar('leadership_exp', 1);
    general.increaseVar('strength_exp', 0.5);
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const { DB } = await import('../../config/db');
    const db = DB.db();
    const general = this.generalObj;
    const trust = Math.max(50, Math.min(this.city.trust, 100));
    const statKey = (this.constructor as typeof ReinforceSecurityCommand).statKey;
    const actionKey = (this.constructor as typeof ReinforceSecurityCommand).actionKey;
    const actionName = (this.constructor as typeof ReinforceSecurityCommand).actionName;
    const cityKey = (this.constructor as typeof ReinforceSecurityCommand).cityKey;
    const debuffFront = (this.constructor as typeof ReinforceSecurityCommand).debuffFront;

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

    if ([1, 3].includes(this.city?.front ?? 0)) {
      let actualDebuffFront = debuffFront;

      if (this.nation && this.nation.capital === this.city.city) {
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
    
    await db.update('city', cityUpdated, 'city=%i', general.data.city ?? 0);

    general.increaseVarWithLimit('gold', -this.reqGold, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    
    // 복합 능력치 경험치 지급 (통솔 70% + 무력 30%)
    general.increaseVar('leadership_exp', 1);
    general.increaseVar('strength_exp', 0.5);
    
    this.setResultTurn(new (await import('../base/BaseCommand')).LastTurn(ReinforceSecurityCommand.getName(), this.arg));
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
        // TODO: general.genGenericUniqueRNG(ReinforceSecurityCommand.actionName),
        general,
        general.getSessionID(),
        '아이템'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
