import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { Util } from '../../utils/Util';

export class che_이호경식 extends NationCommand {
  static getName(): string {
    return '이호경식';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destNationID' in this.arg)) return false;

    const destNationID = this.arg['destNationID'];

    if (typeof destNationID !== 'number') return false;
    if (destNationID < 1) return false;

    this.arg = { destNationID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['strategic_cmd_limit']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.AvailableStrategicCommand()
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestNation(this.arg['destNationID'], null);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.DisallowDiplomacyBetweenStatus({
        2: '선포, 전쟁중인 상대국에게만 가능합니다.',
        3: '선포, 전쟁중인 상대국에게만 가능합니다.',
        7: '선포, 전쟁중인 상대국에게만 가능합니다.'
      }),
      ConstraintHelper.AvailableStrategicCommand()
    ];
  }

  public getCommandDetailTitle(): string {
    const name = che_이호경식.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    const postReqTurn = this.getPostReqTurn();

    return `${name}/${reqTurn}턴(재사용 대기 ${postReqTurn})`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    const genCount = Util.valueFit(this.nation['gennum'], 1);
    let nextTerm = Util.round(Math.sqrt(genCount * 16) * 10);

    nextTerm = this.generalObj!.onCalcStrategic(che_이호경식.getName(), 'delay', nextTerm);
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = che_이호경식.getName();
    const getNationStaticInfo = (global as any).getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])?.['name'] || '알 수 없음';
    return `【${destNationName}】에 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const commandName = che_이호경식.getName();
    const josaUl = JosaUtil.pick(commandName, '을');

    const logger = general!.getLogger();
    logger.pushGeneralActionLog(`${commandName} 발동! <1>${date}</>`);

    general!.addExperience(5 * (this.getPreReqTurn() + 1));
    general!.addDedication(5 * (this.getPreReqTurn() + 1));

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동하였습니다.`;

    const nationGeneralList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation=%i AND no != %i',
      [nationID, generalID]
    );
    for (const nationGeneralID of nationGeneralList) {
      const nationGeneralLogger = new ActionLogger(nationGeneralID as number, nationID, year, month);
      nationGeneralLogger.pushGeneralActionLog(broadcastMessage, ActionLogger.PLAIN);
      await nationGeneralLogger.flush();
    }

    const broadcastMessageDest = `<D><b>${nationName}</b></>${josaYiNation} 아국에 <M>${commandName}</>${josaUl} 발동하였습니다.`;

    const destNationGeneralList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation=%i',
      [destNationID]
    );
    for (const destNationGeneralID of destNationGeneralList) {
      const destNationGeneralLogger = new ActionLogger(destNationGeneralID as number, destNationID, year, month);
      destNationGeneralLogger.pushGeneralActionLog(broadcastMessageDest, ActionLogger.PLAIN);
      await destNationGeneralLogger.flush();
    }

    const destNationLogger = new ActionLogger(0, destNationID, year, month);
    (destNationLogger as any).pushNationalHistoryLog(
      `<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국에 <M>${commandName}</>${josaUl} 발동`
    );
    await destNationLogger.flush();

    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동`);
    (logger as any).pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동`
    );

    await db.update(
      'nation',
      {
        strategic_cmd_limit: this.generalObj!.onCalcStrategic(che_이호경식.getName(), 'globalDelay', 9)
      },
      'nation=%i',
      [nationID]
    );

    await db.update(
      'diplomacy',
      {
        term: db.sqleval('IF(`state`=0, %i, `term`+ %i)', [3, 3]),
        state: 1
      },
      '(me = %i AND you = %i) OR (you = %i AND me = %i)',
      [nationID, destNationID, nationID, destNationID]
    );

    const SetNationFront = (global as any).SetNationFront;
    await SetNationFront(nationID);
    await SetNationFront(destNationID);

    this.setResultTurn(new LastTurn(che_이호경식.getName(), this.arg));
    await general!.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const testTurn = new LastTurn(che_이호경식.getName(), null, this.getPreReqTurn());
    const getAllNationStaticInfo = (global as any).getAllNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      (testTurn as any).setArg({ destNationID: destNation['nation'] });
      const testCommand = new che_이호경식(generalObj, this.env, testTurn, {
        destNationID: destNation['nation']
      });

      const nationTarget: any = {
        id: destNation['nation'],
        name: destNation['name'],
        color: destNation['color'],
        power: destNation['power']
      };

      if (!testCommand.hasFullConditionMet()) {
        nationTarget['notAvailable'] = true;
      }
      if (destNation['nation'] === nationID) {
        nationTarget['notAvailable'] = true;
      }

      nationList.push(nationTarget);
    }

    return {
      procRes: {
        nationList,
        startYear: this.env['startyear']
      }
    };
  }
}
