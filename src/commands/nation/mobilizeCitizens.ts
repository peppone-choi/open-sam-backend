import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { GameConst } from '../../config/game-const';
import { CityConst } from '../../config/city-const';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../utils/action-logger';

export class che_백성동원 extends NationCommand {
  static getName(): string {
    return '백성동원';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;
    if (!('destCityID' in this.arg)) return false;

    if ((CityConst as any).byID(this.arg['destCityID']) === null) return false;

    const destCityID = this.arg['destCityID'];
    this.arg = { destCityID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['strategic_cmd_limit']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      (ConstraintHelper as any).AvailableStrategicCommand()
    ];
  }

  protected initWithArg(): void {
    this.setDestCity(this.arg['destCityID']);
    this.setDestNation(this.destCity['nation']);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.OccupiedCity(),
      (ConstraintHelper as any).AvailableStrategicCommand()
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
    const genCount = Util.valueFit(this!.nation['gennum!'], GameConst.initialNationGenLimit);
    let nextTerm = Util.round(Math.sqrt(genCount * 4) * 10);

    nextTerm = this.generalObj.onCalcStrategic(this.constructor.getName(),  'delay', [nextTerm]);
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const destCityName = (CityConst as any).byID(this.arg['destCityID'])?.name || '';
    return `【${destCityName}】에 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();

    const general = this.generalObj;
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const nationID = (general as any).getNationID();
    const nationName = this!.nation['name'];

    const logger = general!.getLogger();
    logger.pushGeneralActionLog(`백성동원 발동! <1>${date}</>`);

    general!.addExperience(5 * (this.getPreReqTurn() + 1));
    general!.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>백성동원</>을 하였습니다.`;

    const targetGeneralList = await (db as any).queryFirstColumn(
      'SELECT no FROM general WHERE nation=%i AND no != %i',
      nationID,
      generalID
    );
    
    for (const targetGeneralID of targetGeneralList) {
      const targetLogger = new ActionLogger(targetGeneralID, nationID, year, month);
      targetLogger.pushGeneralActionLog(broadcastMessage);
      await targetLogger.flush();
    }

    await db.update('city', {
      def: db.sqleval('GREATEST(def_max * 0.8, def)'),
      wall: db.sqleval('GREATEST(wall_max * 0.8, wall)'),
    },  'city=%i', [destCityID]);

    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>에 <M>백성동원</>을 발동`) as any;
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>백성동원</>을 발동`);

    await db.update('nation', {
      strategic_cmd_limit: this.generalObj.onCalcStrategic(this.constructor.getName(),  'globalDelay', [9])
    },  'nation=%i', [nationID]);

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await general!.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        cities: [],
        distanceList: {},
      },
    };
  }
}
