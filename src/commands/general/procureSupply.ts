// @ts-nocheck - Type issues need review
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 물자 조달 커맨드
 * 
 * 랜덤하게 금이나 쌀을 조달합니다.
 */
export class ProcureSupplyCommand extends GeneralCommand {
  protected static actionName = '물자조달';
  protected static debuffFront = 0.5;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity()
    ];
  }

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof ProcureSupplyCommand).getName()}(랜덤경험)`;
  }

  public getCost(): [number, number] {
    return [0, 0];
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

  protected criticalScoreEx(rng: any, pick: string): number {
    if (pick === 'success') return rng.nextRange(1.5, 2.0);
    if (pick === 'fail') return rng.nextRange(0.3, 0.7);
    return 1.0;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const debuffFront = (this.constructor as typeof ProcureSupplyCommand).debuffFront;

    const [resName, resKey] = rng.choice([
      ['금', 'gold'],
      ['쌀', 'rice']
    ]);

    // 물자조달은 정치 60% + 통솔 40% (행정력과 조직력)
    const politics = general.getPolitics();
    const leadership = general.getLeadership();
    let score = politics * 0.6 + leadership * 0.4;
    score *= 3; // 기존 3개 합산 수준 유지
    score *= this.getDomesticExpLevelBonus(general.data.explevel);
    score *= rng.nextRange(0.8, 1.2);

    let successRatio = 0.1;
    let failRatio = 0.3;

    successRatio = general.onCalcDomestic('조달', 'success', successRatio);
    failRatio = general.onCalcDomestic('조달', 'fail', failRatio);
    const normalRatio = 1 - failRatio - successRatio;

    const pick = rng.choiceUsingWeight({
      'fail': failRatio,
      'success': successRatio,
      'normal': normalRatio
    });

    score *= this.criticalScoreEx(rng, pick);
    score = general.onCalcDomestic('조달', 'score', score);
    score = Math.round(score);

    const exp = score * 0.7 / 3;
    const ded = score * 1.0 / 3;

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    if (!this.city) {
      throw new Error('도시 정보가 없습니다');
    }

    if ([1, 3].includes(this.city.front ?? 0)) {
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

    const scoreText = score.toLocaleString();

    if (pick === 'fail') {
      logger.pushGeneralActionLog(`조달을 <span class='ev_failed'>실패</span>하여 ${resName}을 <C>${scoreText}</> 조달했습니다. <1>${date}</>`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`조달을 <S>성공</>하여 ${resName}을 <C>${scoreText}</> 조달했습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`${resName}을 <C>${scoreText}</> 조달했습니다. <1>${date}</>`);
    }

    const incStat = rng.choiceUsingWeight({
      'leadership_exp': general.getLeadership(false, false, false, false),
      'strength_exp': general.getStrength(false, false, false, false),
      'intel_exp': general.getIntel(false, false, false, false),
      'politics_exp': general.getPolitics(false, false, false, false),
      'charm_exp': general.getCharm(false, false, false, false)
    });

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(incStat, 1);

    // MongoDB로 국가 자원 증가 (BaseCommand.incrementNation 사용)
    await this.incrementNation(general.getNationID(), { [resKey]: score });

    this.setResultTurn(new LastTurn((this.constructor as typeof ProcureSupplyCommand).getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

    return true;
  }
}
