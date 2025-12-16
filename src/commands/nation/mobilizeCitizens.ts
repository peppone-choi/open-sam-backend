// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';
import { GameConst } from '../../config/game-const';
import { CityConst } from '../../config/city-const';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../utils/action-logger';
import { generalRepository } from '../../repositories/general.repository';

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
      ConstraintHelper.AvailableStrategicCommand()
    ];
  }

  protected initWithArg(): void {
    this.setDestCity(this.arg['destCityID']);
    this.setDestNation(this.destCity['nation']);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.OccupiedDestCity(),
      ConstraintHelper.AvailableStrategicCommand()
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
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name || '';
    return `【${destCityName}】에 ${commandName}`;
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
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

    if (!this.destCity) {
      throw new Error('대상 도시 정보가 없습니다');
    }
    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const nationID = general.getNationID();
    const nationName = this!.nation['name'];

    const logger = general!.getLogger();
    logger.pushGeneralActionLog(`백성동원 발동! <1>${date}</>`);

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const broadcastMessage = `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>백성동원</>을 하였습니다.`;

    // MongoDB로 국가 소속 장수 조회
    const nationGenerals = await generalRepository.findByNation(sessionId, nationID);
    const targetGeneralList = nationGenerals
      .filter((g: any) => (g.no ?? g.data?.no) !== generalID)
      .map((g: any) => g.no ?? g.data?.no);
    
    for (const targetGeneralID of targetGeneralList) {
      const targetLogger = new ActionLogger(targetGeneralID, nationID, year, month);
      targetLogger.pushGeneralActionLog(broadcastMessage);
      await targetLogger.flush();
    }

    // MongoDB로 도시 업데이트 (CQRS 패턴)
    const newDef = Math.max((destCity.def_max || 0) * 0.8, destCity.def || 0);
    const newWall = Math.max((destCity.wall_max || 0) * 0.8, destCity.wall || 0);
    await this.updateCity(destCityID, { def: newDef, wall: newWall });

    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>에 <M>백성동원</>을 발동 <1>${date}</>`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>에 <M>백성동원</>을 발동`);
    const josaYiNation = JosaUtil.pick(nationName, '이');
    logger.pushGlobalHistoryLog(`<Y><b>【의병】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>에서 <M>백성동원</>을 실시했습니다.`);

    // MongoDB로 국가 업데이트 (CQRS 패턴)
    const newLimit = this.generalObj.onCalcStrategic(this.constructor.getName(), 'globalDelay', [9]);
    await this.updateNation(nationID, { strategic_cmd_limit: newLimit });

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await this.saveGeneral();

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

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
