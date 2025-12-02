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
import { ActionLogger } from '../../models/ActionLogger';

export class FloodCommand extends NationCommand {
  static getName(): string {
    return '수몰';
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
      ConstraintHelper.NotNeutralDestCity(),
      ConstraintHelper.NotOccupiedDestCity(),
      ConstraintHelper.BattleGroundCity(),
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
    let nextTerm = Util.round(Math.sqrt(genCount * 4) * 10);

    if (this.generalObj?.onCalcStrategic) {
      nextTerm = this.generalObj.onCalcStrategic(this.constructor.getName(), 'delay', nextTerm);
    }
    return nextTerm;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name;
    const josaUl = JosaUtil.pick(destCityName || '', '을');
    return `【${destCityName}】${josaUl} ${commandName}`;
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

    const year = this.env['year'];
    const month = this.env['month'];

        if (!this.destCity) {
      throw new Error('대상 도시 정보가 없습니다');
    }
    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const destNationID = destCity['nation'];
    const getNationStaticInfo = global.getNationStaticInfo;
    const destNationName = getNationStaticInfo ? getNationStaticInfo(destNationID)['name'] : '상대국';

    const nationID = general.getNationID();
    const nationName = this.nation['name'];

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`수몰 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');

    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>수몰</>을 발동하였습니다.`;

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

    const destBroadcastMessage = `<G><b>${destCityName}</b></>에 <M>수몰</>이 발동되었습니다.`;

    const destTargetGeneralList = await db.queryFirstColumn('SELECT no FROM general WHERE nation=%i', [destNationID]);
    let destNationLogged = false;
    for (const targetGeneralID of destTargetGeneralList) {
      const targetLogger = ActionLogger.create ?
        ActionLogger.create(targetGeneralID, destNationID, year, month) :
        new ActionLogger(targetGeneralID, destNationID, year, month);
      if (targetLogger.pushGeneralActionLog) {
        targetLogger.pushGeneralActionLog(destBroadcastMessage, 0);
      }
      if (!destNationLogged && targetLogger.pushNationalHistoryLog) {
        targetLogger.pushNationalHistoryLog(
          `<D><b>${nationName}</b></>의 <Y>${generalName}</>${josaYi} 아국의 <G><b>${destCityName}</b></>에 <M>수몰</>을 발동`,
          0
        );
        destNationLogged = true;
      }
      if (targetLogger.flush) {
        await targetLogger.flush();
      }
    }

    await db.update(
      'city',
      {
        def: db.sqleval('def * 0.2'),
        wall: db.sqleval('wall * 0.2')
      },
      'city=%i',
      [destCityID]
    );

    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>에 <M>수몰</>을 발동 <1>${date}</>`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>수몰</>을 발동`);
    const josaYiNation = JosaUtil.pick(nationName, '이');
    logger.pushGlobalHistoryLog(`<M><b>【수공】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>에 <M>수몰</>을 발동하였습니다.`);

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
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'FloodCommand', this.env, this.arg ?? {});
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await await this.saveGeneral();

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

export const che_수몰 = FloodCommand;
