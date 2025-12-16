// @ts-nocheck - Type issues need review
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { cityRepository } from '../../repositories/city.repository';
import { generalRepository } from '../../repositories/general.repository';

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

    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeLord(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.BeOpeningPart(relYear + 1),
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

    const logger = general!.getLogger();

    const oldCityID = this.nation['capital'];

    // MongoDB로 중립 도시 조회 (레벨 5-6)
    const neutralCities = await cityRepository.findByNation(sessionId, 0);
    const cities = neutralCities
      .filter((c: any) => {
        const level = c.level ?? c.data?.level ?? 0;
        return level >= 5 && level <= 6;
      })
      .map((c: any) => c.city ?? c.data?.city);
      
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

    const aux = this.nation['aux'] || {};
    aux['can_무작위수도이전'] = (aux['can_무작위수도이전'] || 1) - 1;

    // MongoDB로 새 수도 업데이트 (CQRS 패턴)
    await this.updateCity(destCityID, { nation: nationID, conflict: '{}' });
    
    // MongoDB로 국가 업데이트 (CQRS 패턴)
    await this.updateNation(nationID, { capital: destCityID, aux: JSON.stringify(aux) });
    
    // MongoDB로 구 수도 업데이트 (CQRS 패턴)
    await this.updateCity(oldCityID, { nation: 0, front: 0, conflict: '{}', officer_set: 0 });

    general.data.city = destCityID;
    
    // MongoDB로 국가 소속 장수들의 도시 일괄 업데이트
    const generalList = await this.updateGeneralsByFilter(
      { nationId: nationID },
      { city: destCityID }
    );
    // 자신 제외
    const otherGenerals = generalList.filter(no => no !== generalID);

    for (const targetGeneralID of otherGenerals) {
      const targetLogger = new ActionLogger(targetGeneralID as number, general!.getNationID(), year, month);
      targetLogger.pushGeneralActionLog(
        `국가 수도를 <G><b>${destCityName}</b></>${josaRo} 옮겼습니다.`,
        ActionLogger.PLAIN
      );
      await targetLogger.flush();
    }

    // 국가 정적 정보 갱신 (TODO: 구현 필요)
    // const refreshNationStaticInfo = global.refreshNationStaticInfo;
    // await refreshNationStaticInfo();

    try {
      const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const inheritanceService = new InheritancePointService(sessionId);
      const userId = general.data.owner ?? general.data.user_id ?? general.getID();
      await inheritanceService.recordActivity(userId, InheritanceKey.ACTIVE_ACTION, 1);
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }
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
    
    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }
    
    await this.saveGeneral();
    return true;
  }
}
