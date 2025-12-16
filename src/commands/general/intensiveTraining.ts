import { GeneralCommand } from '../base/GeneralCommand';

import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

export class IntensiveTrainingCommand extends GeneralCommand {
  protected static actionName = '맹훈련';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
    ];

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralTrainMargin(GameConst.maxTrainByCommand),
    ];
  }

  private getUnitStacks(): any[] {
    return this.getCachedUnitStacks();
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

  private getAverageStackValue(stacks: any[], key: 'train' | 'morale', fallback: number): number {
    if (!stacks.length) {
      return fallback;
    }
    const total = stacks.reduce((sum, stack) => sum + (stack?.[key] ?? fallback), 0);
    return total / stacks.length;
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(통솔경험`;
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
    return [0, 500];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }


    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');
    const unitStacks = this.getUnitStacks();
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);

    const averageTrain = this.getAverageStackValue(unitStacks, 'train', general.data.train ?? 0);
    const averageMorale = this.getAverageStackValue(unitStacks, 'morale', general.data.atmos ?? 0);

    // 0으로 나누기 방지
    const crew = Math.max(1, totalCrew || general.data.crew || 1);
    const score = Util.round(
      general.getLeadership() * 100 / crew * GameConst.trainDelta * 2 / 3
    );
    const scoreText = score.toLocaleString();

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`훈련, 사기치가 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);

    const exp = 150;
    const ded = 100;

    general.increaseVarWithLimit('train', score, GameConst.maxTrainByCommand);
    general.increaseVarWithLimit('atmos', score, GameConst.maxAtmosByCommand);
    await this.applyIntensiveTrainingToStacks(unitStacks, score);

    const crewTypeObj = typeof general.getCrewTypeObj === 'function'
      ? general.getCrewTypeObj()
      : { id: general.data?.crewtype ?? 0, name: general.data?.crewtype_name ?? '병종', armType: general.data?.crewtype ?? 0 };

    if (typeof general.addDex === 'function') {
      general.addDex(crewTypeObj, score * 2, false);
    }

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);
    this.setResultTurn(new LastTurn(IntensiveTrainingCommand.getName(), this.arg));
    general.checkStatChange();
    
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
    await this.saveGeneral();

    return true;
  }

  private async applyIntensiveTrainingToStacks(stacks: any[], score: number): Promise<void> {
    if (!stacks.length) return;
 
    let updated = false;
    for (const stack of stacks) {
      const stackDoc = await unitStackRepository.findById(stack._id?.toString?.() || stack._id);
      if (!stackDoc) continue;
 
      const nextTrain = Math.min(GameConst.maxTrainByCommand, (stackDoc.train ?? 0) + score);
      const nextMorale = Math.min(GameConst.maxAtmosByCommand, (stackDoc.morale ?? 0) + score);
      stackDoc.train = nextTrain;
      stackDoc.morale = nextMorale;
      await stackDoc.save();
      updated = true;
    }
    if (updated) {
      this.markUnitStacksDirty();
    }
  }

}
