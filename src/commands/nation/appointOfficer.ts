import '../../utils/function-extensions';
import { generalRepository } from '../../repositories/general.repository';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { General } from '../../models/General';
import { CityConst } from '../../CityConst';
import { Util } from '../../utils/Util';

export class che_발령 extends NationCommand {
  static getName(): string {
    return '발령';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destGeneralID' in this.arg)) return false;
    if (!('destCityID' in this.arg)) return false;

    if (CityConst.byID(this.arg['destCityID']) === null) return false;

    const destGeneralID = this.arg['destGeneralID'];
    const destCityID = this.arg['destCityID'];

    this.arg = { destGeneralID, destCityID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity()
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestCity(this.arg['destCityID']);

    // TODO: Legacy method - const destGeneral = await General.createObjFromDB(this.arg['destGeneralID']);
    // Use generalRepository.findById() instead
    this.setDestGeneral(destGeneral);

    if (this.arg['destGeneralID'] === this.getGeneral()?.getID()) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('본인입니다')
      ];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral(),
      ConstraintHelper.OccupiedDestCity(),
      ConstraintHelper.SuppliedDestCity()
    ];
  }

  public getFailString(): string {
    const commandName = this.constructor.getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destGeneralName = this.destGeneralObj?.getName();
    return `${failReason} <Y>${destGeneralName}</> ${commandName} 실패.`;
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
    const destGeneralName = this.destGeneralObj?.getName();
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name;
    const josaRo = JosaUtil.pick(destCityName || '', '로');
    return `【${destGeneralName}】【${destCityName}】${josaRo} ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();

    const general = this.generalObj;
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const destGeneral = this.destGeneralObj;
    const destGeneralName = destGeneral!.getName();

    const logger = general!.getLogger();

    destGeneral!.setVar('city', destCityID);

    const josaUl = JosaUtil.pick(destGeneralName, '을');
    const josaRo = JosaUtil.pick(destCityName, '로');
    destGeneral!.getLogger().pushGeneralActionLog(
      `<Y>${generalName}</>에 의해 <G><b>${destCityName}</b></>${josaRo} 발령됐습니다. <1>${date}</>`
    );

    const yearMonth = Util.joinYearMonth(this.env['year'], this.env['month']);
    const cutTurn = (time: string, turnterm: number) => {
      const d = new Date(time);
      return Math.floor(d.getTime() / (turnterm * 60 * 1000));
    };

    if (
      cutTurn(general!.getTurnTime(), this.env['turnterm']) !==
      cutTurn(destGeneral!.getTurnTime(), this.env['turnterm'])
    ) {
      const newYearMonth = yearMonth + 1;
      destGeneral!.setAuxVar('last발령', newYearMonth);
    } else {
      destGeneral!.setAuxVar('last발령', yearMonth);
    }

    logger.pushGeneralActionLog(
      `<Y>${destGeneralName}</>${josaUl} <G><b>${destCityName}</b></>${josaRo} 발령했습니다. <1>${date}</>`
    );

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general!.applyDB(db);
    await destGeneral!.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    // TODO: Legacy DB access - const db = DB.db();
    const nationID = this.getNationID();
    const troops = await db.query('SELECT * FROM troop WHERE nation=%i', [nationID]);
    const troopsDict = Util.convertArrayToDict(troops, 'troop_leader');
    const destRawGenerals = await db.queryAllLists(
      'SELECT no,name,officer_level,npc,gold,rice,leadership,strength,intel,city,crew,train,atmos,troop FROM general WHERE nation = %i ORDER BY npc,binary(name)',
      [nationID]
    );

    return {
      procRes: {
        distanceList: await global.JSCitiesBasedOnDistance(
          this.generalObj!.getCityID(),
          1
        ),
        cities: await global.JSOptionsForCities(),
        troops: troopsDict,
        generals: destRawGenerals,
        generalsKey: [
          'no',
          'name',
          'officerLevel',
          'npc',
          'gold',
          'rice',
          'leadership',
          'strength',
          'intel',
          'cityID',
          'crew',
          'train',
          'atmos',
          'troopID'
        ]
      }
    };
  }
}
