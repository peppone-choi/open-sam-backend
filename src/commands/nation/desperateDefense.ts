// @ts-nocheck - Legacy db usage needs migration to Mongoose
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
      ConstraintHelper.AllowDiplomacyStatus(this.generalObj?.getNationID() || 0, [0], '전쟁중이 아닙니다.'),
      ConstraintHelper.AvailableStrategicCommand('strategic')
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

    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalID = general.getID();
    const generalName = general.data.name || general.name;
    const date = general.getTurnTime('HM');

    const nationID = general.getNationID();
    const nationName = this.nation['name'];

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`필사즉생 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <M>필사즉생</>을 발동하였습니다.`;

    const { generalRepository } = await import('../../repositories/general.repository');
    const sessionId = this.env.session_id || 'sangokushi_default';
    
    const targetGeneralDocs = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': nationID,
      'data.no': { $ne: generalID }
    });

    if (targetGeneralDocs && targetGeneralDocs.length > 0) {
      const { General } = await import('../../models/general.model');
      const targetGenerals = await Promise.all(
        targetGeneralDocs.map(doc => General.createObjFromDB(doc.data?.no, sessionId))
      );
      for (const targetGeneralID in targetGenerals) {
        const targetGeneral = targetGenerals[targetGeneralID];
        const targetLogger = targetGeneral.getLogger();
        if (targetLogger.pushGeneralActionLog) {
          targetLogger.pushGeneralActionLog(broadcastMessage, 0);
        }

        if (targetGeneral.data.train < 100) {
          targetGeneral.data.train = 100;
        }
        if (targetGeneral.data.atmos < 100) {
          targetGeneral.data.atmos = 100;
        }

        await await targetGeneral.save();
      }
    }

    if (general.data.train < 100) {
      general.data.train = 100;
    }
    if (general.data.atmos < 100) {
      general.data.atmos = 100;
    }

    logger.pushGeneralHistoryLog('<M>필사즉생</>을 발동');
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <M>필사즉생</>을 발동`);
    logger.pushGlobalHistoryLog(`<R><b>【결사】</b></><D><b>${nationName}</b></>${josaYi} <M>필사즉생</>을 발동하여 전군의 사기를 끌어올렸습니다.`);

    const globalDelay = this.generalObj?.onCalcStrategic ?
      this.generalObj.onCalcStrategic(this.constructor.getName(), 'globalDelay', 9) : 9;

    await db.update(
      'nation',
      { strategic_cmd_limit: globalDelay },
      'nation=%i',
      [nationID]
    );

    const StaticEventHandler = global.StaticEventHandler;
    if (StaticEventHandler?.handleEvent) {
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'DesperateDefenseCommand', this.env, this.arg ?? {});
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await await this.saveGeneral();

    return true;
  }
}

export const che_필사즉생 = DesperateDefenseCommand;
