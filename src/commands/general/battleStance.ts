import { getTechCost } from '../../utils/global-funcs';
import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { Util } from '../../utils/Util';
import { LastTurn } from '../../types/LastTurn';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { tryUniqueItemLottery } from '../../utils/functions';
import { StaticEventHandler } from '../../events/StaticEventHandler';

/**
 * 전투태세 커맨드
 * 
 * 3턴에 걸쳐 병사들을 훈련하여 훈련도와 사기를 최대치 근처로 끌어올립니다.
 */
export class BattleStanceCommand extends GeneralCommand {
  protected static actionName = '전투태세';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const general = this.generalObj;

    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      (ConstraintHelper as any).ReqGeneralTrainMargin((GameConst as any).maxTrainByCommand - 10),
      (ConstraintHelper as any).ReqGeneralAtmosMargin((GameConst as any).maxAtmosByCommand - 10),
    ];
  }

  public getCost(): [number, number] {
    const crew = this.generalObj.getVar('crew');
    const techCost = getTechCost(this!.nation.tech);
    return [Util.round(crew / 100 * 3 * techCost), 0];
  }

  public getPreReqTurn(): number {
    return 3;
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
    const date = general.getTurnTime('HM');

    const lastTurn = general.getLastTurn();
    const turnResult = new LastTurn((this.constructor as typeof BattleStanceCommand).getName(), this.arg);

    const reqTurn = this.getPreReqTurn();

    if (lastTurn.getCommand() !== (this.constructor as typeof BattleStanceCommand).getName()) {
      (turnResult as any).setTerm(1);
    } else if ((lastTurn as any).getTerm() === reqTurn) {
      (turnResult as any).setTerm(1);
    } else if ((lastTurn as any).getTerm() < reqTurn) {
      (turnResult as any).setTerm((lastTurn as any).getTerm() + 1);
    } else {
      throw new Error('전투 태세에 올바른 턴이 아님');
    }

    const term = (turnResult as any).getTerm();

    const logger = general.getLogger();

    if (term < 3) {
      logger.pushGeneralActionLog(`병사들을 열심히 훈련중... (${term}/3) <1>${date}</>`);
      this.setResultTurn(turnResult);
      await general.applyDB(db);

      return true;
    }

    logger.pushGeneralActionLog(`전투태세 완료! (${term}/3) <1>${date}</>`);

    general.increaseVarWithLimit('train', 0, (GameConst as any).maxTrainByCommand - 5);
    general.increaseVarWithLimit('atmos', 0, (GameConst as any).maxAtmosByCommand - 5);

    const exp = 100 * 3;
    const ded = 70 * 3;

    general.addExperience(exp);
    general.addDedication(ded);

    const crew = general.getVar('crew');

    general.addDex(general.getCrewTypeObj(), crew / 100 * 3, false);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);

    general.increaseVar('leadership_exp', 3);
    this.setResultTurn(turnResult);
    general.checkStatChange();
    await StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, BattleStanceCommand, this.env, this.arg ?? {});
    await tryUniqueItemLottery(general.genGenericUniqueRNG(BattleStanceCommand.actionName), general);
    await general.applyDB(db);

    return true;
  }
}
