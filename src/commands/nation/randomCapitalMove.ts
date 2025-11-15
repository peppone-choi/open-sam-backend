// @ts-nocheck - Legacy db usage needs migration to Mongoose
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';

export class che_무작위수도이전 extends NationCommand {
  static getName(): string {
    return '무작위 수도 이전';
  }

  static getCategory(): string {
    return 'nation';
  }

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected init(): void {
    const env = this.env;
    const relYear = env['year'] - env['startyear'];

    this.setCity();
    this.setNation(['capital', 'aux']);

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeLord(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.NotOpeningPart(relYear),
      ConstraintHelper.ReqNationAuxValue('can_무작위수도이전', 0, '>', 0, '더이상 변경이 불가능합니다.')
    ];
  }

  public getCommandDetailTitle(): string {
    const name = che_무작위수도이전.getName();
    const reqTurn = this.getPreReqTurn() + 1;
    return `${name}/${reqTurn}턴`;
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 1;
  }

  public getPostReqTurn(): number {
    return 0;
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
    const generalID = general!.getID();
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const year = this.env['year'];
    const month = this.env['month'];

    const logger = general!.getLogger();

    const oldCityID = this.nation['capital'];

    const cities = await db.queryFirstColumn(
      'SELECT city FROM city WHERE `level`>=5 AND `level`<=6 AND nation=0'
    );
    if (!cities || cities.length === 0) {
      logger.pushGeneralActionLog(`이동할 수 있는 도시가 없습니다. <1>${date}</>`);
      return false;
    }

    const destCityID = rng.choice(cities);
    this.setDestCity(destCityID, true);

        if (!this.destCity) {
      throw new Error('대상 도시 정보가 없습니다');
    }
    const destCity = this.destCity;
    const destCityName = destCity['name'];

    const nationID = general!.getNationID();
    const nationName = this.nation['name'];

    const josaRo = JosaUtil.pick(destCityName, '로');

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    const aux = this.nation['aux'];
    aux['can_무작위수도이전'] -= 1;

    const Json = global.Json;
    await db.update('city', { nation: nationID, conflict: '{}' }, 'city=%i', [destCityID]);
    await db.update(
      'nation',
      { capital: destCityID, aux: Json.encode(aux) },
      'nation=%i',
      [nationID]
    );
    await db.update(
      'city',
      { nation: 0, front: 0, conflict: '{}', officer_set: 0 },
      'city=%i',
      [oldCityID]
    );

    general.data.city = destCityID;
    const generalList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation=%i AND no!=%i',
      [general!.getNationID(), general!.getID()]
    );
    if (generalList && generalList.length > 0) {
      await db.update('general', { city: destCityID }, 'no IN %li', [generalList]);
    }

    for (const targetGeneralID of generalList) {
      const targetLogger = new ActionLogger(targetGeneralID as number, general!.getNationID(), year, month);
      targetLogger.pushGeneralActionLog(
        `국가 수도를 <G><b>${destCityName}</b></>${josaRo} 옮겼습니다.`,
        ActionLogger.PLAIN
      );
      await targetLogger.flush();
    }

    const refreshNationStaticInfo = global.refreshNationStaticInfo;
    await refreshNationStaticInfo();

    // TODO: general.increaseInheritancePoint('active_action', 1);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>${josaRo} 국가를 옮겼습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>${josaRo} <M>무작위 수도 이전</> <1>${date}</>`);
    logger.pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaRo} <M>무작위 수도 이전</>`
    );
    logger.pushGlobalActionLog(
      `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaRo} <M>수도 이전</>하였습니다.`
    );
    logger.pushGlobalHistoryLog(
      `<S><b>【무작위 수도 이전】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>${josaRo} <M>수도 이전</>하였습니다.`
    );

    this.setResultTurn(new LastTurn(che_무작위수도이전.getName(), this.arg, 0));
    await general.applyDB(db);
    return true;
  }
}