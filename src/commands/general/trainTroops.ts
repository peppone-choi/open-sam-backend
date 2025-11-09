import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';

export class TrainTroopsCommand extends GeneralCommand {
  protected static actionName = '훈련';

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
    return [0, 0];
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

    // TODO: Legacy DB access - const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');

    const score = Util.clamp(
      Util.round(general.getLeadership() * 100 / general.getVar('crew') * GameConst.trainDelta),
      0,
      Util.clamp(GameConst.maxTrainByCommand - general.getVar('train'), 0)
    );
    const scoreText = score.toLocaleString();

    const sideEffect = Util.valueFit(
      Math.floor(general.getVar('atmos') * GameConst.atmosSideEffectByTraining),
      0
    );

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`훈련치가 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);

    const exp = 100;
    const ded = 70;

    general.increaseVar('train', score);
    general.setVar('atmos', sideEffect);

    general.addDex(general.getCrewTypeObj(), score, false);

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);
    this.setResultTurn(new LastTurn(TrainTroopsCommand.getName(), this.arg));
    general.checkStatChange();
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      TrainTroopsCommand,
      this.env,
      this.arg ?? {}
    );
    
    await await this.saveGeneral();

    return true;
  }
}
