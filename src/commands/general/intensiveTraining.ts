import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';

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
      (ConstraintHelper as any).ReqGeneralTrainMargin((GameConst as any).maxTrainByCommand),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as any).getName();
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

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');

    const score = Util.round(
      (general as any).getLeadership() * 100 / general.getVar('crew') * (GameConst as any).trainDelta * 2 / 3
    );
    const scoreText = score.toLocaleString();

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`훈련, 사기치가 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);

    const exp = 150;
    const ded = 100;

    general.increaseVarWithLimit('train', score, 0, (GameConst as any).maxTrainByCommand);
    general.increaseVarWithLimit('atmos', score, 0, (GameConst as any).maxAtmosByCommand);

    general.addDex(general.getCrewTypeObj(), score * 2, false);

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);
    this.setResultTurn(new LastTurn(IntensiveTrainingCommand.getName(), this.arg));
    general.checkStatChange();
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      IntensiveTrainingCommand,
      this.env,
      this.arg ?? {}
    );
    
    await general.applyDB(db);

    return true;
  }
}
