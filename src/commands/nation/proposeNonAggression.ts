import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';

export class che_불가침제의 extends NationCommand {
  static getName(): string {
    return '불가침 제의';
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

    if (!('year' in this.arg) || !('month' in this.arg)) return false;
    const year = this.arg['year'];
    const month = this.arg['month'];
    if (typeof year !== 'number' || typeof month !== 'number') return false;

    if (month < 1 || month > 12) return false;
    if (year < this.env['startyear']) return false;

    this.arg = { destNationID, year, month };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestNation(this.arg['destNationID'], null);

    const year = this.arg['year'];
    const month = this.arg['month'];
    const env = this.env;

    const currentMonth = env['year'] * 12 + env['month'] - 1;
    const reqMonth = year * 12 + month - 1;

    if (reqMonth < currentMonth + 6) {
      this.permissionConstraints = [
        ConstraintHelper.AlwaysFail('기한은 6개월 이상이어야 합니다.')
      ];
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('기한은 6개월 이상이어야 합니다.')
      ];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.DifferentDestNation(),
      ConstraintHelper.DisallowDiplomacyBetweenStatus({
        0: '아국과 이미 교전중입니다.',
        1: '아국과 이미 선포중입니다.',
      }),
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
    const year = this.arg['year'];
    const month = this.arg['month'];
    return `【${destNationName}】에게 ${year}년 ${month}월까지 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];
    const josaRo = JosaUtil.pick(nationName, '로');

    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const year = this.arg['year'];
    const month = this.arg['month'];

    const logger = general!.getLogger();
    const destLogger = new (ActionLogger as any)(0, destNationID, env['year'], env['month']);

    logger.pushGeneralActionLog(`<D><b>${destNationName}</b></>${josaRo} 불가침 제의 서신을 보냈습니다.<1>${date}</>`);

    const { GetImageURL } = await import('../../func');

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

    const now = new Date(date);
    const validUntil = new Date(date);
    const validMinutes = Math.max(30, env['turnterm'] * 3);
    validUntil.setMinutes(validUntil.getMinutes() + validMinutes);

    const josaWa = JosaUtil.pick(nationName, '와');

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general!.applyDB(db);
    await destLogger.flush();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const testTurn = new LastTurn(this.constructor.getName(), null, this.getPreReqTurn());
    const currYear = this.env['year'];
    const getAllNationStaticInfo = (global as any).getAllNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      const testCommand = new (this.constructor as any)(
        generalObj,
        this.env,
        testTurn,
        {
          destNationID: destNation['nation'],
          year: currYear + 2,
          month: 1
        }
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
        startYear: this.env['startyear'],
        minYear: this.env['year'] + 1,
        maxYear: this.env['year'] + 20,
        month: this.env['month'],
      }
    };
  }
}
