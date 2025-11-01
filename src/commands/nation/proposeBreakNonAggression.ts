import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';

export class che_불가침파기제의 extends NationCommand {
  static getName(): string {
    return '불가침 파기 제의';
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

    this.minConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestNation(this.arg['destNationID'], null);

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.AllowDiplomacyBetweenStatus([7], '불가침 중인 상대국에게만 가능합니다.'),
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
    return `【${destNationName}】에게 ${commandName}`;
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

    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];
    const josaRo = JosaUtil.pick(destNationName, '로');

    const logger = general!.getLogger();
    const destLogger = new (ActionLogger as any)(0, destNationID, env['year'], env['month']);

    logger.pushGeneralActionLog(`<D><b>${destNationName}</b></>${josaRo} 불가침 파기 제의 서신을 보냈습니다.<1>${date}</>`);

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

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general!.applyDB(db);
    await destLogger.flush();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj!.getNationID();
    const nationList = [];
    const db = DB.db();
    const getAllNationStaticInfo = (global as any).getAllNationStaticInfo;

    const diplomacyStatus: Record<number, any> = {};
    const diplomacyRows = await db.query('SELECT * FROM diplomacy WHERE me = %i', [nationID]);
    for (const row of diplomacyRows) {
      diplomacyStatus[row.you] = row;
    }

    for (const destNation of getAllNationStaticInfo()) {
      const nationTarget: any = {
        id: destNation['nation'],
        name: destNation['name'],
        color: destNation['color'],
        power: destNation['power']
      };

      if (!diplomacyStatus[destNation['nation']]) {
        nationTarget['notAvailable'] = true;
        nationList.push(nationTarget);
        continue;
      }

      if (diplomacyStatus[destNation['nation']]['state'] !== 7) {
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
      }
    };
  }
}
