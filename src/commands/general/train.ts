import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';

import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { IUnitStack } from '../../models/unit_stack.model';

/**
 * 단련 커맨드
 * 
 * 병종 숙련도를 향상시킵니다.
 * 자금과 군량을 소모하며, 병사 수, 훈련도, 사기에 따라 성공률이 달라집니다.
 */
export class TrainCommand extends GeneralCommand {
  protected static actionName = '단련';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    // PHP che_단련.php와 동일한 Constraints
    // - OccupiedCity(), SuppliedCity() 제거 (PHP에 없음)
    // - defaultTrainLow = 40, defaultAtmosLow = 40 (PHP GameConstBase.php)
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralValue('train', '훈련', '>=', 40), // PHP: GameConst::$defaultTrainLow
      ConstraintHelper.ReqGeneralValue('atmos', '사기', '>=', 40), // PHP: GameConst::$defaultAtmosLow
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  private getUnitStacks(): any[] {
    return this.getCachedUnitStacks();
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(병종숙련`;
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
    const env = this.env;
    return [env.develcost, env.develcost];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  /**
   * 단련 실행
   * 
   * - 병종 숙련도 향상
   * - 확률적 성공/보통/실패
   * - 경험치 및 능력치 증가
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;

    const unitStacks = this.getUnitStacks();
    const primaryStack = unitStacks[0];
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    const effectiveTrain = primaryStack?.train ?? general.data.train ?? 50;
    const effectiveMorale = primaryStack?.morale ?? general.data.atmos ?? 50;

    // 성공률 계산 (성공 34%, 보통 33%, 실패 33%)
    const [pick, multiplier] = rng.choiceUsingWeightPair([
      [['success', 3], 0.34],
      [['normal', 2], 0.33],
      [['fail', 1], 0.33]
    ]);

    // 숙련도 증가량 계산 (PHP 원본과 동일: round 먼저, 그 후 multiplier)
    let score = Math.round(
      totalCrew * effectiveTrain * effectiveMorale / 20 / 10000
    );
    score *= multiplier;

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);
    
    const crewTypeObj = primaryStack
      ? { id: primaryStack.crew_type_id, name: primaryStack.crew_type_name, armType: 0 }
      : { id: 0, name: '병종', armType: 0 };
    const armTypeText = crewTypeObj.name || '병종';

    // 결과 로그
    if (pick === 'fail') {
      logger.pushGeneralActionLog(`단련이 <span class='ev_failed'>지지부진</span>하여 ${armTypeText} 숙련도가 <C>${score}</> 향상되었습니다. <1>${date}</>`);
    } else if (pick === 'success') {
      logger.pushGeneralActionLog(`단련이 <S>일취월장</>하여 ${armTypeText} 숙련도가 <C>${score}</> 향상되었습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`${armTypeText} 숙련도가 <C>${score}</> 향상되었습니다. <1>${date}</>`);
    }

    // 경험치
    const crew = Math.max(1, totalCrew);
    const exp = crew / 400;

    // 병종 숙련도 증가
    if (typeof general.addDex === 'function') {

      general.addDex(crewTypeObj, score, false);

    }

    // 능력치 증가 (PHP와 동일하게 통무지만)
    const incStat = rng.choiceUsingWeight({
      'leadership_exp': general.getLeadership(false, false, false, false),
      'strength_exp': general.getStrength(false, false, false, false),
      'intel_exp': general.getIntel(false, false, false, false)
    });

    const [reqGold, reqRice] = this.getCost();

    // 자금/군량 차감
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    
    // 경험치/능력치 증가
    general.addExperience(exp);
    this.applyTrainingToStacks(unitStacks, multiplier);
    general.increaseVar(incStat, 1);

    this.setResultTurn(new LastTurn(TrainCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

    return true;
  }

  private getStackTroopCount(stack: any): number {
    const hp = stack?.hp;
    if (typeof hp === 'number') {
      return hp;
    }
    const unitSize = stack?.unit_size ?? 100;
    const stackCount = stack?.stack_count ?? 0;
    return unitSize * stackCount;
  }

  private async applyTrainingToStacks(stacks: any[], multiplier: number): Promise<void> {
    if (!stacks.length) return;
    let updated = false;
    for (const stack of stacks) {
      const stackDoc = await unitStackRepository.findById(stack._id?.toString?.() || stack._id);
      if (!stackDoc) continue;
      stackDoc.train = Math.min(100, stackDoc.train + 1 * multiplier);
      stackDoc.morale = Math.min(100, stackDoc.morale + 0.5 * multiplier);
      await stackDoc.save();
      updated = true;
    }
    if (updated) {
      this.markUnitStacksDirty();
    }
  }
}
