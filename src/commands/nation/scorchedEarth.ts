// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { generalRepository } from '../../repositories/general.repository';
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

    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.OccupiedDestCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.SuppliedDestCity(),
      ConstraintHelper.ReqNationValue('capital', '수도', '!=', this.destCity['city'], '수도입니다.'),
      ConstraintHelper.ReqNationValue('surlimit', '제한 턴', '==', 0, '외교제한 턴이 남아있습니다.'),
      ConstraintHelper.DisallowDiplomacyStatus(this.generalObj?.getNationID() || 0, { 0: '평시에만 가능합니다.' }),
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

    const sessionId = this.env.session_id || 'sangokushi_default';
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

    // 국가 장수들 경험치 10% 감소 (officer_level >= 5, 자신 제외) - MongoDB
    await generalRepository.multiplyFieldByNation(sessionId, nationID, 'experience', 0.9, { officer_level: { $gte: 5 }, no: { $ne: generalID } });

    // 국가 장수들 betray 1 증가 (자신 제외) - MongoDB
    await generalRepository.incrementFieldByNation(sessionId, nationID, 'betray', 1, generalID);
    general.increaseVar('betray', 1);

    // 도시 초토화 - 복잡한 계산이 필요하므로 직접 계산 후 업데이트
    await this.updateCity(destCityID, {
      trust: Math.max(50, destCity.trust || 0),
      pop: Math.max((destCity.pop_max || 0) * 0.1, (destCity.pop || 0) * 0.2),
      agri: Math.max((destCity.agri_max || 0) * 0.1, (destCity.agri || 0) * 0.2),
      comm: Math.max((destCity.comm_max || 0) * 0.1, (destCity.comm || 0) * 0.2),
      secu: Math.max((destCity.secu_max || 0) * 0.1, (destCity.secu || 0) * 0.2),
      def: Math.max((destCity.def_max || 0) * 0.1, (destCity.def || 0) * 0.2),
      wall: Math.max((destCity.wall_max || 0) * 0.1, (destCity.wall || 0) * 0.5),
      nation: 0,
      front: 0,
      conflict: '{}'
    });

    // 국가 자원 증가 및 aux 업데이트 - MongoDB
    await this.incrementNation(nationID, {
      gold: amount,
      rice: amount,
      surlimit: this.getPostReqTurn()
    });
    await this.updateNation(nationID, { aux: JSON.stringify(aux) });

    const refreshNationStaticInfo = global.refreshNationStaticInfo;
    const SetNationFront = global.SetNationFront;

    if (refreshNationStaticInfo) await refreshNationStaticInfo();
    if (SetNationFront) await SetNationFront(nationID);

    try {
      const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const inheritanceService = new InheritancePointService(sessionId);
      const userId = general.data.owner ?? general.data.user_id ?? general.getID();
      await inheritanceService.recordActivity(userId, InheritanceKey.ACTIVE_ACTION, 1);
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
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
