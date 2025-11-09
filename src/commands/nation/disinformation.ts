// @ts-nocheck - Legacy db usage needs migration to Mongoose
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { CityConst } from '../../CityConst';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { General } from '../../models/General';
import { ActionLogger } from '../../models/ActionLogger';

export class DisinformationCommand extends NationCommand {
  static getName(): string {
    return '허보';
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
    if (CityConst.byID(this.arg['destCityID']) === null) return false;

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
      ConstraintHelper.AvailableStrategicCommand('strategic')
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestCity(this.arg['destCityID']);
    this.setDestNation(this.destCity['nation']);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotOccupiedDestCity(),
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
    return 1;
  }

  public getPostReqTurn(): number {
    const genCount = Util.valueFit(this.nation['gennum'], GameConst.initialNationGenLimit);
    let nextTerm = Util.round(Math.sqrt(genCount * 4) * 10);

    if (this.generalObj?.onCalcStrategic) {
      nextTerm = this.generalObj.onCalcStrategic(this.constructor.getName(), 'delay', nextTerm);
    }
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name;
    return `【${destCityName}】에 ${commandName}`;
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

    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const destNationID = destCity['nation'];
    const getNationStaticInfo = global.getNationStaticInfo;
    const destNationName = getNationStaticInfo ? getNationStaticInfo(destNationID)['name'] : '상대국';

    const nationID = general.getNationID();
    const nationName = this.nation['name'];

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`허보 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>허보</>를 발동하였습니다.`;

    const targetGeneralList = await db.queryFirstColumn('SELECT no FROM general WHERE nation=%i AND no != %i', [nationID, generalID]);
    for (const targetGeneralID of targetGeneralList) {
      const targetLogger = ActionLogger.create ?
        ActionLogger.create(targetGeneralID, nationID, year, month) :
        new ActionLogger(targetGeneralID, nationID, year, month);
      if (targetLogger.pushGeneralActionLog) {
        targetLogger.pushGeneralActionLog(broadcastMessage, 0);
      }
      if (targetLogger.flush) {
        await targetLogger.flush();
      }
    }

    const destBroadcastMessage = `상대의 <M>허보</>에 당했다! <1>${date}</>`;
    const destNationCityList = await db.queryFirstColumn('SELECT city FROM city WHERE nation = %i AND supply = 1', [destNationID]);

    const targetGeneralListInCity = await db.queryFirstColumn('SELECT no FROM general WHERE nation=%i AND city=%i', [destNationID, destCityID]);
    // TODO: Legacy method - const createObjListFromDB = General.createObjListFromDB;

    if (createObjListFromDB) {
      const targetGenerals = await createObjListFromDB(targetGeneralListInCity);
      for (const targetGeneralID in targetGenerals) {
        const targetGeneral = targetGenerals[targetGeneralID];
        const targetLogger = targetGeneral.getLogger();
        if (targetLogger.pushGeneralActionLog) {
          targetLogger.pushGeneralActionLog(destBroadcastMessage, 0);
        }

        let moveCityID = rng.choice(destNationCityList);
        if (moveCityID === destCityID) {
          moveCityID = rng.choice(destNationCityList);
        }

        targetGeneral.setVar('city', moveCityID);
        await await targetGeneral.save();
      }
    }

    const destNationLogger = ActionLogger.create ?
      ActionLogger.create(0, destNationID, year, month) :
      new ActionLogger(0, destNationID, year, month);
    if (destNationLogger.pushNationalHistoryLog) {
      destNationLogger.pushNationalHistoryLog(
        `<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국의 <G><b>${destCityName}</b></>에 <M>허보</>를 발동`,
        0
      );
    }
    if (destNationLogger.flush) {
      await destNationLogger.flush();
    }

    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>에 <M>허보</>를 발동`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>허보</>를 발동`);

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
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'DisinformationCommand', this.env, this.arg ?? {});
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await await general.save();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const JSOptionsForCities = global.JSOptionsForCities;

    return {
      procRes: {
        cities: JSOptionsForCities ? await JSOptionsForCities() : [],
        distanceList: {}
      }
    };
  }
}

export const che_허보 = DisinformationCommand;
