// @ts-nocheck - Legacy db usage needs migration to Mongoose
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { CityConst } from '../../CityConst';
import { Util } from '../../utils/Util';

export class ScorchedEarthCommand extends NationCommand {
  static getName(): string {
    return '초토화';
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
    this.setNation(['surlimit', 'gold', 'rice', 'capital', 'aux']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqNationValue('surlimit', '제한 턴', '==', 0, '외교제한 턴이 남아있습니다.')
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestCity(this.arg['destCityID']);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.OccupiedDestCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.SuppliedDestCity(),
      ConstraintHelper.ReqNationValue('capital', '수도', '!=', this.destCity['city'], '수도입니다.'),
      ConstraintHelper.ReqNationValue('surlimit', '제한 턴', '==', 0, '외교제한 턴이 남아있습니다.')
    ];
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    return `${name}/${reqTurn}턴(공백지화, 금쌀 회수, 수뇌진 명성하락)`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 2;
  }

  public getPostReqTurn(): number {
    return 24;
  }

  public async getNextAvailableTurn(): Promise<number | null> {
    return null;
  }

  public async setNextAvailable(yearMonth?: number | null): Promise<void> {
    return;
  }

  public getBrief(): string {
    const commandName = this.constructor.getName();
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name;
    const josaUl = JosaUtil.pick(destCityName || '', '을');
    return `【${destCityName}】${josaUl} ${commandName}`;
  }

  public calcReturnAmount(destCity: any): number {
    let amount = destCity['pop'] / 5;
    for (const cityRes of ['agri', 'comm', 'secu']) {
      const cityResMax = `${cityRes}_max`;
      amount *= ((destCity[cityRes] - destCity[cityResMax] * 0.5) / destCity[cityResMax]) + 0.8;
    }
    return Math.floor(amount);
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

        if (!this.destCity) {
      throw new Error('대상 도시 정보가 없습니다');
    }
    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const nationID = general.getNationID();
    const nationName = this.nation['name'];

    const josaUl = JosaUtil.pick(destCityName, '을');

    const logger = general.getLogger();

    general.addExperience(-general.data.experience * 0.1, false);
    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const amount = this.calcReturnAmount(destCity);
    const aux = this.nation['aux'] || {};

    const NationAuxKey = global.NationAuxKey;
    if (destCity['level'] >= 8) {
      const key = NationAuxKey?.did_특성초토화?.value ?? 'did_특성초토화';
      aux[key] = (aux[key] ?? 0) + 1;
    }

    await db.update(
      'general',
      { experience: db.sqleval('experience * 0.9') },
      'nation = %i AND officer_level >= 5 AND no!=%i',
      [nationID, generalID]
    );

    await db.update(
      'general',
      { betray: db.sqleval('betray + 1') },
      'nation = %i AND no!=%i',
      [nationID, generalID]
    );
    general.increaseVar('betray', 1);

    await db.update(
      'city',
      {
        trust: db.sqleval('greatest(50, trust)'),
        pop: db.sqleval('greatest(pop_max*0.1, pop*0.2)'),
        agri: db.sqleval('greatest(agri_max*0.1, agri*0.2)'),
        comm: db.sqleval('greatest(comm_max*0.1, comm*0.2)'),
        secu: db.sqleval('greatest(secu_max*0.1, secu*0.2)'),
        def: db.sqleval('greatest(def_max*0.1, def*0.2)'),
        wall: db.sqleval('greatest(wall_max*0.1, wall*0.5)'),
        nation: 0,
        front: 0,
        conflict: '{}'
      },
      'city=%i',
      [destCityID]
    );

    await db.update(
      'nation',
      {
        gold: db.sqleval('gold + %i', amount),
        rice: db.sqleval('rice + %i', amount),
        surlimit: db.sqleval('surlimit + %i', this.getPostReqTurn()),
        aux: JSON.stringify(aux)
      },
      'nation=%i',
      [nationID]
    );

    const refreshNationStaticInfo = global.refreshNationStaticInfo;
    const SetNationFront = global.SetNationFront;

    if (refreshNationStaticInfo) await refreshNationStaticInfo();
    if (SetNationFront) await SetNationFront(nationID);

    const InheritanceKey = global.InheritanceKey;
    if (general.increaseInheritancePoint && InheritanceKey?.active_action) {
      // TODO: general.increaseInheritancePoint(InheritanceKey.active_action, 1);
    }

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>${josaUl} 초토화했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>${josaUl} <M>초토화</> 명령 <1>${date}</>`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>초토화</> 명령`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>초토화</>하였습니다.`);
    logger.pushGlobalHistoryLog(`<S><b>【초토화】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>${josaUl} <M>초토화</>하였습니다.`);

    const StaticEventHandler = global.StaticEventHandler;
    if (StaticEventHandler?.handleEvent) {
      StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, 'ScorchedEarthCommand', this.env, this.arg ?? {});
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

export const che_초토화 = ScorchedEarthCommand;