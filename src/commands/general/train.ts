import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';

/**
 * 단련 커맨드
 * 
 * 병종 숙련도를 향상시킵니다.
 * 스택 시스템 제거됨 - 장수의 crew만 사용
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

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
    ];

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof GeneralCommand).getName()}`;
  }

  public getCost(): [number, number] {
    const general = this.generalObj;
    const crew = general?.data?.crew || 0;
    const baseCost = Math.max(1, Math.ceil(crew / 100));
    return [baseCost, baseCost];
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

    const crew = general.data.crew ?? 0;
    const currentTrain = general.data.train ?? 70;
    
    // 훈련도 상승 (최대 100)
    const trainIncrease = Math.min(10, 100 - currentTrain);
    const newTrain = Math.min(100, currentTrain + trainIncrease);
    
    general.setVar('train', newTrain);
    
    // 병종 숙련도 증가
    const crewTypeObj = typeof general.getCrewTypeObj === 'function'
      ? general.getCrewTypeObj()
      : { id: general.data?.crewtype ?? 0 };
    
    if (typeof general.addDex === 'function') {
      general.addDex(crewTypeObj, crew / 100, false);
    }

    logger.pushGeneralActionLog(`훈련도가 <C>${trainIncrease}</> 상승했습니다. (${currentTrain} → ${newTrain}) <1>${date}</>`);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    
    general.addExperience(1);
    general.addDedication(1);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn((this.constructor as typeof GeneralCommand).getName(), this.arg));
    general.checkStatChange();

    await this.postRunHooks(rng);
    await this.saveGeneral();

    return true;
  }
}
