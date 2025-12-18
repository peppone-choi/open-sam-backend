import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';

/**
 * 사기 진작 커맨드
 * 
 * 병사들의 사기를 올립니다.
 * 스택 시스템 제거됨 - 장수의 crew/atmos만 사용
 */
export class BoostMoraleCommand extends GeneralCommand {
  protected static actionName = '사기진작';

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
      ConstraintHelper.OccupiedCity(),
    ];

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.ReqGeneralAtmosMargin(GameConst.maxAtmosByCommand || 100),
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

    const currentAtmos = general.data.atmos ?? 70;
    const maxAtmos = GameConst.maxAtmosByCommand || 100;
    
    // 사기 상승 (최대 maxAtmos)
    const atmosIncrease = Math.min(10, maxAtmos - currentAtmos);
    const newAtmos = Math.min(maxAtmos, currentAtmos + atmosIncrease);
    
    general.setVar('atmos', newAtmos);

    logger.pushGeneralActionLog(`사기가 <C>${atmosIncrease}</> 상승했습니다. (${currentAtmos} → ${newAtmos}) <1>${date}</>`);

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
