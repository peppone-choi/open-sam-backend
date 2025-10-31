import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { ActionLogger } from '../../models/ActionLogger';

export class CounterAttackCommand extends NationCommand {
  static getName(): string {
    return '피장파장';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  static readonly delayCnt = 60;

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destNationID' in this.arg)) return false;
    if (!('commandType' in this.arg)) return false;

    const destNationID = this.arg['destNationID'];
    const commandType = this.arg['commandType'];

    if (typeof destNationID !== 'number') return false;
    if (destNationID < 1) return false;

    if (typeof commandType !== 'string') return false;

    const availableStrategicCommands = (global as any).GameConst?.availableChiefCommand?.['전략'] || [];
    if (!availableStrategicCommands.includes(commandType)) return false;

    if (commandType === 'CounterAttackCommand' || commandType === 'che_피장파장') return false;

    this.arg = { destNationID, commandType };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['strategic_cmd_limit']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief()
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestNation(this.arg['destNationID'], null);

    if (this.getNationID() === 0) {
      this.fullConditionConstraints = [ConstraintHelper.OccupiedCity()];
      return;
    }

    const buildNationCommandClass = (global as any).buildNationCommandClass;
    const cmd = buildNationCommandClass && buildNationCommandClass(this.arg['commandType'], this.generalObj, this.env, new LastTurn());

    const currYearMonth = Util.joinYearMonth(this.env['year'], this.env['month']);
    const nextAvailableTurn = cmd?.getNextAvailableTurn ? cmd.getNextAvailableTurn() : null;

    if (nextAvailableTurn && currYearMonth < nextAvailableTurn) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('해당 전략을 아직 사용할 수 없습니다')
      ];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AvailableStrategicCommand()
    ];
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    const postReqTurn = this.getPostReqTurn();
    return `${name}/${reqTurn}턴(재사용 대기 ${postReqTurn}, 대상 재사용 대기 ${this.getTargetPostReqTurn()})`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 1;
  }

  public getPostReqTurn(): number {
    return 8;
  }

  public getTargetPostReqTurn(): number {
    const genCount = Util.valueFit(this.nation['gennum'], GameConst.initialNationGenLimit);
    let nextTerm = Util.round(Math.sqrt(genCount * 2) * 10);

    if (this.generalObj?.onCalcStrategic) {
      nextTerm = this.generalObj.onCalcStrategic(this.constructor.getName(), 'delay', nextTerm);
    }
    nextTerm = Util.valueFit(nextTerm, Util.round(CounterAttackCommand.delayCnt * 1.2));
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const buildNationCommandClass = (global as any).buildNationCommandClass;
    const cmd = buildNationCommandClass && buildNationCommandClass(this.arg['commandType'], this.generalObj, this.env, new LastTurn());
    const targetCommandName = cmd?.getName ? cmd.getName() : this.arg['commandType'];
    const getNationStaticInfo = (global as any).getNationStaticInfo;
    const destNationName = getNationStaticInfo ? getNationStaticInfo(this.arg['destNationID'])['name'] : '상대국';
    return `【${destNationName}】에 【${targetCommandName}】 ${commandName}`;
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

    const year = this.env['year'];
    const month = this.env['month'];

    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const josaYi = JosaUtil.pick(generalName, '이');
    const commandName = this.constructor.getName();
    const josaUl = JosaUtil.pick(commandName, '을');

    const buildNationCommandClass = (global as any).buildNationCommandClass;
    const cmd = buildNationCommandClass(this.arg['commandType'], this.generalObj, this.env, new LastTurn());

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`<G><b>${cmd.getName()}</b></> 전략의 ${commandName} 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destNationName}</b></>에 <G><b>${cmd.getName()}</b></> 전략의 <M>${commandName}</>${josaUl} 발동하였습니다.`;

    const nationGeneralList = await db.queryFirstColumn('SELECT no FROM general WHERE nation=%i AND no != %i', [nationID, generalID]);
    for (const nationGeneralID of nationGeneralList) {
      const nationGeneralLogger = (ActionLogger as any).create ? 
        (ActionLogger as any).create(nationGeneralID, nationID, year, month) :
        new (ActionLogger as any)(nationGeneralID, nationID, year, month);
      if (nationGeneralLogger.pushGeneralActionLog) {
        nationGeneralLogger.pushGeneralActionLog(broadcastMessage, 0);
      }
      if (nationGeneralLogger.flush) {
        await nationGeneralLogger.flush();
      }
    }

    const josaYiCommand = JosaUtil.pick(commandName, '이');
    const destBroadcastMessage = `아국에 <G><b>${cmd.getName()}</b></> 전략의 <M>${commandName}</>${josaYiCommand} 발동되었습니다.`;

    const destNationGeneralList = await db.queryFirstColumn('SELECT no FROM general WHERE nation=%i', [destNationID]);
    for (const destNationGeneralID of destNationGeneralList) {
      const destNationGeneralLogger = (ActionLogger as any).create ?
        (ActionLogger as any).create(destNationGeneralID, destNationID, year, month) :
        new (ActionLogger as any)(destNationGeneralID, destNationID, year, month);
      if (destNationGeneralLogger.pushGeneralActionLog) {
        destNationGeneralLogger.pushGeneralActionLog(destBroadcastMessage, 0);
      }
      if (destNationGeneralLogger.flush) {
        await destNationGeneralLogger.flush();
      }
    }

    const destNationLogger = (ActionLogger as any).create ?
      (ActionLogger as any).create(0, destNationID, year, month) :
      new (ActionLogger as any)(0, destNationID, year, month);
    if (destNationLogger.pushNationalHistoryLog) {
      destNationLogger.pushNationalHistoryLog(`<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국에 <G><b>${cmd.getName()}</b></> <M>${commandName}</>${josaUl} 발동`);
    }
    if (destNationLogger.flush) {
      await destNationLogger.flush();
    }

    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 <G><b>${cmd.getName()}</b></> <M>${commandName}</>${josaUl} 발동`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <G><b>${cmd.getName()}</b></> <M>${commandName}</>${josaUl} 발동`);

    const KVStorage = (global as any).KVStorage;
    const nationStor = KVStorage?.getStorage ? KVStorage.getStorage(db, nationID, 'nation_env') : null;
    const destNationStor = KVStorage?.getStorage ? KVStorage.getStorage(db, destNationID, 'nation_env') : null;

    const yearMonth = Util.joinYearMonth(this.env['year'], this.env['month']);
    if (nationStor && cmd.getNextExecuteKey) {
      nationStor.setValue(cmd.getNextExecuteKey(), yearMonth + this.getTargetPostReqTurn());
    }

    if (destNationStor && cmd.getNextExecuteKey) {
      const destDelay = Math.max(destNationStor.getValue(cmd.getNextExecuteKey()) ?? 0, yearMonth);
      destNationStor.setValue(cmd.getNextExecuteKey(), destDelay + CounterAttackCommand.delayCnt);
    }

    const StaticEventHandler = (global as any).StaticEventHandler;
    if (StaticEventHandler?.handleEvent) {
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'CounterAttackCommand', this.env, this.arg ?? {});
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj!;
    const nationID = generalObj.getNationID();

    const availableCommandTypeList: any = {};
    const currYearMonth = Util.joinYearMonth(this.env['year'], this.env['month']);

    let oneAvailableCommandName: string | null = null;

    const availableStrategicCommands = (global as any).GameConst?.availableChiefCommand?.['전략'] || [];
    const buildNationCommandClass = (global as any).buildNationCommandClass;

    for (const commandType of availableStrategicCommands) {
      if (commandType === 'CounterAttackCommand' || commandType === 'che_피장파장') {
        continue;
      }

      const cmd = buildNationCommandClass ? buildNationCommandClass(commandType, generalObj, this.env, new LastTurn()) : null;
      const cmdName = cmd?.getName ? cmd.getName() : commandType;
      let remainTurn = 0;
      const nextAvailableTurn = cmd?.getNextAvailableTurn ? cmd.getNextAvailableTurn() : null;

      if (nextAvailableTurn !== null && currYearMonth < nextAvailableTurn) {
        remainTurn = nextAvailableTurn - currYearMonth;
      } else {
        oneAvailableCommandName = cmd?.getRawClassName ? cmd.getRawClassName() : commandType;
      }
      availableCommandTypeList[commandType] = { name: cmdName, remainTurn };
    }

    const nationList = [];
    const getAllNationStaticInfo = (global as any).getAllNationStaticInfo;
    const allNations = getAllNationStaticInfo ? getAllNationStaticInfo() : [];

    for (const destNation of allNations) {
      const nationTarget: any = {
        id: destNation['nation'],
        name: destNation['name'],
        color: destNation['color'],
        power: destNation['power']
      };

      if (oneAvailableCommandName === null) {
        nationTarget['notAvailable'] = true;
      } else if (destNation['nation'] === nationID) {
        nationTarget['notAvailable'] = true;
      } else {
        const testCommand = new CounterAttackCommand(
          generalObj,
          this.env,
          new LastTurn(this.constructor.getName(), null, null),
          {
            destNationID: destNation['nation'],
            commandType: oneAvailableCommandName
          }
        );
        if (!testCommand.hasFullConditionMet()) {
          nationTarget['notAvailable'] = true;
        }
      }

      nationList.push(nationTarget);
    }

    return {
      procRes: {
        nationList,
        startYear: this.env['startyear'],
        delayCnt: CounterAttackCommand.delayCnt,
        postReqTurn: this.getTargetPostReqTurn(),
        availableCommandTypeList
      }
    };
  }
}

export const che_피장파장 = CounterAttackCommand;
