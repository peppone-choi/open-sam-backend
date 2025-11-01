import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { General } from '../../models/General';
import { ActionLogger } from '../../models/ActionLogger';

export class DesperateDefenseCommand extends NationCommand {
  static getName(): string {
    return '필사즉생';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return false;
  }

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['strategic_cmd_limit']);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.AvailableStrategicCommand()
    ];
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    const postReqTurn = this.getPostReqTurn();
    return `${name}/${reqTurn}턴(재사용 대기 ${postReqTurn})`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 2;
  }

  public getPostReqTurn(): number {
    const genCount = Util.valueFit(this.nation['gennum'], GameConst.initialNationGenLimit);
    let nextTerm = Util.round(Math.sqrt(genCount * 8) * 10);

    if (this.generalObj?.onCalcStrategic) {
      nextTerm = this.generalObj.onCalcStrategic(this.constructor.getName(), 'delay', nextTerm);
    }
    return nextTerm;
  }

  public getBrief(): string {
    return this.constructor.getName();
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();

    const general = this.generalObj!;
    const generalID = general.getID();
    const generalName = general.getName();
    const date = general.getTurnTime('HM');

    const nationID = general.getNationID();
    const nationName = this.nation['name'];

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`필사즉생 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <M>필사즉생</>을 발동하였습니다.`;

    const targetGeneralList = await db.queryFirstColumn('SELECT no FROM general WHERE nation=%i AND no != %i', [nationID, generalID]);
    const createObjListFromDB = (General as any).createObjListFromDB;

    if (createObjListFromDB) {
      const targetGenerals = await createObjListFromDB(targetGeneralList);
      for (const targetGeneralID in targetGenerals) {
        const targetGeneral = targetGenerals[targetGeneralID];
        const targetLogger = targetGeneral.getLogger();
        if (targetLogger.pushGeneralActionLog) {
          targetLogger.pushGeneralActionLog(broadcastMessage, 0);
        }

        if (targetGeneral.getVar('train') < 100) {
          targetGeneral.setVar('train', 100);
        }
        if (targetGeneral.getVar('atmos') < 100) {
          targetGeneral.setVar('atmos', 100);
        }

        await targetGeneral.applyDB(db);
      }
    }

    if (general.getVar('train') < 100) {
      general.setVar('train', 100);
    }
    if (general.getVar('atmos') < 100) {
      general.setVar('atmos', 100);
    }

    logger.pushGeneralHistoryLog('<M>필사즉생</>을 발동');
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <M>필사즉생</>을 발동`);

    const globalDelay = this.generalObj?.onCalcStrategic ?
      this.generalObj.onCalcStrategic(this.constructor.getName(), 'globalDelay', 9) : 9;

    await db.update(
      'nation',
      { strategic_cmd_limit: globalDelay },
      'nation=%i',
      [nationID]
    );

    const StaticEventHandler = (global as any).StaticEventHandler;
    if (StaticEventHandler?.handleEvent) {
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'DesperateDefenseCommand', this.env, this.arg ?? {});
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await general.applyDB(db);

    return true;
  }
}

export const che_필사즉생 = DesperateDefenseCommand;
