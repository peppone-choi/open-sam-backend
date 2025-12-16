// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { generalRepository } from '../../repositories/general.repository';
import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { Util } from '../../utils/Util';

export class DriveTigerCommand extends NationCommand {
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
      ConstraintHelper.AvailableStrategicCommand('strategic')
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
    return 0;
  }

  public getPostReqTurn(): number {
    const genCount = Util.valueFit(this.nation['gennum'], 1);
    let nextTerm = Util.round(Math.sqrt(genCount * 16) * 10);

    nextTerm = this.generalObj.onCalcStrategic(this.constructor.getName(), 'delay', nextTerm);
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const getNationStaticInfo = global.getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])?.['name'] || '알 수 없음';
    return `【${destNationName}】에 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const env = this.env;

    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

        if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

        if (!this.destNation) {
      throw new Error('대상 국가 정보가 없습니다');
    }
    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const commandName = this.constructor.getName();
    const josaUl = JosaUtil.pick(commandName, '을');

    const logger = general!.getLogger();
    logger.pushGeneralActionLog(`${commandName} 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동하였습니다.`;

    // 국가 장수 목록 조회 (MongoDB)
    const sessionId = this.env.session_id || 'sangokushi_default';
    const nationGeneralDocs = await generalRepository.findByNation(sessionId, nationID);
    const nationGeneralList = nationGeneralDocs.filter((g: any) => (g.no ?? g.data?.no) !== generalID).map((g: any) => g.no ?? g.data?.no);
    for (const nationGeneralID of nationGeneralList) {
      const nationGeneralLogger = ActionLogger.create ? 
        ActionLogger.create(nationGeneralID as number, nationID, year, month) :
        new ActionLogger(nationGeneralID as number, nationID, year, month);
      nationGeneralLogger.pushGeneralActionLog(broadcastMessage, 0);
      await nationGeneralLogger.flush();
    }

    const broadcastMessageDest = `<D><b>${nationName}</b></>${josaYiNation} 아국에 <M>${commandName}</>${josaUl} 발동하였습니다.`;

    // 적국 장수 목록 조회 (MongoDB)
    const destNationGeneralDocs = await generalRepository.findByNation(sessionId, destNationID);
    const destNationGeneralList = destNationGeneralDocs.map((g: any) => g.no ?? g.data?.no);
    for (const destNationGeneralID of destNationGeneralList) {
      const destNationGeneralLogger = ActionLogger.create ? 
        ActionLogger.create(destNationGeneralID as number, destNationID, year, month) :
        new ActionLogger(destNationGeneralID as number, destNationID, year, month);
      destNationGeneralLogger.pushGeneralActionLog(broadcastMessageDest, 0); // PLAIN
      await destNationGeneralLogger.flush();
    }

    const destNationLogger = ActionLogger.create ? 
      ActionLogger.create(0, destNationID, year, month) :
      new ActionLogger(0, destNationID, year, month);
    destNationLogger.pushNationalHistoryLog(
      `<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국에 <M>${commandName}</>${josaUl} 발동`
    );
    await destNationLogger.flush();

    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동 <1>${date}</>`);
    logger.pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <M>${commandName}</>${josaUl} 발동`
    );

    // 국가 전략 명령 제한 업데이트 (CQRS 패턴)
    await this.updateNation(nationID, {
      strategic_cmd_limit: this.generalObj.onCalcStrategic(this.constructor.getName(), 'globalDelay', 9)
    });

    // 외교 상태 업데이트 (CQRS 패턴)
    const diplomacy = await diplomacyRepository.findByNations(sessionId, nationID, destNationID);
    const newTerm = diplomacy && (diplomacy as any).state === 0 ? 3 : ((diplomacy as any)?.term || 0) + 3;
    await this.updateDiplomacy(nationID, destNationID, { term: newTerm, state: 1 });

    const SetNationFront = global.SetNationFront;
    if (SetNationFront) {
        await SetNationFront(nationID);
        await SetNationFront(destNationID);
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await this.saveGeneral();

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const testTurn = new LastTurn(this.constructor.getName(), null, this.getPreReqTurn());
    const getAllNationStaticInfo = global.getAllNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      testTurn.setArg({ destNationID: destNation['nation'] });
      const testCommand = new DriveTigerCommand(generalObj, this.env, testTurn, {
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

export const che_이호경식 = DriveTigerCommand;
