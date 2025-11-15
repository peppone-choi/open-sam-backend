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
import { GameBalance } from '../../common/constants/game-balance';

export class PopulationMoveCommand extends NationCommand {
  static getName(): string {
    return '인구이동';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  static readonly AMOUNT_LIMIT = 100000;

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destCityID' in this.arg)) return false;
    if (CityConst.byID(this.arg['destCityID']) === null) return false;

    const destCityID = this.arg['destCityID'];

    if (!('amount' in this.arg)) return false;

    let amount = this.arg['amount'];
    if (typeof amount !== 'number') return false;

    amount = Math.floor(amount);
    if (amount > PopulationMoveCommand.AMOUNT_LIMIT) {
      amount = PopulationMoveCommand.AMOUNT_LIMIT;
    }
    if (amount < 0) return false;

    this.arg = { destCityID, amount };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gold', 'rice']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqCityCapacity('pop', '주민', GameBalance.minAvailableRecruitPop + 100)
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestCity(this.arg['destCityID']);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.NotSameDestCity(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqCityCapacity('pop', '주민', GameBalance.minAvailableRecruitPop + 100),
      ConstraintHelper.OccupiedDestCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.SuppliedDestCity(),
      ConstraintHelper.ReqNationGold(GameBalance.baseGold + reqGold),
      ConstraintHelper.ReqNationRice(GameBalance.baseRice + reqRice)
    ];
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const amount = (this.env['develcost'] || 24).toLocaleString();
    return `${name}(금쌀 ${amount}×인구[만])`;
  }

  public getCost(): [number, number] {
    const amount = Util.round((this.env['develcost'] || 24) * this.arg['amount'] / 10000);
    return [amount, amount];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name;
    const josaRo = JosaUtil.pick(destCityName || '', '로');
    const amount = this.arg['amount'].toLocaleString();
    return `【${destCityName}】${josaRo} ${amount}명 ${commandName}`;
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
    const date = general.getTurnTime('HM');

    const srcCity = this.city;
    const srcCityID = srcCity['city'];

        if (!this.destCity) {
      throw new Error('대상 도시 정보가 없습니다');
    }
    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    let amount = this.arg['amount'];
    amount = Util.clamp(amount, 0, this.city['pop'] - GameBalance.minAvailableRecruitPop);

    const josaRo = JosaUtil.pick(destCityName, '로');

    const logger = general.getLogger();

    general.addExperience(5);
    general.addDedication(5);

    await db.update(
      'city',
      { pop: db.sqleval('pop + %i', amount) },
      'city=%i',
      [destCityID]
    );

    await db.update(
      'city',
      { pop: db.sqleval('pop - %i', amount) },
      'city=%i',
      [srcCityID]
    );

    const [reqGold, reqRice] = this.getCost();
    await db.update(
      'nation',
      {
        gold: db.sqleval('gold - %i', reqGold),
        rice: db.sqleval('rice - %i', reqRice)
      },
      'nation=%i',
      [this.nation['nation']]
    );

    logger.pushGeneralActionLog(
      `<G><b>${destCityName}</b></>${josaRo} 인구 <C>${amount}</>명을 옮겼습니다. <1>${date}</>`
    );

    logger.pushNationalHistoryLog(`<G><b>${destCityName}</b></>${josaRo} 인구 ${amount}명 이동`);

    const StaticEventHandler = global.StaticEventHandler;
    if (StaticEventHandler?.handleEvent) {
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'PopulationMoveCommand', this.env, this.arg ?? {});
    }

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const JSOptionsForCities = global.JSOptionsForCities;
    const JSCitiesBasedOnDistance = global.JSCitiesBasedOnDistance;

    return {
      procRes: {
        cities: JSOptionsForCities ? await JSOptionsForCities() : [],
        distanceList: JSCitiesBasedOnDistance ? 
          await JSCitiesBasedOnDistance(this.generalObj.getCityID(), 1) : {}
      }
    };
  }
}

export const cr_인구이동 = PopulationMoveCommand;