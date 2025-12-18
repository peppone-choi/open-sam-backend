import { GeneralCommand } from '../base/GeneralCommand';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 맹훈련 커맨드
 * 
 * 훈련도를 크게 올리지만 사기가 감소합니다.
 * 스택 시스템 제거됨 - 장수의 crew/train/atmos만 사용
 */
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

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof GeneralCommand).getName()}`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number { return 0; }
  public getPostReqTurn(): number { return 0; }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const logger = general.getLogger();
    const date = `${this.env.year}년 ${this.env.month}월`;

    const currentTrain = general.data.train ?? 70;
    const currentAtmos = general.data.atmos ?? 70;
    const maxTrain = GameConst.maxTrainByCommand || 100;
    
    // 훈련도 대폭 상승 (최대 maxTrain)
    const trainIncrease = Math.min(20, maxTrain - currentTrain);
    const newTrain = Math.min(maxTrain, currentTrain + trainIncrease);
    
    // 사기 감소
    const atmosDecrease = 10;
    const newAtmos = Math.max(0, currentAtmos - atmosDecrease);
    
    general.setVar('train', newTrain);
    general.setVar('atmos', newAtmos);

    logger.pushGeneralActionLog(`맹훈련 실시! 훈련도 <C>+${trainIncrease}</>, 사기 <R>-${atmosDecrease}</> <1>${date}</>`);

    general.addExperience(2);
    general.addDedication(2);
    general.increaseVar('leadership_exp', 2);

    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();

    await this.postRunHooks(rng);
    await this.saveGeneral();

    return true;
  }
}
