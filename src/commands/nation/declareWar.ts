import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';

export class che_선전포고 extends NationCommand {
  static getName(): string {
    return '선전포고';
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
    this.setNation();

    const startYear = this.env['startyear'];
    this.minConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqEnvValue('year', '>=', startYear + 1, '초반제한 해제 2년전부터 가능합니다.')
    ];
  }

  protected async initWithArg(): Promise<void> {
    const startYear = this.env['startyear'];

    this.setDestNation(this.arg['destNationID'], null);

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqEnvValue('year', '>=', startYear + 1, '초반제한 해제 2년전부터 가능합니다.'),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.NearNation(),
      ConstraintHelper.DisallowDiplomacyBetweenStatus({
        0: '아국과 이미 교전중입니다.',
        1: '아국과 이미 선포중입니다.',
        7: '불가침국입니다.'
      })
    ];
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

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const getNationStaticInfo = (global as any).getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])['name'];
    return `【${destNationName}】에 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();

    const general = this.generalObj;
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const logger = general!.getLogger();
    const destLogger = (ActionLogger as any);

    logger.pushGeneralActionLog(`<D><b>${destNationName}</b></>에 선전 포고 했습니다.<1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 선전 포고`);
    (logger as any).pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 선전 포고`
    );
    (destLogger as any).pushNationalHistoryLog(
      `<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국에 선전 포고`
    );

    logger.pushGlobalActionLog(
      `<Y>${generalName}</>${josaYi} <D><b>${destNationName}</b></>에 <M>선전 포고</> 하였습니다.`
    );
    logger.pushGlobalHistoryLog(
      `<R><b>【선포】</b></><D><b>${nationName}</b></>${josaYiNation} <D><b>${destNationName}</b></>에 선전 포고 하였습니다.`
    );

    await db.update(
      'diplomacy',
      { state: 1, term: 24 },
      '(me=%i AND you=%i) OR (me=%i AND you=%i)',
      [nationID, destNationID, destNationID, nationID]
    );

    const { Message } = await import('../../models/Message');
    const { MessageTarget } = await import('../../models/Message');
    const { GetImageURL } = await import('../../func');

    const text = `【외교】${this.env['year']}년 ${this.env['month']}월:${nationName}에서 ${destNationName}에 선전포고`;

    const src = {
      id: general!.getID(),
      name: general!.getName(),
      nationID: nationID,
      nationName: nationName,
      color: nation['color'],
      image: GetImageURL(general!.getVar('imgsvr'), general!.getVar('picture'))
    };

    const dest = {
      id: 0,
      name: '',
      nationID: destNationID,
      nationName: destNationName,
      color: destNation['color']
    };

    const msg = new Message();
    await Message.send(src, dest, text, new Date(general!.getTurnTime()), new Date('9999-12-31'), []);

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general!.applyDB(db);
    await (ActionLogger as any).flush();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const testTurn = new LastTurn(this.constructor.getName(), null, this.getPreReqTurn());
    const getAllNationStaticInfo = (global as any).getAllNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      (testTurn as any).setArg({ destNationID: destNation['nation'] });
      const testCommand = new (this.constructor as any)(
        generalObj,
        this.env,
        testTurn,
        { destNationID: destNation['nation'] }
      );

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
